// Homepage scripts — extracted from index.html for maintainability

// === PRICING ===
// Pricing toggle — reads from shared PRICING object (js/pricing-data.js)
    var _billing = 'monthly';
    var _pricingData = {
      monthly: typeof PRICING !== 'undefined' ? PRICING.getBillingData('monthly') : { lite: '149 €', pro: '299 €', liteOld: '', proOld: '', periodLabel: '/Monat', note: '' },
      yearly:  typeof PRICING !== 'undefined' ? PRICING.getBillingData('yearly')  : { lite: '129 €', pro: '249 €', liteOld: '149 €', proOld: '299 €', periodLabel: '/Monat', note: '' }
    };
    function setBilling(mode) {
      _billing = mode;
      var d = _pricingData[mode];
      var elPL = document.getElementById('price-lite');
      var elPP = document.getElementById('price-pro');
      var elOldL = document.getElementById('price-old-lite');
      var elOldP = document.getElementById('price-old-pro');
      var elPerL = document.getElementById('period-lite');
      var elPerP = document.getElementById('period-pro');
      var elNote = document.getElementById('billingNote');
      if (elPL) elPL.textContent = d.lite;
      if (elPP) elPP.textContent = d.pro;
      if (elOldL) { elOldL.textContent = d.liteOld; elOldL.classList.toggle('hidden', !d.liteOld); }
      if (elOldP) { elOldP.textContent = d.proOld; elOldP.classList.toggle('hidden', !d.proOld); }
      if (elPerL) elPerL.textContent = d.periodLabel;
      if (elPerP) elPerP.textContent = d.periodLabel;
      if (elNote) elNote.textContent = d.note;
      var bM = document.getElementById('btnMonthly');
      var bY = document.getElementById('btnYearly');
      if (bM && bY) {
        bM.classList.toggle('active', mode === 'monthly');
        bY.classList.toggle('active', mode === 'yearly');
      }
    }

// === CALC ===
(function initCalc() {
    var callsSlider = document.getElementById('calc-calls');
    var durationSlider = document.getElementById('calc-duration');
    var callsVal = document.getElementById('calc-calls-val');
    var durationVal = document.getElementById('calc-duration-val');
    var employeeEl = document.getElementById('calc-employee');
    var lanaEl = document.getElementById('calc-lana');
    var savingsEl = document.getElementById('calc-savings');
    if (!callsSlider || !durationSlider) return;

    var HOURLY_COST = 120; // €/hour fully loaded employee cost (salary + overhead)
    var WORKDAYS = 22;
    // Call Lana pricing tiers based on minutes — must match actual plan prices
    function getLanaCost(totalMinutes) {
      var starterMin = (typeof PRICING !== 'undefined') ? PRICING.plans.starter.minutes : 300;
      var proMin     = (typeof PRICING !== 'undefined') ? PRICING.plans.professional.minutes : 800;
      if (totalMinutes <= starterMin) return 149;  // Starter plan
      if (totalMinutes <= proMin) return 299;       // Professional plan
      return 299 + Math.ceil((totalMinutes - proMin) / 100) * 50; // Pro + overages
    }

    function update() {
      var calls = parseInt(callsSlider.value);
      var duration = parseInt(durationSlider.value);
      callsVal.textContent = calls;
      durationVal.textContent = duration;
      var totalMinutesMonth = calls * duration * WORKDAYS;
      var totalHoursMonth = totalMinutesMonth / 60;
      var employeeCost = Math.round(totalHoursMonth * HOURLY_COST);
      var lanaCost = getLanaCost(totalMinutesMonth);
      var savings = Math.max(0, employeeCost - lanaCost);
      employeeEl.textContent = employeeCost.toLocaleString('de-DE') + ' €';
      lanaEl.textContent = lanaCost + ' €';
      savingsEl.textContent = savings.toLocaleString('de-DE') + ' €';
    }
    callsSlider.addEventListener('input', update);
    durationSlider.addEventListener('input', update);
    update();
  })();

// === SCROLLREVEAL ===
/* ===== SCROLL REVEAL ===== */
  (function initScrollReveal() {
    // Auto-add scroll-reveal to section headers and cards that don't already have it
    document.querySelectorAll('section .text-center.mb-12, section .text-center.mb-10, section .text-center.mb-16').forEach(function(el) {
      if (!el.classList.contains('scroll-reveal')) el.classList.add('scroll-reveal');
    });
    var cards = document.querySelectorAll('.feature-card:not(.step-item .feature-card), .testimonial-card, .stat-item, .faq-item, .pricing-card');
    cards.forEach(function(el, i) {
      if (!el.classList.contains('scroll-reveal')) {
        el.classList.add('scroll-reveal');
        if (!el.hasAttribute('data-reveal-delay')) {
          el.setAttribute('data-reveal-delay', String((i % 4) + 1));
        }
      }
    });

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.scroll-reveal').forEach(function(el) {
      observer.observe(el);
    });
  })();

