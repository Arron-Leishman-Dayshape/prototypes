/* First-party click tracking for heatmaps on mock pages */
(function () {
  'use strict';
  if (window.__protoTelemetryLoaded) return;
  window.__protoTelemetryLoaded = true;

  var store = window.PrototypesTelemetry;
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

  function docHeight() {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    );
  }

  function trackClick(e) {
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

    store.track({
      prototypeId: prototypeId,
      sessionId: sessionId,
      eventType: 'click',
      x: pageX / w,
      y: pageY / h,
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
      scrollY: window.scrollY,
      pageUrl: location.href,
      pagePath: location.pathname + location.search,
      meta: { tag: tag, text: text, docW: w, docH: h },
    });
  }

  document.addEventListener('click', trackClick, true);
})();
