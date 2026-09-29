/*
 * Derive landing page behavior. Progressive enhancement only: every section
 * is readable, and every CTA is truthful, if this file never runs.
 */
(function () {
  'use strict';

  var config = window.DERIVE_SITE || {};
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Availability and CTAs ---------- */
  function applyAvailability() {
    var url = config.appStoreUrl;
    var live = config.availability === 'available' && typeof url === 'string' && /^https:\/\/apps\.apple\.com\//.test(url);
    if (!live) return; // HTML already ships the coming-soon state.

    document.querySelectorAll('[data-cta="primary"], [data-cta="final"], [data-cta="header"]').forEach(function (el) {
      el.textContent = el.getAttribute('data-available-label') || el.textContent;
      el.setAttribute('href', url);
      el.setAttribute('rel', 'noopener');
      el.hidden = false;
    });
    document.querySelectorAll('[data-availability-note]').forEach(function (el) {
      el.textContent = el.getAttribute('data-available-text') || el.textContent;
    });
    var qr = document.querySelector('[data-qr]');
    if (qr && config.appStoreQrSrc) {
      var img = qr.querySelector('[data-qr-img]');
      img.src = config.appStoreQrSrc;
      img.alt = 'QR code for the Derive App Store page';
      qr.hidden = false;
    }
  }

  /* ---------- Header hairline on scroll ---------- */
  function initHeader() {
    var header = document.querySelector('[data-header]');
    if (!header) return;
    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
    document.body.prepend(sentinel);
    new IntersectionObserver(function (entries) {
      header.toggleAttribute('data-scrolled', !entries[0].isIntersecting);
    }).observe(sentinel);
  }

  /* ---------- B. Capture-to-result demonstration ---------- */
  function initDemo() {
    var demo = document.querySelector('[data-demo]');
    if (!demo) return;
    var steps = Array.prototype.slice.call(demo.querySelectorAll('[data-step-target]'));
    var toggle = demo.querySelector('[data-demo-toggle]');
    var STEP_MS = [0, 2600, 4200, 4200, 5600]; // indexed by step; longer where there is more to read
    var current = 1;
    var timer = null;
    var playing = false;
    var userPaused = false;
    var inView = false;

    demo.classList.add('is-enhanced');

    function show(step) {
      current = step;
      demo.setAttribute('data-step', String(step));
      demo.style.setProperty('--step-ms', STEP_MS[step] + 'ms');
      steps.forEach(function (btn) {
        var active = Number(btn.getAttribute('data-step-target')) === step;
        if (active) btn.setAttribute('aria-current', 'step');
        else btn.removeAttribute('aria-current');
      });
      // Restart the progress hairline for the newly active step.
      var active = demo.querySelector('[aria-current="step"]');
      if (active) { active.style.animation = 'none'; void active.offsetWidth; active.style.animation = ''; }
    }

    function schedule() {
      clearTimeout(timer);
      if (!playing) return;
      timer = setTimeout(function () {
        show(current === 4 ? 1 : current + 1);
        schedule();
      }, STEP_MS[current]);
    }

    function setPlaying(next) {
      playing = next;
      demo.classList.toggle('is-playing', next);
      if (toggle) {
        toggle.textContent = next ? 'Pause' : 'Play';
        toggle.setAttribute('aria-pressed', next ? 'false' : 'true');
        toggle.setAttribute('aria-label', next ? 'Pause the example' : 'Play the example');
      }
      schedule();
    }

    function sync() {
      // Autoplay only while visible, never under reduced motion, never after a pause.
      setPlaying(inView && !userPaused && !reduceMotion.matches && !document.hidden);
    }

    steps.forEach(function (btn) {
      btn.addEventListener('click', function () {
        userPaused = true;
        show(Number(btn.getAttribute('data-step-target')));
        sync();
      });
    });

    if (toggle) {
      toggle.hidden = reduceMotion.matches;
      toggle.addEventListener('click', function () {
        userPaused = playing;
        if (!userPaused && current === 4) show(1);
        sync();
      });
    }

    reduceMotion.addEventListener && reduceMotion.addEventListener('change', function () {
      if (toggle) toggle.hidden = reduceMotion.matches;
      sync();
    });
    document.addEventListener('visibilitychange', sync);

    show(1);
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.35 }).observe(demo);
  }

  /* ---------- C. Product details / example profile ---------- */
  function initCompare() {
    var root = document.querySelector('[data-compare]');
    if (!root) return;
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    var panels = { facts: root.querySelector('[data-panel="facts"]'), profile: root.querySelector('[data-panel="profile"]') };

    root.classList.add('is-enhanced');

    function select(view, focus) {
      root.setAttribute('data-view', view);
      tabs.forEach(function (tab) {
        var on = tab.getAttribute('aria-controls') === panels[view].id;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
        if (on && focus) tab.focus();
      });
      Object.keys(panels).forEach(function (key) {
        var hide = key !== view;
        panels[key].toggleAttribute('data-hidden', hide);
        panels[key].toggleAttribute('inert', hide);
        panels[key].setAttribute('aria-hidden', hide ? 'true' : 'false');
      });
    }

    tabs.forEach(function (tab, index) {
      var view = tab.id === 'tab-facts' ? 'facts' : 'profile';
      tab.addEventListener('click', function () { select(view, false); });
      tab.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
        event.preventDefault();
        var next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        select(tabs[next].id === 'tab-facts' ? 'facts' : 'profile', true);
      });
    });

    select('facts', false);
  }

  function init() {
    applyAvailability();
    initHeader();
    initDemo();
    initCompare();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