// === WAVEFORM ===
(function() {
    var container = document.getElementById('heroBg');
    if (!container) return;
    function createPathGroup(position) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 696 316');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      svg.style.position = 'absolute';
      svg.style.inset = '0';
      for (var i = 0; i < 36; i++) {
        var p = position;
        var d = 'M-' + (380 - i * 5 * p) + ' -' + (189 + i * 6) +
                'C-' + (380 - i * 5 * p) + ' -' + (189 + i * 6) +
                ' -' + (312 - i * 5 * p) + ' ' + (216 - i * 6) +
                ' ' + (152 - i * 5 * p) + ' ' + (343 - i * 6) +
                'C' + (616 - i * 5 * p) + ' ' + (470 - i * 6) +
                ' ' + (684 - i * 5 * p) + ' ' + (875 - i * 6) +
                ' ' + (684 - i * 5 * p) + ' ' + (875 - i * 6);
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', 'rgba(124,58,237,' + (0.04 + i * 0.008) + ')');
        path.setAttribute('stroke-width', (0.5 + i * 0.03).toFixed(2));
        path.setAttribute('stroke-dasharray', '0.8 1.2');
        path.setAttribute('pathLength', '2');
        path.style.setProperty('--dur', (20 + Math.random() * 10).toFixed(1) + 's');
        svg.appendChild(path);
      }
      container.appendChild(svg);
    }
    createPathGroup(1);
    createPathGroup(-1);
  })();

// === LAZYSPLINE ===
// Disabled — hero now uses pure CSS visual, no Spline viewer in DOM.
// Re-enable if spline-viewer is reintroduced to the hero container.
(function lazySpline() {
    if (!document.querySelector('spline-viewer')) return;
    var container = document.querySelector('.robot-container');
    if (!container) return;
    var loaded = false;
    var observer = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting && !loaded) {
        loaded = true;
        observer.disconnect();
        var s = document.createElement('script');
        s.type = 'module';
        s.src = 'https://unpkg.com/@splinetool/viewer@1.9.82/build/spline-viewer.js';
        s.onerror = function() { document.querySelectorAll('spline-viewer').forEach(function(el){el.remove()}); };
        document.head.appendChild(s);
      }
    }, { rootMargin: '200px' });
    observer.observe(container);
  })();

