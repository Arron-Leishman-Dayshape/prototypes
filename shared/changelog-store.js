/* Per-prototype changelog / build-todo store: Supabase + localStorage */
(function (global) {
  'use strict';

  var LOCAL_PREFIX = 'prototypes.changelog.';
  var cfg = function () { return global.PROTOTYPES_CONFIG || {}; };

  function uid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  function hasSupabase() {
    var c = cfg();
    return !!(c.supabaseUrl && c.supabaseAnonKey && String(c.supabaseUrl).trim() && String(c.supabaseAnonKey).trim());
  }

  function localKey(prototypeId) {
    return LOCAL_PREFIX + (prototypeId || 'unknown');
  }

  function readLocal(prototypeId) {
    try {
      return JSON.parse(localStorage.getItem(localKey(prototypeId)) || '[]');
    } catch (e) {
      return [];
    }
  }

  function writeLocal(prototypeId, list) {
    var key = localKey(prototypeId);
    var trimmed = (list || []).slice(0, 200);
    try {
      localStorage.setItem(key, JSON.stringify(trimmed));
      return;
    } catch (e) {
      trimmed.forEach(function (item, i) {
        if (i > 15) item.screenshotData = '';
      });
      try {
        localStorage.setItem(key, JSON.stringify(trimmed));
      } catch (e2) {
        trimmed.forEach(function (item) { item.screenshotData = ''; });
        localStorage.setItem(key, JSON.stringify(trimmed.slice(0, 60)));
      }
    }
  }

  function parseAnnotation(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return normalizeAnnotation(raw);
    try {
      return normalizeAnnotation(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function normalizeAnnotation(a) {
    if (!a || a.w == null || a.h == null) return null;
    return {
      x: Number(a.x) || 0,
      y: Number(a.y) || 0,
      w: Math.max(0.01, Number(a.w) || 0),
      h: Math.max(0.01, Number(a.h) || 0),
    };
  }

  function normalize(row) {
    var status = String(row.status || 'todo').toLowerCase();
    if (status !== 'done') status = 'todo';
    return {
      id: row.id || uid(),
      prototypeId: row.prototypeId || row.prototype_id || '',
      prototypeTitle: row.prototypeTitle || row.prototype_title || '',
      title: row.title || '',
      summary: row.summary || row.message || '',
      status: status,
      screenshotData: row.screenshotData || row.screenshot_data || '',
      annotation: parseAnnotation(row.annotation || row.annotation_json),
      pageUrl: row.pageUrl || row.page_url || '',
      pagePath: row.pagePath || row.page_path || '',
      createdAt: row.createdAt || row.created_at || new Date().toISOString(),
      updatedAt: row.updatedAt || row.updated_at || row.createdAt || row.created_at || new Date().toISOString(),
    };
  }

  function supabaseHeaders(extra) {
    var c = cfg();
    var headers = {
      apikey: c.supabaseAnonKey.trim(),
      Authorization: 'Bearer ' + c.supabaseAnonKey.trim(),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };
    if (extra) Object.keys(extra).forEach(function (k) { headers[k] = extra[k]; });
    return headers;
  }

  function supabaseBase() {
    return cfg().supabaseUrl.replace(/\/$/, '') + '/rest/v1/changelog';
  }

  function toBody(item) {
    var body = {
      id: item.id,
      prototype_id: item.prototypeId,
      prototype_title: item.prototypeTitle,
      title: item.title,
      summary: item.summary,
      status: item.status,
      page_url: item.pageUrl,
      page_path: item.pagePath,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    };
    if (item.screenshotData) body.screenshot_data = item.screenshotData;
    if (item.annotation) body.annotation = item.annotation;
    return body;
  }

  function upsertLocal(prototypeId, item) {
    var list = readLocal(prototypeId).map(normalize);
    var found = false;
    list = list.map(function (row) {
      if (row.id !== item.id) return row;
      found = true;
      return item;
    });
    if (!found) list.unshift(item);
    writeLocal(prototypeId, list);
  }

  function add(entry) {
    var now = new Date().toISOString();
    var item = normalize(Object.assign({}, entry, {
      id: entry.id || uid(),
      status: entry.status || 'todo',
      createdAt: entry.createdAt || now,
      updatedAt: entry.updatedAt || now,
    }));

    upsertLocal(item.prototypeId, item);

    if (!hasSupabase()) {
      return Promise.resolve({ item: item, shared: false });
    }

    return fetch(supabaseBase(), {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify(toBody(item)),
    }).then(function (res) {
      if (res.ok) return { item: item, shared: true };
      if (item.screenshotData && (res.status === 400 || res.status === 415)) {
        var body = toBody(item);
        delete body.screenshot_data;
        return fetch(supabaseBase(), {
          method: 'POST',
          headers: supabaseHeaders(),
          body: JSON.stringify(body),
        }).then(function (res2) {
          if (!res2.ok) throw new Error('Supabase save failed (' + res2.status + ')');
          return { item: item, shared: true, screenshotSkipped: true };
        });
      }
      throw new Error('Supabase save failed (' + res.status + ')');
    });
  }

  function setStatus(prototypeId, itemId, status) {
    var next = String(status || 'todo').toLowerCase() === 'done' ? 'done' : 'todo';
    var now = new Date().toISOString();
    var list = readLocal(prototypeId).map(normalize);
    var item = null;
    list = list.map(function (row) {
      if (row.id !== itemId) return row;
      item = Object.assign({}, row, { status: next, updatedAt: now });
      return item;
    });
    if (!item) return Promise.reject(new Error('Changelog item not found'));
    writeLocal(prototypeId, list);

    if (!hasSupabase()) {
      return Promise.resolve({ item: item, shared: false });
    }

    var url = supabaseBase() + '?id=eq.' + encodeURIComponent(itemId);
    return fetch(url, {
      method: 'PATCH',
      headers: supabaseHeaders(),
      body: JSON.stringify({ status: next, updated_at: now }),
    }).then(function (res) {
      if (res.ok) return { item: item, shared: true };
      return { item: item, shared: false, remoteFailed: true, status: res.status };
    }).catch(function () {
      return { item: item, shared: false, remoteFailed: true };
    });
  }

  function remove(prototypeId, itemId) {
    var id = String(itemId || '');
    if (!id) return Promise.reject(new Error('Missing changelog id'));

    var list = readLocal(prototypeId).map(normalize).filter(function (row) { return row.id !== id; });
    writeLocal(prototypeId, list);

    if (!hasSupabase()) {
      return Promise.resolve({ shared: false });
    }

    var url = supabaseBase() + '?id=eq.' + encodeURIComponent(id);
    return fetch(url, {
      method: 'DELETE',
      headers: {
        apikey: cfg().supabaseAnonKey.trim(),
        Authorization: 'Bearer ' + cfg().supabaseAnonKey.trim(),
        Prefer: 'return=minimal',
      },
    }).then(function (res) {
      if (res.ok || res.status === 204) return { shared: true };
      return { shared: false, remoteFailed: true, status: res.status };
    }).catch(function () {
      return { shared: false, remoteFailed: true };
    });
  }

  function list(prototypeId) {
    var local = readLocal(prototypeId).map(normalize);

    if (!hasSupabase()) {
      return Promise.resolve({ items: local, shared: false });
    }

    var url = supabaseBase()
      + '?prototype_id=eq.' + encodeURIComponent(prototypeId)
      + '&order=created_at.desc'
      + '&select=*';

    return fetch(url, {
      headers: {
        apikey: cfg().supabaseAnonKey.trim(),
        Authorization: 'Bearer ' + cfg().supabaseAnonKey.trim(),
      },
      cache: 'no-store',
    }).then(function (res) {
      if (!res.ok) throw new Error('Supabase load failed (' + res.status + ')');
      return res.json();
    }).then(function (rows) {
      var remote = (rows || []).map(normalize);
      var remoteIds = {};
      remote.forEach(function (item) { remoteIds[item.id] = true; });
      var pendingLocal = local.filter(function (item) {
        return !remoteIds[item.id] && String(item.id).indexOf('c_') === 0;
      });
      var merged = remote.concat(pendingLocal).sort(function (a, b) {
        // Open todos first, then by date
        if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
        return String(b.createdAt).localeCompare(String(a.createdAt));
      });
      writeLocal(prototypeId, merged);
      return { items: merged, shared: true };
    }).catch(function () {
      return { items: local, shared: false, error: true };
    });
  }

  global.PrototypesChangelogStore = {
    hasSupabase: hasSupabase,
    add: add,
    setStatus: setStatus,
    remove: remove,
    list: list,
    uid: uid,
  };
})(window);
