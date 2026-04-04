/* ===== SHARED COMPONENTS: Nav, Footer, Language Switcher, Mobile Menu ===== */

(function() {
  const currentPage = location.pathname.split('/').pop().replace('.html','') || 'index';

  // ===== TRANSLATIONS =====
  const T = {
    'nav.funktionen': { de: 'Funktionen', en: 'Features' },
    'nav.branchen': { de: 'Branchen', en: 'Industries' },
    'nav.preise': { de: 'Preise', en: 'Pricing' },
    'nav.kontakt': { de: 'Kontakt', en: 'Contact' },
    'nav.login': { de: 'Anmelden', en: 'Login' },
    'nav.demo': { de: 'Demo buchen', en: 'Book a demo' },
    'nav.register': { de: 'Jetzt starten', en: 'Get started' },
    'footer.product': { de: 'Produkt', en: 'Product' },
    'footer.company': { de: 'Unternehmen', en: 'Company' },
    'footer.legal': { de: 'Rechtliches', en: 'Legal' },
    'footer.about': { de: 'Über uns', en: 'About us' },
    'footer.blog': { de: 'Blog', en: 'Blog' },
    'footer.careers': { de: 'Karriere', en: 'Careers' },
    'footer.privacy': { de: 'Datenschutzerklärung', en: 'Privacy Policy' },
    'footer.terms': { de: 'AGB', en: 'Terms' },
    'footer.imprint': { de: 'Impressum', en: 'Imprint' },
    'footer.desc': { de: 'Die KI-Telefonassistentin für Handwerker, die keinen Anruf verpasst.', en: 'The AI phone assistant for craftsmen that never misses a call.' },
    'footer.rights': { de: '© 2026 Call Lana. Alle Rechte vorbehalten.', en: '© 2026 Call Lana. All rights reserved.' },
    'footer.howit': { de: "So funktioniert's", en: 'How it works' },
    'footer.register': { de: 'Registrierung', en: 'Register' },
    'footer.login': { de: 'Login', en: 'Login' },
    'footer.dashboard': { de: 'Dashboard', en: 'Dashboard' },
    'footer.account': { de: 'Konto', en: 'Account' },
  };

  let lang = 'de'; // German only

  function t(key) { return T[key] ? (T[key][lang] || T[key].de) : key; }

  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (T[key]) el.textContent = t(key);
    });
    // Update lang buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    // Toggle lang-de / lang-en blocks
    document.querySelectorAll('.lang-de').forEach(el => el.classList.toggle('hidden', lang !== 'de'));
    document.querySelectorAll('.lang-en').forEach(el => el.classList.toggle('hidden', lang !== 'en'));
  }

  function setLang(l) {
    lang = l;
    localStorage.setItem('cl-lang', l);
    applyLang();
  }

  // ===== NAV =====
  function isActive(page) { return currentPage === page ? 'text-brand-400' : 'text-gray-600'; }

  function renderNav() {
    const nav = document.getElementById('nav-container');
    if (!nav) return;
    nav.innerHTML = `
    <nav class="fixed top-0 left-0 right-0 z-50 bg-white/92 backdrop-blur-md" style="border-bottom: 1px solid rgba(124,58,237,0.08); box-shadow: 0 1px 12px rgba(124,58,237,0.04);">
      <div class="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between h-20">
        <a href="index.html" class="flex items-center focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-4 rounded group">
          <img src="brand_assets/A_vector-style_digital_logo_for_the_brand_Clana_.png" alt="Call Lana Logo" class="h-[5.5rem] sm:h-[6.5rem] w-auto" style="filter: drop-shadow(0 2px 8px rgba(124,58,237,0.18)); margin-top: 0.25rem; margin-bottom: -0.5rem;" />
        </a>
        <div class="hidden lg:flex items-center gap-7">
          <a href="funktionen.html" class="nav-link text-sm font-medium ${isActive('funktionen')}" data-i18n="nav.funktionen">${t('nav.funktionen')}</a>
          <a href="branchen.html" class="nav-link text-sm font-medium ${isActive('branchen')}" data-i18n="nav.branchen">${t('nav.branchen')}</a>
          <a href="preise.html" class="nav-link text-sm font-medium ${isActive('preise')}" data-i18n="nav.preise">${t('nav.preise')}</a>
          <a href="kontakt.html" class="nav-link text-sm font-medium ${isActive('kontakt')}" data-i18n="nav.kontakt">${t('nav.kontakt')}</a>
        </div>
        <div class="flex items-center gap-3">
          <a href="login.html" class="hidden md:inline-block nav-link text-sm font-medium ${isActive('login')}" data-i18n="nav.login">${t('nav.login')}</a>
          <a href="demo.html" class="btn-outline px-4 py-2 rounded-lg text-sm font-semibold hidden sm:inline-block" data-i18n="nav.demo">${t('nav.demo')}</a>
          <a href="registrierung.html" class="btn-brand px-5 py-2 rounded-lg text-sm font-semibold hidden sm:inline-block" data-i18n="nav.register">${t('nav.register')}</a>
          <!-- Mobile hamburger -->
          <button id="menuToggle" class="lg:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-400" aria-label="Menu">
            <span class="w-5 h-0.5 bg-gray-600 rounded"></span>
            <span class="w-5 h-0.5 bg-gray-600 rounded"></span>
            <span class="w-5 h-0.5 bg-gray-600 rounded"></span>
          </button>
        </div>
      </div>
    </nav>
    <!-- Mobile Menu -->
    <div id="mobileMenu" class="mobile-menu fixed inset-0 z-[60] bg-white/98 backdrop-blur-lg flex flex-col pt-20 px-8">
      <button id="menuClose" class="absolute top-5 right-6 text-gray-600 hover:text-gray-900 p-2" aria-label="Close menu">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
      <div class="flex flex-col gap-6 text-lg font-semibold font-display">
        <a href="funktionen.html" class="nav-link text-gray-700" data-i18n="nav.funktionen">${t('nav.funktionen')}</a>
        <a href="branchen.html" class="nav-link text-gray-700" data-i18n="nav.branchen">${t('nav.branchen')}</a>
        <a href="preise.html" class="nav-link text-gray-700" data-i18n="nav.preise">${t('nav.preise')}</a>
        <a href="kontakt.html" class="nav-link text-gray-700" data-i18n="nav.kontakt">${t('nav.kontakt')}</a>
        <a href="login.html" class="nav-link text-gray-700" data-i18n="nav.login">${t('nav.login')}</a>
        <a href="demo.html" class="btn-outline text-center px-6 py-3 rounded-xl font-bold mt-4" data-i18n="nav.demo">${t('nav.demo')}</a>
        <a href="registrierung.html" class="btn-brand text-center px-6 py-3 rounded-xl font-bold mt-2" data-i18n="nav.register">${t('nav.register')}</a>
      </div>
    </div>`;

    // Mobile menu toggle
    const toggle = document.getElementById('menuToggle');
    const menu = document.getElementById('mobileMenu');
    const close = document.getElementById('menuClose');
    if (toggle && menu) {
      toggle.addEventListener('click', () => menu.classList.add('open'));
      close.addEventListener('click', () => menu.classList.remove('open'));
      menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));
    }
  }

  // ===== FOOTER =====
  function renderFooter() {
    const footer = document.getElementById('footer-container');
    if (!footer) return;
    footer.innerHTML = `
    <section class="relative py-10 bg-white border-t border-gray-200">
      <div class="max-w-4xl mx-auto px-6">
        <div class="flex items-center gap-4 justify-center text-center md:text-left md:justify-start">
          <div class="w-10 h-10 rounded-xl bg-brand-400/10 flex items-center justify-center shrink-0"><span class="text-lg">&#x1f512;</span></div>
          <p class="text-gray-500 text-sm" style="line-height:1.7;">
            <strong class="text-gray-700 lang-de">Deine Daten sind sicher</strong><strong class="text-gray-700 lang-en hidden">Your data is safe</strong> —
            <span class="lang-de">Alle Gespräche werden auf deutschen Servern verarbeitet und gespeichert. DSGVO-konform nach deutschem Recht.</span>
            <span class="lang-en hidden">All calls are processed and stored on German servers. GDPR-compliant under German law.</span>
          </p>
        </div>
      </div>
    </section>
    <footer class="relative py-16 noise-overlay border-t border-gray-200 bg-section-light">
      <div class="relative z-10 max-w-6xl mx-auto px-6">
        <div class="grid md:grid-cols-4 gap-10 mb-12">
          <div class="md:col-span-1">
            <div class="flex items-center mb-4">
              <img src="brand_assets/A_vector-style_digital_logo_for_the_brand_Clana_.png" alt="Call Lana Logo" class="h-14 w-auto" style="filter: drop-shadow(0 2px 6px rgba(124,58,237,0.12));" />
            </div>
            <p class="text-gray-500 text-sm" style="line-height:1.7;" data-i18n="footer.desc">${t('footer.desc')}</p>
          </div>
          <div>
            <h4 class="font-display text-sm font-semibold text-gray-900 mb-4" data-i18n="footer.product">${t('footer.product')}</h4>
            <ul class="space-y-2">
              <li><a href="funktionen.html" class="nav-link text-gray-500 text-sm" data-i18n="nav.funktionen">${t('nav.funktionen')}</a></li>
              <li><a href="branchen.html" class="nav-link text-gray-500 text-sm" data-i18n="nav.branchen">${t('nav.branchen')}</a></li>
              <li><a href="preise.html" class="nav-link text-gray-500 text-sm" data-i18n="nav.preise">${t('nav.preise')}</a></li>
              <li><a href="kontakt.html" class="nav-link text-gray-500 text-sm" data-i18n="nav.kontakt">${t('nav.kontakt')}</a></li>
            </ul>
          </div>
          <div>
            <h4 class="font-display text-sm font-semibold text-gray-900 mb-4" data-i18n="footer.account">${t('footer.account')}</h4>
            <ul class="space-y-2">
              <li><a href="registrierung.html" class="nav-link text-gray-500 text-sm" data-i18n="footer.register">${t('footer.register')}</a></li>
              <li><a href="login.html" class="nav-link text-gray-500 text-sm" data-i18n="footer.login">${t('footer.login')}</a></li>
              <li><a href="dashboard.html" class="nav-link text-gray-500 text-sm" data-i18n="footer.dashboard">${t('footer.dashboard')}</a></li>
            </ul>
          </div>
          <div>
            <h4 class="font-display text-sm font-semibold text-gray-900 mb-4" data-i18n="footer.legal">${t('footer.legal')}</h4>
            <ul class="space-y-2">
              <li><a href="datenschutz.html" class="nav-link text-gray-500 text-sm" data-i18n="footer.privacy">${t('footer.privacy')}</a></li>
              <li><a href="agb.html" class="nav-link text-gray-500 text-sm" data-i18n="footer.terms">${t('footer.terms')}</a></li>
              <li><a href="impressum.html" class="nav-link text-gray-500 text-sm" data-i18n="footer.imprint">${t('footer.imprint')}</a></li>
            </ul>
          </div>
        </div>
        <div class="pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p class="text-gray-400 text-xs" data-i18n="footer.rights">${t('footer.rights')}</p>
          <div class="flex items-center gap-4">
            <a href="#" class="text-gray-400 hover:text-brand-400 focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-3 rounded transition-colors duration-200" aria-label="LinkedIn">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
            <a href="#" class="text-gray-400 hover:text-brand-400 focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-3 rounded transition-colors duration-200" aria-label="Twitter">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="#" class="text-gray-400 hover:text-brand-400 focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-3 rounded transition-colors duration-200" aria-label="Instagram">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>`;
  }

  // ===== INIT =====
  window.__setLang = setLang;
  window.__lang = () => lang;

  function initScrollReveal() {
    document.querySelectorAll('section .text-center.mb-12, section .text-center.mb-10, section .text-center.mb-16').forEach(function(el) {
      if (!el.classList.contains('scroll-reveal')) el.classList.add('scroll-reveal');
    });
    document.querySelectorAll('.feature-card, .testimonial-card, .stat-item, .faq-item, .pricing-card').forEach(function(el, i) {
      if (!el.classList.contains('scroll-reveal')) {
        el.classList.add('scroll-reveal');
        if (!el.hasAttribute('data-reveal-delay')) el.setAttribute('data-reveal-delay', String((i % 4) + 1));
      }
    });
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.scroll-reveal').forEach(function(el) { observer.observe(el); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderNav();
    renderFooter();
    applyLang();
    initScrollReveal();
  });
})();