// === SPLINESETUP ===
(function splineSetup() {
    try {
    var viewer = document.querySelector('spline-viewer');
    if (!viewer) return;

    var heroSection = viewer.closest('section');
    var robotContainer = viewer.closest('.robot-container');
    var logo = document.getElementById('robotLogo');
    var canvas = null;
    var ready = false;

    // ── Safety timeout: if Spline hasn't loaded after 15s, remove it ──
    var safetyTimeout = setTimeout(function() {
      if (!ready && viewer && viewer.parentNode) {
        console.warn('Spline viewer did not load in time — removing to unblock page.');
        viewer.remove();
      }
    }, 15000);

    // ── 1. Shadow DOM: remove branding, contain canvas, allow pointermove ──
    function patchShadow(sr) {
      try {
        var style = document.createElement('style');
        style.textContent = [
          '#logo, a[href*="spline"], [id*="logo"] { display:none!important; visibility:hidden!important; }',
          'canvas { position:absolute!important; inset:0!important; width:100%!important; height:100%!important; max-width:100%!important; max-height:100%!important; }',
          ':host { overflow:hidden!important; }'
        ].join('\n');
        sr.appendChild(style);
        sr.querySelectorAll('#logo, a[href*="spline"], [id*="logo"]').forEach(function(el) { el.remove(); });
        canvas = sr.querySelector('canvas');
        if (canvas) { ready = true; clearTimeout(safetyTimeout); var fb = document.getElementById('splineFallback'); if (fb) fb.style.display = 'none'; }
      } catch(e) { /* ignore shadow DOM errors */ }
    }

    var attempts = 0;
    var patchInterval = setInterval(function() {
      try {
        attempts++;
        if (viewer.shadowRoot) {
          patchShadow(viewer.shadowRoot);
          if (ready) clearInterval(patchInterval);
        }
        if (attempts > 30) clearInterval(patchInterval);
      } catch(e) { clearInterval(patchInterval); }
    }, 500);

    // ── 2. Mouse relay: forward mousemove to the Spline canvas ──
    function relayMove(e) {
      try {
        if (!canvas) {
          if (viewer.shadowRoot) canvas = viewer.shadowRoot.querySelector('canvas');
          if (!canvas) return;
        }
        canvas.style.pointerEvents = 'auto';
        var synthetic = new PointerEvent('pointermove', {
          clientX: e.clientX,
          clientY: e.clientY,
          screenX: e.screenX,
          screenY: e.screenY,
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'mouse'
        });
        canvas.dispatchEvent(synthetic);
        requestAnimationFrame(function() {
          if (canvas) canvas.style.pointerEvents = 'none';
        });
      } catch(e) { /* ignore relay errors */ }
    }

    if (heroSection) {
      heroSection.addEventListener('mousemove', relayMove, { passive: true });
    }

    // ── 3. Logo: fades in, then tracks torso rotation via mouse ──
    if (logo) {
      var ZOOM_DURATION_MS = 3000;
      var FADE_DELAY_MS = 500;

      // Badge transform state — tracks torso rotation
      var badgeRotY = 0;
      var badgeRotX = 0;
      var badgeOffX = 0;
      var badgeOffY = 0;
      var targetRotY = 0;
      var targetRotX = 0;
      var targetOffX = 0;
      var targetOffY = 0;

      // How much the badge moves / rotates with cursor (matches torso feel)
      var TORSO_ROT_RANGE = 12;   // degrees Y rotation (torso turn)
      var TORSO_TILT_RANGE = 5;   // degrees X rotation (slight tilt)
      var TORSO_SHIFT_RANGE = 8;  // pixels lateral shift
      var CHEST_OFFSET_Z = 30;    // badge sits 30px in front of rotation axis (chest depth)

      var cachedRect = null;
      function updateBadgeOnMouseMove(e) {
        if (!robotContainer) return;
        if (!cachedRect) cachedRect = robotContainer.getBoundingClientRect();
        var rect = cachedRect;
        // Restart animation loop if it stopped due to convergence
        if (!badgeRaf) badgeRaf = requestAnimationFrame(animateBadge);
        // Normalized -1 to 1 from container center
        var nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        var ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        // Clamp
        nx = Math.max(-1, Math.min(1, nx));
        ny = Math.max(-1, Math.min(1, ny));
        // Torso follows cursor direction
        targetRotY = nx * TORSO_ROT_RANGE;
        targetRotX = -ny * TORSO_TILT_RANGE;
        targetOffX = nx * TORSO_SHIFT_RANGE;
        targetOffY = ny * (TORSO_SHIFT_RANGE * 0.3);
      }

      var badgeRaf;
      var EPSILON = 0.01;
      function animateBadge() {
        badgeRotY += (targetRotY - badgeRotY) * 0.08;
        badgeRotX += (targetRotX - badgeRotX) * 0.08;
        badgeOffX += (targetOffX - badgeOffX) * 0.08;
        badgeOffY += (targetOffY - badgeOffY) * 0.08;
        logo.style.transform = 'translate3d(' + badgeOffX.toFixed(2) + 'px,' + badgeOffY.toFixed(2) + 'px,' + CHEST_OFFSET_Z + 'px) rotateY(' + badgeRotY.toFixed(2) + 'deg) rotateX(' + badgeRotX.toFixed(2) + 'deg)';
        // Stop loop when values converge to save CPU
        if (Math.abs(targetRotY - badgeRotY) < EPSILON && Math.abs(targetRotX - badgeRotX) < EPSILON && Math.abs(targetOffX - badgeOffX) < EPSILON && Math.abs(targetOffY - badgeOffY) < EPSILON) {
          badgeRaf = null;
          return;
        }
        badgeRaf = requestAnimationFrame(animateBadge);
      }

      window.addEventListener('resize', function() { cachedRect = null; }, { passive: true });

      setTimeout(function() {
        logo.style.opacity = '0.9';
        if (heroSection) {
          heroSection.addEventListener('mousemove', updateBadgeOnMouseMove, { passive: true });
        }
        animateBadge();
      }, ZOOM_DURATION_MS + FADE_DELAY_MS);
    }

    // ── 4. Performance: reduce work when off-screen ──
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) {
          if (canvas) canvas.style.willChange = 'auto';
          if (badgeRaf) { cancelAnimationFrame(badgeRaf); badgeRaf = null; }
        } else {
          if (canvas) canvas.style.willChange = 'transform';
          if (logo && !badgeRaf) animateBadge();
        }
      });
    }, { threshold: 0 });
    io.observe(viewer);

    } catch(err) {
      // If splineSetup crashes, just log it — the page must always render
      console.warn('Spline setup failed:', err);
      var failedViewer = document.querySelector('spline-viewer');
      if (failedViewer) failedViewer.remove();
    }
  })();

