/* Per-prototype feedback store: Supabase (shared) + localStorage (always) */
(function (global) {
  'use strict';

  var LOCAL_PREFIX = 'prototypes.feedback.';
  var cfg = function () { return global.PROTOTYPES_CONFIG || {}; };

  function uid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
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
      // Quota: drop oldest screenshots then retry
      trimmed.forEach(function (item, i) {
        if (i > 20) item.screenshotData = '';
      });
      try {
        localStorage.setItem(key, JSON.stringify(trimmed));
      } catch (e2) {
        trimmed.forEach(function (item) { item.screenshotData = ''; });
        localStorage.setItem(key, JSON.stringify(trimmed.slice(0, 80)));
      }
    }
  }

  function normalize(row) {
    return {
      id: row.id || uid(),
      prototypeId: row.prototypeId || row.prototype_id || '',
      prototypeTitle: row.prototypeTitle || row.prototype_title || '',
      name: row.name || 'Anonymous',
      rating: row.rating != null ? String(row.rating) : '',
      message: row.message || '',
      pageUrl: row.pageUrl || row.page_url || '',
      pagePath: row.pagePath || row.page_path || '',
      screenshotData: row.screenshotData || row.screenshot_data || '',
      createdAt: row.createdAt || row.created_at || row.timestamp || new Date().toISOString(),
    };
  }

  function mergeById(remote, local) {
    var map = {};
    (remote || []).concat(local || []).forEach(function (item) {
      var n = normalize(item);
      if (!n.id) return;
      var prev = map[n.id];
      if (!prev) {
        map[n.id] = n;
        return;
      }
      // Prefer newer timestamp; keep screenshot from whichever has it
      var newer = String(n.createdAt) >= String(prev.createdAt) ? n : prev;
      var older = newer === n ? prev : n;
      if (!newer.screenshotData && older.screenshotData) newer.screenshotData = older.screenshotData;
      map[n.id] = newer;
    });
    return Object.keys(map)
      .map(function (k) { return map[k]; })
      .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  }

  function supabaseHeaders() {
    var c = cfg();
    return {
      apikey: c.supabaseAnonKey.trim(),
      Authorization: 'Bearer ' + c.supabaseAnonKey.trim(),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };
  }

  function supabaseBase() {
    return cfg().supabaseUrl.replace(/\/$/, '') + '/rest/v1/feedback';
  }

  function add(entry) {
    var item = normalize(Object.assign({}, entry, {
      id: entry.id || uid(),
      createdAt: entry.createdAt || entry.timestamp || new Date().toISOString(),
    }));

    var local = readLocal(item.prototypeId);
    local.unshift(item);
    writeLocal(item.prototypeId, local);

    if (!hasSupabase()) {
      return Promise.resolve({ item: item, shared: false });
    }

    var body = {
      id: item.id,
      prototype_id: item.prototypeId,
      prototype_title: item.prototypeTitle,
      name: item.name,
      rating: item.rating,
      message: item.message,
      page_url: item.pageUrl,
      page_path: item.pagePath,
      created_at: item.createdAt,
    };
    if (item.screenshotData) body.screenshot_data = item.screenshotData;

    return fetch(supabaseBase(), {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify(body),
    }).then(function (res) {
      if (res.ok) return { item: item, shared: true };

      // Column may not exist yet — retry without screenshot so text still syncs
      if (item.screenshotData && (res.status === 400 || res.status === 415)) {
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
    }).then(function (res) {
      if (!res.ok) throw new Error('Supabase load failed (' + res.status + ')');
      return res.json();
    }).then(function (rows) {
      var merged = mergeById(rows, local);
      writeLocal(prototypeId, merged);
      return { items: merged, shared: true };
    }).catch(function () {
      return { items: local, shared: false, error: true };
    });
  }

  function count(prototypeId) {
    return list(prototypeId).then(function (result) {
      return { count: (result.items || []).length, shared: result.shared };
    });
  }

  function resolvePrototypeId() {
    var fromDom =
      document.documentElement.getAttribute('data-prototype-id') ||
      (document.body && document.body.getAttribute('data-prototype-id'));
    if (fromDom) return fromDom.trim();

    var path = location.pathname || '';
    var match = path.match(/\/mocks\/([^/]+?)(?:\.html)?\/?$/i);
    if (match) return decodeURIComponent(match[1]);

    var params = new URLSearchParams(location.search);
    if (params.get('id')) return params.get('id').trim();

    return '';
  }

  function resolvePrototypeTitle(prototypeId) {
    var fromDom =
      document.documentElement.getAttribute('data-prototype-title') ||
      (document.body && document.body.getAttribute('data-prototype-title'));
    if (fromDom) return fromDom.trim();
    if (document.title) return document.title.replace(/^Dayshape\s*[—–-]\s*/i, '').trim();
    return prototypeId || 'Prototype';
  }

  global.PrototypesFeedbackStore = {
    add: add,
    list: list,
    count: count,
    hasSupabase: hasSupabase,
    resolvePrototypeId: resolvePrototypeId,
    resolvePrototypeTitle: resolvePrototypeTitle,
    normalize: normalize,
  };
})(window);
