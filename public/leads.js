// Cookieless lead counter. Sends {event, path, href} only. Never reads form fields.
(function () {
  'use strict';

  var ENDPOINT = '/api/lead';

  function classify(href) {
    var raw = String(href || '').trim();
    if (/^tel:/i.test(raw)) return 'tel';
    if (/^mailto:/i.test(raw)) return 'mailto';
    try {
      var url = new URL(raw, location.href);
      var host = (url.hostname || '').toLowerCase();
      if (host === 'calendly.com' || host.endsWith('.calendly.com')) return 'calendly';
    } catch (e) {
      return '';
    }
    return '';
  }

  function send(eventName, href) {
    var payload = JSON.stringify({
      event: eventName,
      path: location.pathname,
      href: href || '',
    });
    try {
      if (typeof navigator.sendBeacon === 'function') {
        var blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon(ENDPOINT, blob)) return;
      }
    } catch (e) {
      // Fall through to fetch.
    }
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
        credentials: 'omit',
      }).catch(function () {});
    } catch (e) {
      // Counting must never affect the page.
    }
  }

  document.addEventListener(
    'click',
    function (event) {
      var node = event.target;
      if (!node || typeof node.closest !== 'function') {
        if (node && node.parentElement) node = node.parentElement;
        else return;
      }
      var link = node.closest ? node.closest('a[href]') : null;
      if (!link) return;
      var kind = classify(link.getAttribute('href') || '');
      if (!kind) return;
      send(kind, link.href || link.getAttribute('href') || '');
    },
    true
  );

  document.addEventListener(
    'submit',
    function (event) {
      var form = event.target;
      if (!form || String(form.tagName || '').toLowerCase() !== 'form') return;
      send('form_submit', form.getAttribute('action') || '');
    },
    true
  );
})();
