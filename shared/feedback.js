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

  // Only on prototype pages (not hub / inbox)
  if (!prototypeId || /\/feedback\.html$/i.test(location.pathname)) return;

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

  function startElementPick() {
    var panel = document.getElementById('protoFeedbackPanel');
    var launch = document.getElementById('protoFeedbackLaunch');
    if (panel) panel.hidden = true;
    if (launch) launch.style.display = 'none';

    var tip = document.createElement('div');
    tip.className = 'ProtoFeedback-pickTip';
    tip.id = 'protoFeedbackPickTip';
    tip.innerHTML = '<strong>Click the UI</strong> you’re referring to · Esc to cancel';
    document.body.appendChild(tip);

    var hoverEl = null;
    function onMove(e) {
      var el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === tip || tip.contains(el)) return;
      if (hoverEl === el) return;
      if (hoverEl) hoverEl.classList.remove('ProtoFeedback-pickTarget');
      hoverEl = el;
      hoverEl.classList.add('ProtoFeedback-pickTarget');
    }

    function cleanup() {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      if (hoverEl) hoverEl.classList.remove('ProtoFeedback-pickTarget');
      if (tip.parentNode) tip.parentNode.removeChild(tip);
      if (launch) launch.style.display = '';
      if (panel) panel.hidden = false;
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
      var el = e.target;
      if (el === tip || tip.contains(el)) return;
      cleanup();
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
