// «Собери с ИИ» landing: attribution, first-party analytics, 2-step application, sticky CTA.
// No framework, no dependencies. Works without third-party analytics (ad blockers are common).
(function () {
  'use strict';

  var cfgEl = document.getElementById('cfg');
  var cfg = cfgEl ? JSON.parse(cfgEl.textContent || '{}') : {};
  var lang = cfg.lang || 'ru';
  var i18n = cfg.i18n || { errors: {} };
  var loadedAt = Date.now();

  // ── Storage (private mode / blocked storage must never break the page) ─────────────────────
  function get(store, key) {
    try {
      return window[store].getItem(key);
    } catch (e) {
      return null;
    }
  }
  function set(store, key, value) {
    try {
      window[store].setItem(key, value);
    } catch (e) {}
  }
  function getJson(store, key) {
    try {
      return JSON.parse(get(store, key) || 'null');
    } catch (e) {
      return null;
    }
  }

  function randomId() {
    var bytes = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  var anonId = get('localStorage', 'sci_aid');
  if (!anonId || !/^[A-Za-z0-9_-]{8,64}$/.test(anonId)) {
    anonId = randomId();
    set('localStorage', 'sci_aid', anonId);
  }

  // ── Attribution: first touch (kept 90 days) and last touch ─────────────────────────────────
  var REFERRERS = [
    [/(^|\.)instagram\.com$/, 'instagram', 'social'],
    [/(^|\.)facebook\.com$/, 'facebook', 'social'],
    [/(^|\.)tiktok\.com$/, 'tiktok', 'social'],
    [/(^|\.)t\.me$|telegram\./, 'telegram', 'social'],
    [/(^|\.)youtube\.com$|youtu\.be$/, 'youtube', 'social'],
    [/whatsapp|wa\.me$/, 'whatsapp', 'social'],
    [/(^|\.)google\./, 'google', 'organic'],
    [/(^|\.)yandex\./, 'yandex', 'organic'],
    [/(^|\.)threads\.net$/, 'threads', 'social'],
  ];

  function currentTouch() {
    var q = new URLSearchParams(location.search);
    var touch = {
      source: q.get('utm_source') || undefined,
      medium: q.get('utm_medium') || undefined,
      campaign: q.get('utm_campaign') || undefined,
      content: q.get('utm_content') || undefined,
      term: q.get('utm_term') || undefined,
      clickId: q.get('fbclid') || q.get('ttclid') || q.get('gclid') || q.get('yclid') || undefined,
      landing: location.pathname,
      ts: new Date().toISOString(),
    };
    if (!touch.source) {
      if (q.get('ttclid')) touch.source = 'tiktok';
      else if (q.get('gclid')) (touch.source = 'google'), (touch.medium = touch.medium || 'cpc');
      else if (q.get('yclid')) (touch.source = 'yandex'), (touch.medium = touch.medium || 'cpc');
      else if (q.get('fbclid')) touch.source = 'meta';
    }
    var ref = document.referrer;
    if (ref) {
      try {
        var host = new URL(ref).hostname.replace(/^www\./, '');
        if (host !== location.hostname) {
          touch.referrer = ref.slice(0, 300);
          if (!touch.source) {
            touch.source = host;
            touch.medium = 'referral';
            for (var i = 0; i < REFERRERS.length; i++) {
              if (REFERRERS[i][0].test(host)) {
                touch.source = REFERRERS[i][1];
                touch.medium = REFERRERS[i][2];
                break;
              }
            }
          }
        }
      } catch (e) {}
    }
    return touch;
  }

  var touch = currentTouch();
  var first = getJson('localStorage', 'sci_ft');
  var expired = first && first.ts && Date.now() - Date.parse(first.ts) > 90 * 864e5;
  if (!first || expired) {
    first = touch;
    set('localStorage', 'sci_ft', JSON.stringify(first));
  }
  var last = getJson('localStorage', 'sci_lt') || first;
  if (touch.source) {
    last = touch;
    set('localStorage', 'sci_lt', JSON.stringify(last));
  }
  var refCode = new URLSearchParams(location.search).get('ref');
  if (refCode && /^[a-z0-9]{4,12}$/i.test(refCode)) set('localStorage', 'sci_ref', refCode.toLowerCase());
  refCode = get('localStorage', 'sci_ref');

  // ── Tracking ───────────────────────────────────────────────────────────────────────────────
  // These are recorded server-side by the API already; the browser only forwards them to ad pixels.
  var SERVER_SIDE = { lead_created: 1, application_submitted: 1, qualified_lead: 1 };

  function track(name, props) {
    if (!SERVER_SIDE[name]) beacon(name, props);
    // Ad pixels / product analytics (public/js/analytics.js drains this queue).
    (window.sciQ = window.sciQ || []).push([name, props || {}]);
    if (window.sciVendors) window.sciVendors.flush();
  }

  function beacon(name, props) {
    var body = JSON.stringify({ name: name, anonId: anonId, path: location.pathname, props: props || {}, attribution: { first: first } });
    try {
      if (!navigator.sendBeacon || !navigator.sendBeacon('/api/event', new Blob([body], { type: 'application/json' }))) {
        fetch('/api/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true });
      }
    } catch (e) {}
  }
  window.sciTrack = track;

  track('page_view', { lang: lang, ref: document.referrer ? 1 : 0 });

  // Telegram links carry the browser id so bot conversations are attributed to the right ad.
  if (cfg.bot) {
    var tgLinks = document.querySelectorAll('a[data-tg]');
    for (var t = 0; t < tgLinks.length; t++) tgLinks[t].href = 'https://t.me/' + cfg.bot + '?start=w_' + anonId;
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('a,button');
    if (!el) return;
    if (el.dataset.cta) track('cta_click', { loc: el.dataset.cta });
    if (el.hasAttribute('data-tg') || el.id === 'tg-go') track('tg_click', { loc: el.dataset.cta || 'link' });
    if ((el.getAttribute('href') || '').indexOf('https://wa.me') === 0) track('wa_click', { loc: el.dataset.cta || 'link' });
    if (el.dataset.track === 'lang') track('lang_switch', { to: lang === 'ru' ? 'kk' : 'ru' });
    if (el.dataset.track === 'nav') track('nav_click', { to: el.getAttribute('href') });
  });

  var details = document.querySelectorAll('details[data-track]');
  for (var d = 0; d < details.length; d++) {
    details[d].addEventListener('toggle', function (ev) {
      var node = ev.currentTarget;
      if (!node.open) return;
      if (node.dataset.track === 'faq') track('faq_open', { q: Number(node.dataset.q) });
      if (node.dataset.track === 'program') track('program_open', { week: Number(node.dataset.week) });
    });
  }

  var video = document.querySelector('.video video');
  if (video) video.addEventListener('play', function () { track('video_play', {}); }, { once: true });

  if ('IntersectionObserver' in window) {
    var pricing = document.querySelector('[data-view="pricing"]');
    if (pricing) {
      var seen = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          track('view_pricing', {});
          seen.disconnect();
        }
      }, { threshold: 0.5 });
      seen.observe(pricing);
    }

    // Sticky CTA: visible after the hero, hidden while the application form is on screen.
    var sticky = document.getElementById('sticky-cta');
    var hero = document.querySelector('.hero');
    var apply = document.getElementById('apply');
    if (sticky && hero && apply) {
      var heroVisible = true;
      var applyVisible = false;
      var update = function () { sticky.classList.toggle('show', !heroVisible && !applyVisible); };
      new IntersectionObserver(function (en) { heroVisible = en[0].isIntersecting; update(); }).observe(hero);
      new IntersectionObserver(function (en) { applyVisible = en[0].isIntersecting; update(); }).observe(apply);
    }
  }

  // ── Application: step 1 (name + phone) → step 2 (4 taps) → Telegram ─────────────────────────
  var form = document.getElementById('lead-form');
  if (!form) return;
  var quiz = document.getElementById('quiz');
  var success = document.getElementById('success');
  var submitBtn = form.querySelector('button[type="submit"]');
  var formError = form.querySelector('.form-error');
  var quizError = quiz.querySelector('.form-error');
  var questions = quiz.querySelectorAll('.quiz-q');
  var bars = quiz.querySelectorAll('.quiz-progress i');
  var backBtn = quiz.querySelector('.quiz-back');
  var state = getJson('sessionStorage', 'sci_app') || {};
  var answers = state.answers || {};
  var current = 0;
  var started = false;

  function save() { set('sessionStorage', 'sci_app', JSON.stringify(state)); }

  form.addEventListener('focusin', function () {
    if (started) return;
    started = true;
    track('form_start', {});
  });

  function fieldError(name, message) {
    var input = form.elements[name];
    var box = document.getElementById('e-' + name);
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (box) box.textContent = message || '';
  }

  function phoneLooksValid(raw) {
    var digits = raw.replace(/\D/g, '');
    if (/^\s*\+/.test(raw) && digits.charAt(0) !== '7') return digits.length >= 8 && digits.length <= 15;
    return digits.length === 10 || (digits.length === 11 && /^[78]/.test(digits));
  }

  function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        json.status = res.status;
        return json;
      });
    });
  }

  function errorText(status, code) {
    if (status === 429) return i18n.errors.rate;
    if (code === 'phone') return i18n.errors.phone;
    if (code === 'name') return i18n.errors.name;
    return i18n.errors.generic;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.elements.name.value.trim();
    var phone = form.elements.phone.value.trim();
    fieldError('name', name ? '' : i18n.errors.name);
    fieldError('phone', phoneLooksValid(phone) ? '' : i18n.errors.phone);
    formError.textContent = '';
    if (!name) return form.elements.name.focus();
    if (!phoneLooksValid(phone)) {
      track('form_error', { field: 'phone' });
      return form.elements.phone.focus();
    }
    submitBtn.disabled = true;
    submitBtn.textContent = i18n.sending;
    post('/api/lead', {
      name: name,
      phone: phone,
      lang: lang,
      anonId: anonId,
      attribution: { first: first, last: last },
      ref: refCode || undefined,
      website: form.elements.website.value,
      elapsedMs: Date.now() - loadedAt,
    })
      .then(function (res) {
        if (!res.ok) {
          if (res.error === 'phone' || res.error === 'name') fieldError(res.error, errorText(res.status, res.error));
          else formError.textContent = errorText(res.status, res.error);
          track('form_error', { field: res.error || 'server' });
          return;
        }
        state = { token: res.token, tg: res.tg, answers: {} };
        answers = state.answers;
        save();
        track('lead_created', { eventId: res.token + ':lead' });
        showQuiz(0);
      })
      .catch(function () {
        formError.textContent = i18n.errors.network;
      })
      .then(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.label;
      });
  });

  function showQuiz(index) {
    form.hidden = true;
    quiz.hidden = false;
    current = index;
    for (var i = 0; i < questions.length; i++) {
      questions[i].hidden = i !== index;
      bars[i].classList.toggle('on', i <= index);
      var chosen = answers[questions[i].dataset.q];
      var opts = questions[i].querySelectorAll('.option');
      for (var j = 0; j < opts.length; j++) opts[j].setAttribute('aria-pressed', String(opts[j].dataset.v === chosen));
    }
    backBtn.hidden = index === 0;
    var firstOption = questions[index].querySelector('.option');
    if (firstOption && document.activeElement && document.activeElement !== document.body) firstOption.focus({ preventScroll: true });
  }

  quiz.addEventListener('click', function (e) {
    var opt = e.target.closest('.option');
    if (!opt || opt.disabled) return;
    var q = opt.closest('.quiz-q').dataset.q;
    answers[q] = opt.dataset.v;
    save();
    track('quiz_answer', { q: q, v: opt.dataset.v });
    var opts = opt.parentNode.querySelectorAll('.option');
    for (var j = 0; j < opts.length; j++) opts[j].setAttribute('aria-pressed', String(opts[j] === opt));
    if (current < questions.length - 1) {
      setTimeout(function () { showQuiz(current + 1); }, 160);
    } else {
      submitApplication();
    }
  });

  backBtn.addEventListener('click', function () {
    if (current > 0) showQuiz(current - 1);
  });

  function setOptionsDisabled(disabled) {
    var all = quiz.querySelectorAll('.option');
    for (var i = 0; i < all.length; i++) all[i].disabled = disabled;
  }

  function submitApplication() {
    quizError.textContent = '';
    setOptionsDisabled(true);
    post('/api/application', { token: state.token, answers: answers })
      .then(function (res) {
        if (!res.ok) {
          quizError.textContent = errorText(res.status, res.error);
          return;
        }
        state.done = res.tier;
        state.tg = res.tg || state.tg;
        save();
        track('application_submitted', { tier: res.tier, eventId: state.token + ':app' });
        if (res.tier === 'hot') track('qualified_lead', { eventId: state.token + ':qualified' });
        showSuccess(res.tier);
      })
      .catch(function () {
        quizError.textContent = i18n.errors.network;
      })
      .then(function () {
        setOptionsDisabled(false);
      });
  }

  function showSuccess(tier) {
    form.hidden = true;
    quiz.hidden = true;
    success.hidden = false;
    var blocks = success.querySelectorAll('[data-tier]');
    for (var i = 0; i < blocks.length; i++) blocks[i].hidden = blocks[i].dataset.tier !== tier;
    var go = document.getElementById('tg-go');
    if (go && state.tg) go.href = state.tg;
    success.focus({ preventScroll: true });
  }

  // Resume after a reload in the same tab.
  if (state.token && state.done) showSuccess(state.done);
  else if (state.token) {
    var next = 0;
    while (next < questions.length - 1 && answers[questions[next].dataset.q]) next++;
    showQuiz(next);
  }
})();
