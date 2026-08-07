/* First-party click / scroll / session tracking for mock pages */
(function () {
  'use strict';
  if (window.__protoTelemetryLoaded) return;
  window.__protoTelemetryLoaded = true;

  var store = window.PrototypesTelemetry;
  var access = window.PrototypesAccess;
  if (!store) return;

  // Don't track when embedded in the Insights heatmap preview iframe
  if (window.self !== window.top) return;

  // Don't track on hub / insights pages
  if (/\/(index|feedback)\.html$/i.test(location.pathname) || /\/prototypes\/?$/i.test(location.pathname)) {
    if (!/\/mocks\//i.test(location.pathname)) return;
  }

  var prototypeId =
    (document.documentElement.getAttribute('data-prototype-id') ||
      (document.body && document.body.getAttribute('data-prototype-id')) ||
      '').trim();

  if (!prototypeId) {
    var match = (location.pathname || '').match(/\/mocks\/([^/]+?)(?:\.html)?\/?$/i);
    if (match) prototypeId = decodeURIComponent(match[1]);
  }
  if (!prototypeId) return;

  // Skip tracking for internal team browsing the hub with access key in this browser? 
  // Still track — useful. Reviewers + team both generate data.

  var SESSION_KEY = 'prototypes.telemetry.session.' + prototypeId;
  var sessionId = '';
  try {
    sessionId = sessionStorage.getItem(SESSION_KEY) || '';
    if (!sessionId) {
      sessionId = store.uid();
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
  } catch (e) {
    sessionId = store.uid();
  }

  var maxScrollPct = 0;

  function pageMeta() {
    return {
      pageUrl: location.href,
      pagePath: location.pathname + location.search,
    };
  }

  function docHeight() {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    );
  }

  function scrollPct() {
    var h = docHeight() - window.innerHeight;
    if (h <= 0) return 100;
    return Math.max(0, Math.min(100, Math.round((window.scrollY / h) * 100)));
  }

  function track(eventType, extra) {
    var meta = pageMeta();
    store.track(Object.assign({
      prototypeId: prototypeId,
      sessionId: sessionId,
      eventType: eventType,
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
      scrollY: window.scrollY,
      scrollMax: maxScrollPct,
      pageUrl: meta.pageUrl,
      pagePath: meta.pagePath,
    }, extra || {}));
  }

  // Page view
  track('pageview', { meta: { title: document.title || '' } });

  // Clicks — normalized 0–1 relative to document so heatmaps survive resize
  document.addEventListener('click', function (e) {
    // Ignore our own feedback chrome
    if (e.target.closest && (
      e.target.closest('.ProtoFeedback-launch') ||
      e.target.closest('.ProtoFeedback-panel') ||
      e.target.closest('.ProtoFeedback-pickTip')
    )) return;

    var pageX = e.pageX;
    var pageY = e.pageY;
    var w = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth);
    var h = Math.max(docHeight(), window.innerHeight);
    if (w < 1 || h < 1) return;

    var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    var text = '';
    try {
      text = ((e.target && (e.target.innerText || e.target.getAttribute('aria-label') || e.target.getAttribute('title'))) || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
    } catch (err) {}

    track('click', {
      x: pageX / w,
      y: pageY / h,
      meta: { tag: tag, text: text },
    });
  }, true);

  // Scroll depth (throttled)
  var scrollTimer = null;
  window.addEventListener('scroll', function () {
    if (scrollTimer) return;
    scrollTimer = setTimeout(function () {
      scrollTimer = null;
      var pct = scrollPct();
      if (pct > maxScrollPct) {
        maxScrollPct = pct;
        track('scroll', { scrollMax: maxScrollPct, meta: { depth: maxScrollPct } });
      }
    }, 400);
  }, { passive: true });

  // Heartbeat so sessions have an end time
  setInterval(function () {
    track('ping', { scrollMax: maxScrollPct });
  }, 20000);
})();
