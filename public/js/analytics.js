// Third-party analytics, loaded only for the vendors whose IDs are set in the environment.
// Funnel events from app.js are mapped to each vendor's standard events so ad platforms can
// optimise for *qualified* applications, not just raw leads.
(function () {
  'use strict';

  var cfgEl = document.getElementById('cfg');
  var cfg = cfgEl ? JSON.parse(cfgEl.textContent || '{}') : {};
  var a = cfg.analytics || {};
  var anonId = null;
  try {
    anonId = localStorage.getItem('sci_aid');
  } catch (e) {}

  function load(src) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  // PostHog: product funnels + session replay. distinct id = our anon id, so server-side
  // bot/payment events land on the same person.
  if (a.posthogKey) {
    var ph = (window.posthog = window.posthog || []);
    ph._i = ph._i || [];
    ph.init = function (key, opts) {
      ['capture', 'register', 'identify', 'reset', 'opt_out_capturing'].forEach(function (m) {
        ph[m] = function () {
          ph.push([m].concat(Array.prototype.slice.call(arguments)));
        };
      });
      ph._i.push([key, opts, 'posthog']);
    };
    ph.__SV = 1;
    ph.init(a.posthogKey, {
      api_host: a.posthogHost,
      person_profiles: 'always',
      bootstrap: anonId ? { distinctID: anonId } : undefined,
      capture_pageview: true,
    });
    load(a.posthogHost.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js');
  }

  if (a.metaPixelId) {
    var fbq = (window.fbq = function () {
      fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
    });
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    load('https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', a.metaPixelId);
    fbq('track', 'PageView');
  }

  if (a.tiktokPixelId) {
    var ttq = (window.ttq = window.ttq || []);
    window.TiktokAnalyticsObject = 'ttq';
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
    ttq.setAndDefer = function (t, e) {
      t[e] = function () {
        t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
      };
    };
    for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.load = function (id) {
      var url = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i = ttq._i || {};
      ttq._i[id] = [];
      ttq._i[id]._u = url;
      ttq._t = ttq._t || {};
      ttq._t[id] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[id] = {};
      load(url + '?sdkid=' + id + '&lib=ttq');
    };
    ttq.load(a.tiktokPixelId);
    ttq.page();
  }

  if (a.yandexMetricaId) {
    window.ym =
      window.ym ||
      function () {
        (window.ym.a = window.ym.a || []).push(arguments);
      };
    window.ym.l = +new Date();
    load('https://mc.yandex.ru/metrika/tag.js');
    window.ym(Number(a.yandexMetricaId), 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  }

  if (a.ga4Id) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', a.ga4Id);
    load('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(a.ga4Id));
  }

  // Funnel event → vendor event names.
  var MAP = {
    lead_created: { fb: ['track', 'Lead'], tt: 'SubmitForm', ym: 'lead', ga: 'generate_lead' },
    application_submitted: { fb: ['track', 'CompleteRegistration'], tt: 'CompleteRegistration', ym: 'application', ga: 'sign_up' },
    qualified_lead: { fb: ['trackCustom', 'QualifiedLead'], tt: 'QualifiedLead', ym: 'qualified', ga: 'qualify_lead' },
    tg_click: { fb: ['track', 'Contact'], tt: 'Contact', ym: 'telegram', ga: 'contact' },
    wa_click: { fb: ['track', 'Contact'], tt: 'Contact', ym: 'whatsapp', ga: 'contact' },
    view_pricing: { fb: ['track', 'ViewContent'], tt: 'ViewContent', ym: 'pricing', ga: 'view_item' },
    cta_click: { ym: 'cta' },
  };

  function send(name, props) {
    if (window.posthog && window.posthog.capture && name !== 'page_view') window.posthog.capture(name, props);
    var m = MAP[name];
    if (!m) return;
    var opts = props && props.eventId ? { eventID: props.eventId } : undefined;
    if (m.fb && window.fbq) window.fbq(m.fb[0], m.fb[1], {}, opts);
    if (m.tt && window.ttq) window.ttq.track(m.tt, {}, props && props.eventId ? { event_id: props.eventId } : undefined);
    if (m.ym && window.ym) window.ym(Number(a.yandexMetricaId), 'reachGoal', m.ym);
    if (m.ga && window.gtag) window.gtag('event', m.ga, {});
  }

  window.sciVendors = {
    flush: function () {
      var q = window.sciQ || [];
      while (q.length) {
        var item = q.shift();
        try {
          send(item[0], item[1]);
        } catch (e) {}
      }
    },
  };
  window.sciVendors.flush();
})();
