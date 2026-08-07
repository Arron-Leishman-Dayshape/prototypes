/* First-party telemetry store (Supabase + local fallback) */
(function (global) {
  'use strict';

  var LOCAL_PREFIX = 'prototypes.telemetry.';
  var cfg = function () { return global.PROTOTYPES_CONFIG || {}; };

  function uid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
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
    try {
      localStorage.setItem(localKey(prototypeId), JSON.stringify((list || []).slice(-800)));
    } catch (e) {
      try {
        localStorage.setItem(localKey(prototypeId), JSON.stringify((list || []).slice(-200)));
      } catch (e2) {}
    }
  }

  function normalize(row) {
    return {
      id: row.id || uid(),
      prototypeId: row.prototypeId || row.prototype_id || '',
      sessionId: row.sessionId || row.session_id || '',
      eventType: row.eventType || row.event_type || '',
      x: row.x != null ? Number(row.x) : null,
      y: row.y != null ? Number(row.y) : null,
      viewportW: row.viewportW != null ? Number(row.viewportW) : (row.viewport_w != null ? Number(row.viewport_w) : null),
      viewportH: row.viewportH != null ? Number(row.viewportH) : (row.viewport_h != null ? Number(row.viewport_h) : null),
      scrollY: row.scrollY != null ? Number(row.scrollY) : (row.scroll_y != null ? Number(row.scroll_y) : null),
      scrollMax: row.scrollMax != null ? Number(row.scrollMax) : (row.scroll_max != null ? Number(row.scroll_max) : null),
      pageUrl: row.pageUrl || row.page_url || '',
      pagePath: row.pagePath || row.page_path || '',
      meta: row.meta || {},
      createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    };
  }

  function headers() {
    var c = cfg();
    return {
      apikey: c.supabaseAnonKey.trim(),
      Authorization: 'Bearer ' + c.supabaseAnonKey.trim(),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    };
  }

  function base() {
    return cfg().supabaseUrl.replace(/\/$/, '') + '/rest/v1/telemetry_events';
  }

  var queue = [];
  var flushTimer = null;

  function enqueue(entry) {
    var item = normalize(Object.assign({}, entry, { id: entry.id || uid() }));
    var local = readLocal(item.prototypeId);
    local.push(item);
    writeLocal(item.prototypeId, local);
    queue.push(item);
    if (!flushTimer) flushTimer = setTimeout(flush, 1200);
    return item;
  }

  function flush() {
    flushTimer = null;
    if (!queue.length || !hasSupabase()) {
      queue = [];
      return Promise.resolve();
    }
    var batch = queue.splice(0, 40);
    var body = batch.map(function (item) {
      return {
        id: item.id,
        prototype_id: item.prototypeId,
        session_id: item.sessionId,
        event_type: item.eventType,
        x: item.x,
        y: item.y,
        viewport_w: item.viewportW,
        viewport_h: item.viewportH,
        scroll_y: item.scrollY,
        scroll_max: item.scrollMax,
        page_url: item.pageUrl,
        page_path: item.pagePath,
        meta: item.meta || {},
        created_at: item.createdAt,
      };
    });

    return fetch(base(), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(function () {
      // keep local copy; ignore remote failure
    });
  }

  function list(prototypeId, options) {
    options = options || {};
    var local = readLocal(prototypeId).map(normalize);
    if (!hasSupabase()) {
      return Promise.resolve({ items: local, shared: false });
    }

    var limit = options.limit || 2000;
    var url = base()
      + '?prototype_id=eq.' + encodeURIComponent(prototypeId)
      + '&order=created_at.desc'
      + '&limit=' + limit
      + '&select=*';

    return fetch(url, {
      headers: {
        apikey: cfg().supabaseAnonKey.trim(),
        Authorization: 'Bearer ' + cfg().supabaseAnonKey.trim(),
      },
    }).then(function (res) {
      if (!res.ok) throw new Error('telemetry load failed');
      return res.json();
    }).then(function (rows) {
      var remote = (rows || []).map(normalize);
      var map = {};
      remote.concat(local).forEach(function (item) {
        map[item.id] = item;
      });
      var merged = Object.keys(map).map(function (k) { return map[k]; })
        .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
      writeLocal(prototypeId, merged);
      return { items: merged, shared: true };
    }).catch(function () {
      return { items: local, shared: false, error: true };
    });
  }

  function summarizeSessions(items) {
    var sessions = {};
    (items || []).forEach(function (ev) {
      var sid = ev.sessionId || 'unknown';
      if (!sessions[sid]) {
        sessions[sid] = {
          sessionId: sid,
          startedAt: ev.createdAt,
          endedAt: ev.createdAt,
          clicks: 0,
          pageViews: 0,
          scrollMax: 0,
          events: 0,
        };
      }
      var s = sessions[sid];
      s.events += 1;
      if (String(ev.createdAt) < String(s.startedAt)) s.startedAt = ev.createdAt;
      if (String(ev.createdAt) > String(s.endedAt)) s.endedAt = ev.createdAt;
      if (ev.eventType === 'click') s.clicks += 1;
      if (ev.eventType === 'pageview') s.pageViews += 1;
      if (ev.scrollMax != null && ev.scrollMax > s.scrollMax) s.scrollMax = ev.scrollMax;
    });
    return Object.keys(sessions).map(function (k) {
      var s = sessions[k];
      s.durationMs = Math.max(0, new Date(s.endedAt) - new Date(s.startedAt));
      return s;
    }).sort(function (a, b) { return String(b.startedAt).localeCompare(String(a.startedAt)); });
  }

  global.PrototypesTelemetry = {
    track: enqueue,
    flush: flush,
    list: list,
    summarizeSessions: summarizeSessions,
    hasSupabase: hasSupabase,
    uid: uid,
  };

  global.addEventListener('pagehide', function () { flush(); });
  global.addEventListener('beforeunload', function () { flush(); });
})(window);
