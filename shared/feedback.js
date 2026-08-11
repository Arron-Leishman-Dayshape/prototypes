(function () {
  'use strict';
  if (window.__protoFeedbackLoaded) return;
  window.__protoFeedbackLoaded = true;

  var cfg = window.PROTOTYPES_CONFIG || {};
  var store = window.PrototypesFeedbackStore;
  var rating = '';
  var screenshotData = '';
  var prototypeId = store ? store.resolvePrototypeId() : '';
  var prototypeTitle = store ? store.resolvePrototypeTitle(prototypeId) : document.title;
  var HTML2CANVAS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

  // Only on prototype pages (not hub / inbox / heatmap preview)
  if (!prototypeId || /\/feedback\.html$/i.test(location.pathname)) return;
  if (/[?&]heatmap=1(?:&|$)/.test(location.search)) return;

  function pageMeta() {
    return {
      pageTitle: document.title || '',
      pageUrl: location.href,
      pagePath: location.pathname + location.search,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };
  }

  function ensureAssets() {
    if (!document.querySelector('link[data-proto-feedback-css]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = resolveShared('feedback.css');
      link.setAttribute('data-proto-feedback-css', '1');
      document.head.appendChild(link);
    }
    if (!document.querySelector('link[data-proto-fa]') && !document.querySelector('link[href*="font-awesome"]')) {
      var fa = document.createElement('link');
      fa.rel = 'stylesheet';
      fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
      fa.setAttribute('data-proto-fa', '1');
      document.head.appendChild(fa);
    }
  }

  function resolveShared(file) {
    var scripts = document.querySelectorAll('script[src*="feedback.js"]');
    var src = scripts.length ? scripts[scripts.length - 1].getAttribute('src') : '';
    if (src) return src.replace(/feedback\.js(?:\?.*)?$/, file);
    return '/shared/' + file;
  }

  function hubFeedbackUrl() {
    var scripts = document.querySelectorAll('script[src*="feedback.js"]');
    var src = scripts.length ? scripts[scripts.length - 1].getAttribute('src') : '';
    var base = src ? src.replace(/shared\/feedback\.js(?:\?.*)?$/, '') : '/';
    var access = window.PrototypesAccess;
    var url = base + 'feedback.html?id=' + encodeURIComponent(prototypeId);
    if (access && access.configuredKey()) {
      url += '&key=' + encodeURIComponent(access.configuredKey());
    }
    return url;
  }

  function isInternalViewer() {
    return !!(window.PrototypesAccess && window.PrototypesAccess.hasAccess());
  }

  function loadHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-proto-html2canvas]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.html2canvas); });
        existing.addEventListener('error', reject);
        return;
      }
      var s = document.createElement('script');
      s.src = HTML2CANVAS_SRC;
      s.async = true;
      s.setAttribute('data-proto-html2canvas', '1');
      s.onload = function () { resolve(window.html2canvas); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function canvasToJpegDataUrl(canvas, quality) {
    var maxW = 1280;
    var out = canvas;
    if (canvas.width > maxW) {
      var scale = maxW / canvas.width;
      var resized = document.createElement('canvas');
      resized.width = Math.round(canvas.width * scale);
      resized.height = Math.round(canvas.height * scale);
      var ctx = resized.getContext('2d');
      ctx.drawImage(canvas, 0, 0, resized.width, resized.height);
      out = resized;
    }
    return out.toDataURL('image/jpeg', quality == null ? 0.62 : quality);
  }

  function setScreenshot(dataUrl) {
    screenshotData = dataUrl || '';
    var preview = document.getElementById('protoFeedbackShotPreview');
    var img = document.getElementById('protoFeedbackShotImg');
    var empty = document.getElementById('protoFeedbackShotEmpty');
    if (!preview) return;
    if (screenshotData) {
      preview.hidden = false;
      if (empty) empty.hidden = true;
      if (img) {
        img.src = screenshotData;
        img.hidden = false;
      }
    } else {
      preview.hidden = true;
      if (img) {
        img.removeAttribute('src');
        img.hidden = true;
      }
      if (empty) empty.hidden = false;
    }
  }

  function clearScreenshot() {
    setScreenshot('');
  }

  function withChromeHidden(fn) {
    var launch = document.getElementById('protoFeedbackLaunch');
    var panel = document.getElementById('protoFeedbackPanel');
    var prevLaunch = launch ? launch.style.display : '';
    var prevPanelHidden = panel ? panel.hidden : true;
    if (launch) launch.style.display = 'none';
    if (panel) panel.hidden = true;
    return Promise.resolve()
      .then(fn)
      .finally(function () {
        if (launch) launch.style.display = prevLaunch;
        if (panel) panel.hidden = prevPanelHidden;
      });
  }

  function captureElement(el) {
    return loadHtml2Canvas().then(function (html2canvas) {
      return withChromeHidden(function () {
        return html2canvas(el, {
          useCORS: true,
          allowTaint: true,
          logging: false,
          scale: Math.min(2, window.devicePixelRatio || 1),
          backgroundColor: '#ffffff',
        }).then(function (canvas) {
          return canvasToJpegDataUrl(canvas);
        });
      });
    });
  }

  function captureViewport() {
    return loadHtml2Canvas().then(function (html2canvas) {
      return withChromeHidden(function () {
        return html2canvas(document.body, {
          useCORS: true,
          allowTaint: true,
          logging: false,
          scale: Math.min(1.5, window.devicePixelRatio || 1),
          backgroundColor: '#ffffff',
          width: window.innerWidth,
          height: window.innerHeight,
          x: window.scrollX,
          y: window.scrollY,
          windowWidth: document.documentElement.clientWidth,
          windowHeight: document.documentElement.clientHeight,
        }).then(function (canvas) {
          return canvasToJpegDataUrl(canvas, 0.58);
        });
      });
    });
  }

  function isFeedbackChrome(el) {
    if (!el || !el.closest) return false;
    return !!(
      el.closest('.ProtoFeedback-launch') ||
      el.closest('.ProtoFeedback-panel') ||
      el.closest('.ProtoFeedback-pickTip') ||
      el.closest('.ProtoFeedback-pickOverlay') ||
      el.id === 'protoFeedbackPickTip' ||
      el.id === 'protoFeedbackPickOverlay'
    );
  }

  function looksLikeComponent(el) {
    if (!el || el.nodeType !== 1) return false;
    var cls = typeof el.className === 'string' ? el.className : '';
    if (!cls) return false;
    // Prefer named UI blocks (Btn, Card, Modal, TopBar-title, NavBar-li, …)
    return /(^|\s)([A-Z][A-Za-z0-9]+|[A-Z][A-Za-z0-9]*-[A-Za-z0-9_-]+)(\s|$)/.test(cls) ||
      /\b(btn|button|card|modal|dialog|panel|nav|menu|tab|row|cell|item|tile|chip|badge|toolbar|header|footer|sidebar|drawer|toast|alert|table|list)\b/i.test(cls);
  }

  /**
   * Climb from the leaf under the cursor to a sensible “component” target —
   * buttons, cards, list rows, form fields — instead of tiny nested divs/spans/icons.
   */
  function resolvePickTarget(raw) {
    if (!raw || raw.nodeType !== 1) return null;
    if (isFeedbackChrome(raw)) return null;

    var start = raw;
    if (start.closest && start.closest('svg') && start.tagName.toLowerCase() !== 'svg') {
      start = start.closest('svg');
    }

    var INTERACTIVE = /^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY|LABEL|IMG|VIDEO|CANVAS|TABLE|FORM|FIELDSET|DETAILS)$/i;
    var BLOCK = /^(SECTION|ARTICLE|ASIDE|NAV|HEADER|FOOTER|MAIN|LI|TR|TD|TH|FIGURE|DIALOG|UL|OL|DL|DT|DD)$/i;
    var ROLE_OK = /^(button|link|menuitem|tab|checkbox|radio|textbox|combobox|option|switch|listitem|article|region|group|dialog|navigation|toolbar|banner|contentinfo)$/i;

    var vpArea = Math.max(1, window.innerWidth * window.innerHeight);
    var MIN_W = 48;
    var MIN_H = 28;
    var MIN_AREA = 1800;
    var MAX_RATIO = 0.72;

    function rectOf(el) {
      try { return el.getBoundingClientRect(); } catch (e) { return null; }
    }

    function tooBig(rect) {
      return (rect.width * rect.height) > vpArea * MAX_RATIO ||
        rect.width > window.innerWidth * 0.92 ||
        rect.height > window.innerHeight * 0.92;
    }

    function bigEnough(rect) {
      return rect.width >= MIN_W && rect.height >= MIN_H && (rect.width * rect.height) >= MIN_AREA;
    }

    function score(el, rect) {
      var tag = el.tagName;
      var role = (el.getAttribute('role') || '').toLowerCase();
      var s = 0;
      if (INTERACTIVE.test(tag) || ROLE_OK.test(role)) s += 100;
      if (BLOCK.test(tag)) s += 70;
      if (looksLikeComponent(el)) s += 55;
      if (tag === 'SVG') s += 40;
      // Prefer mid-sized components over huge wrappers or tiny chips
      var area = rect.width * rect.height;
      var ideal = Math.min(vpArea * 0.18, 220000);
      s += Math.max(0, 35 - Math.abs(area - ideal) / ideal * 35);
      return s;
    }

    var best = null;
    var bestScore = -1;
    var cur = start;

    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (isFeedbackChrome(cur)) break;

      var rect = rectOf(cur);
      if (rect && rect.width >= 8 && rect.height >= 8 && !tooBig(rect)) {
        var tag = cur.tagName;
        var role = (cur.getAttribute('role') || '').toLowerCase();
        var meaningful =
          INTERACTIVE.test(tag) ||
          BLOCK.test(tag) ||
          ROLE_OK.test(role) ||
          looksLikeComponent(cur) ||
          (bigEnough(rect) && (tag === 'DIV' || tag === 'SPAN' || tag === 'SVG'));

        if (meaningful) {
          var sc = score(cur, rect);
          // Prefer the first strong hit while climbing (closest component),
          // but allow a clearly stronger parent (e.g. icon → button → card).
          if (sc >= 90) return cur;
          if (sc > bestScore) {
            best = cur;
            bestScore = sc;
          }
        }
      }

      cur = cur.parentElement;
    }

    if (best) return best;

    // Fallback: climb until something is reasonably sized, without eating the page
    cur = start;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (isFeedbackChrome(cur)) break;
      var r = rectOf(cur);
      if (r && bigEnough(r) && !tooBig(r)) return cur;
      cur = cur.parentElement;
    }

    return start;
  }

  function startElementPick() {
    var panel = document.getElementById('protoFeedbackPanel');
    var launch = document.getElementById('protoFeedbackLaunch');
    if (panel) panel.hidden = true;
    if (launch) launch.style.display = 'none';

    var tip = document.createElement('div');
    tip.className = 'ProtoFeedback-pickTip';
    tip.id = 'protoFeedbackPickTip';
    tip.innerHTML = '<strong>Click a component</strong> you’re referring to · Esc to cancel';
    document.body.appendChild(tip);

    var overlay = document.createElement('div');
    overlay.className = 'ProtoFeedback-pickOverlay';
    overlay.id = 'protoFeedbackPickOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
    document.body.classList.add('ProtoFeedback-isPicking');

    var hoverEl = null;

    function placeOverlay(el) {
      if (!el) {
        overlay.classList.remove('is-on');
        return;
      }
      var rect = el.getBoundingClientRect();
      var pad = 2;
      overlay.style.left = Math.max(0, rect.left - pad) + 'px';
      overlay.style.top = Math.max(0, rect.top - pad) + 'px';
      overlay.style.width = Math.max(0, rect.width + pad * 2) + 'px';
      overlay.style.height = Math.max(0, rect.height + pad * 2) + 'px';
      overlay.classList.add('is-on');
    }

    function onMove(e) {
      var under = document.elementFromPoint(e.clientX, e.clientY);
      if (!under || under === tip || tip.contains(under) || isFeedbackChrome(under)) return;
      var el = resolvePickTarget(under);
      if (!el) return;
      if (el === hoverEl) {
        placeOverlay(el);
        return;
      }
      hoverEl = el;
      placeOverlay(el);
    }

    function onScrollOrResize() {
      if (hoverEl) placeOverlay(hoverEl);
    }

    function cleanup() {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.body.classList.remove('ProtoFeedback-isPicking');
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (tip.parentNode) tip.parentNode.removeChild(tip);
      if (launch) launch.style.display = '';
      if (panel) panel.hidden = false;
      hoverEl = null;
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup();
        setStatus('Screenshot cancelled.');
      }
    }

    function onClick(e) {
      e.preventDefault();
      e.stopPropagation();
      var under = e.target;
      if (under === tip || tip.contains(under) || isFeedbackChrome(under)) return;
      var el = resolvePickTarget(under) || hoverEl;
      cleanup();
      if (!el) {
        setStatus('Couldn’t find a component there. Try again or use “Capture page”.', 'err');
        return;
      }
      setStatus('Capturing…');
      captureElement(el)
        .then(function (dataUrl) {
          setScreenshot(dataUrl);
          setStatus('Screenshot attached (optional — remove anytime).', 'ok');
        })
        .catch(function () {
          setStatus('Couldn’t capture that element. Try “Capture page”.', 'err');
        });
    }

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
  }

  function mount() {
    ensureAssets();

    var launch = document.createElement('button');
    launch.type = 'button';
    launch.className = 'ProtoFeedback-launch';
    launch.id = 'protoFeedbackLaunch';
    launch.innerHTML = '<i class="fa-regular fa-comment-dots" aria-hidden="true"></i> Feedback';
    document.body.appendChild(launch);

    var panel = document.createElement('div');
    panel.className = 'ProtoFeedback-panel';
    panel.id = 'protoFeedbackPanel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Send feedback');
    panel.innerHTML =
      '<div class="ProtoFeedback-head">' +
        '<div>' +
          '<p class="ProtoFeedback-title">Feedback on this prototype</p>' +
          '<p class="ProtoFeedback-sub">' + escapeHtml(prototypeTitle) + ' — ' +
            escapeHtml(cfg.feedbackIntro || 'What’s working, what’s confusing, what’s missing?') + '</p>' +
        '</div>' +
        '<button type="button" class="ProtoFeedback-close" id="protoFeedbackClose" aria-label="Close">&times;</button>' +
      '</div>' +
      '<form class="ProtoFeedback-body" id="protoFeedbackForm">' +
        '<label class="ProtoFeedback-label">How does this feel?' +
          '<div class="ProtoFeedback-rating" id="protoFeedbackRating" role="group">' +
            '<button type="button" data-rating="1">1</button>' +
            '<button type="button" data-rating="2">2</button>' +
            '<button type="button" data-rating="3">3</button>' +
            '<button type="button" data-rating="4">4</button>' +
            '<button type="button" data-rating="5">5</button>' +
          '</div>' +
        '</label>' +
        '<label class="ProtoFeedback-label">Your name <span style="font-weight:400;color:#6a708f">(optional)</span>' +
          '<input type="text" id="protoFeedbackName" name="name" autocomplete="name" placeholder="Alex" />' +
        '</label>' +
        '<label class="ProtoFeedback-label">Feedback' +
          '<textarea id="protoFeedbackMessage" name="message" required placeholder="I expected… / I got stuck when…"></textarea>' +
        '</label>' +
        '<div class="ProtoFeedback-shot">' +
          '<div class="ProtoFeedback-shotHead">' +
            '<span>Screenshot <span style="font-weight:400;color:#6a708f">(optional)</span></span>' +
          '</div>' +
          '<div class="ProtoFeedback-shotBtns">' +
            '<button type="button" class="ProtoFeedback-shotBtn" id="protoFeedbackShotElement">' +
              '<i class="fa-solid fa-bullseye" aria-hidden="true"></i> Click UI' +
            '</button>' +
            '<button type="button" class="ProtoFeedback-shotBtn" id="protoFeedbackShotPage">' +
              '<i class="fa-solid fa-desktop" aria-hidden="true"></i> Capture page' +
            '</button>' +
          '</div>' +
          '<p class="ProtoFeedback-shotEmpty" id="protoFeedbackShotEmpty">No screenshot — comment still works without one.</p>' +
          '<div class="ProtoFeedback-shotPreview" id="protoFeedbackShotPreview" hidden>' +
            '<img id="protoFeedbackShotImg" alt="Attached UI screenshot" hidden />' +
            '<button type="button" class="ProtoFeedback-shotRemove" id="protoFeedbackShotRemove">Remove</button>' +
          '</div>' +
        '</div>' +
        '<p class="ProtoFeedback-status" id="protoFeedbackStatus" aria-live="polite"></p>' +
        '<div class="ProtoFeedback-actions">' +
          (isInternalViewer()
            ? '<a class="ProtoFeedback-inbox-link" id="protoFeedbackInbox" href="' + hubFeedbackUrl() + '">View thread</a>'
            : '<span class="ProtoFeedback-inbox-link" style="opacity:.75;pointer-events:none">Sent to the team</span>') +
          '<button type="button" class="ProtoFeedback-cancel" id="protoFeedbackCancel">Cancel</button>' +
          '<button type="submit" class="ProtoFeedback-submit" id="protoFeedbackSubmit">Send</button>' +
        '</div>' +
      '</form>';
    document.body.appendChild(panel);

    function setOpen(open) {
      panel.hidden = !open;
      launch.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        var ta = document.getElementById('protoFeedbackMessage');
        if (ta) ta.focus();
      }
    }

    launch.addEventListener('click', function () { setOpen(panel.hidden); });
    document.getElementById('protoFeedbackClose').addEventListener('click', function () { setOpen(false); });
    document.getElementById('protoFeedbackCancel').addEventListener('click', function () { setOpen(false); });

    document.getElementById('protoFeedbackRating').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-rating]');
      if (!btn) return;
      rating = btn.getAttribute('data-rating');
      Array.prototype.forEach.call(document.querySelectorAll('#protoFeedbackRating button'), function (b) {
        b.classList.toggle('is-selected', b === btn);
      });
    });

    document.getElementById('protoFeedbackShotElement').addEventListener('click', function () {
      startElementPick();
    });
    document.getElementById('protoFeedbackShotPage').addEventListener('click', function () {
      setStatus('Capturing page…');
      captureViewport()
        .then(function (dataUrl) {
          setScreenshot(dataUrl);
          setStatus('Screenshot attached (optional — remove anytime).', 'ok');
        })
        .catch(function () {
          setStatus('Couldn’t capture the page.', 'err');
        });
    });
    document.getElementById('protoFeedbackShotRemove').addEventListener('click', function () {
      clearScreenshot();
      setStatus('Screenshot removed.');
    });

    document.getElementById('protoFeedbackForm').addEventListener('submit', function (e) {
      e.preventDefault();
      submitFeedback();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden && !document.getElementById('protoFeedbackPickTip')) {
        setOpen(false);
      }
    });
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setStatus(msg, kind) {
    var el = document.getElementById('protoFeedbackStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'ProtoFeedback-status' + (kind ? ' is-' + kind : '');
  }

  function resetForm() {
    document.getElementById('protoFeedbackMessage').value = '';
    document.getElementById('protoFeedbackName').value = '';
    rating = '';
    clearScreenshot();
    Array.prototype.forEach.call(document.querySelectorAll('#protoFeedbackRating button'), function (b) {
      b.classList.remove('is-selected');
    });
  }

  function submitFeedback() {
    var message = (document.getElementById('protoFeedbackMessage').value || '').trim();
    var name = (document.getElementById('protoFeedbackName').value || '').trim();
    if (!message) {
      setStatus('Please add a short note.', 'err');
      return;
    }

    var meta = pageMeta();
    var payload = {
      prototypeId: prototypeId,
      prototypeTitle: prototypeTitle,
      name: name || 'Anonymous',
      rating: rating || '',
      message: message,
      pageUrl: meta.pageUrl,
      pagePath: meta.pagePath,
      createdAt: meta.timestamp,
      screenshotData: screenshotData || '',
    };

    var submitBtn = document.getElementById('protoFeedbackSubmit');
    submitBtn.disabled = true;
    setStatus('Saving…');

    store.add(payload)
      .then(function (result) {
        var okMsg = result.shared
          ? (result.screenshotSkipped
            ? 'Saved. Screenshot kept on this browser only — run supabase-screenshot.sql to sync images.'
            : 'Saved to this prototype’s thread.')
          : 'Saved on this browser for this prototype.';
        setStatus(okMsg, 'ok');
        resetForm();
        setTimeout(function () {
          document.getElementById('protoFeedbackPanel').hidden = true;
          setStatus('');
        }, 1800);
      })
      .catch(function () {
        setStatus('Couldn’t save. Try again.', 'err');
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  }

  function loadClarity() {
    var id = (cfg.clarityId || '').trim();
    if (!id) return;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', id);
  }

  function boot() {
    loadClarity();
    mount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
