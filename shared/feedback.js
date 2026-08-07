(function () {
  'use strict';
  if (window.__protoFeedbackLoaded) return;
  window.__protoFeedbackLoaded = true;

  var cfg = window.PROTOTYPES_CONFIG || {};
  var store = window.PrototypesFeedbackStore;
  var rating = '';
  var prototypeId = store ? store.resolvePrototypeId() : '';
  var prototypeTitle = store ? store.resolvePrototypeTitle(prototypeId) : document.title;

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
    return base + 'feedback.html?id=' + encodeURIComponent(prototypeId);
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
        '<p class="ProtoFeedback-status" id="protoFeedbackStatus" aria-live="polite"></p>' +
        '<div class="ProtoFeedback-actions">' +
          '<a class="ProtoFeedback-inbox-link" id="protoFeedbackInbox" href="' + hubFeedbackUrl() + '">View thread</a>' +
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

    document.getElementById('protoFeedbackForm').addEventListener('submit', function (e) {
      e.preventDefault();
      submitFeedback();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) setOpen(false);
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
    };

    var submitBtn = document.getElementById('protoFeedbackSubmit');
    submitBtn.disabled = true;
    setStatus('Saving…');

    store.add(payload)
      .then(function (result) {
        var okMsg = result.shared
          ? 'Saved to this prototype’s thread.'
          : 'Saved on this browser for this prototype. Add Supabase in config.js so everyone shares one thread.';
        setStatus(okMsg, 'ok');
        document.getElementById('protoFeedbackMessage').value = '';
        document.getElementById('protoFeedbackName').value = '';
        rating = '';
        Array.prototype.forEach.call(document.querySelectorAll('#protoFeedbackRating button'), function (b) {
          b.classList.remove('is-selected');
        });
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
