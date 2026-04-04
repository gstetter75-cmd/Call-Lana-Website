// Database Helper Functions — Facade
// Loads modules from js/db/*.js and combines into single clanaDB object
// Depends on: js/db/calls.js, js/db/assistants.js, js/db/profiles.js,
//             js/db/leads.js, js/db/messaging.js, js/db/customers.js, js/db/tools.js
//             (loaded via script tags before this file)
const db = Object.assign({},
  typeof dbCalls !== 'undefined' ? dbCalls : {},
  typeof dbAssistants !== 'undefined' ? dbAssistants : {},
  typeof dbProfiles !== 'undefined' ? dbProfiles : {},
  typeof dbLeads !== 'undefined' ? dbLeads : {},
  typeof dbMessaging !== 'undefined' ? dbMessaging : {},
  typeof dbCustomers !== 'undefined' ? dbCustomers : {},
  typeof dbTools !== 'undefined' ? dbTools : {}
);

// Utility Functions
const utils = {
  async isAuthenticated() {
    const session = await auth.getSession();
    return !!session;
  },

  async requireAuth(redirectUrl = 'login.html') {
    const isAuth = await this.isAuthenticated();
    if (!isAuth) {
      window.location.href = redirectUrl;
      return false;
    }
    return true;
  },

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  },

  sanitizeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  validatePhone(phone) {
    return /^[+]?[\d\s()-]{6,20}$/.test(phone);
  },

  safeTelHref(phone) {
    const clean = (phone || '').replace(/[^+\d\s\-()]/g, '');
    return clean ? 'tel:' + clean : '#';
  },

  safeMailHref(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'mailto:' + email : '#';
  }
};

window.clanaDB = db;
window.clanaUtils = utils;
