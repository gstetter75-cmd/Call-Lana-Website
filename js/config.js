// Shared configuration for all dashboards
const CONFIG = {
  // Reads from shared PRICING object if available, otherwise fallback values
  PLANS: typeof PRICING !== 'undefined' ? {
    starter:      { label: 'Starter',      price: PRICING.plans.starter.monthly },
    professional: { label: 'Professional', price: PRICING.plans.professional.monthly },
    business:     { label: 'Business',     price: PRICING.plans.business.monthly || 599 },
    solo:         { label: 'Starter',      price: PRICING.plans.starter.monthly },
    team:         { label: 'Professional', price: PRICING.plans.professional.monthly },
  } : {
    starter:      { label: 'Starter',      price: 149 },
    professional: { label: 'Professional', price: 299 },
    business:     { label: 'Business',     price: 599 },
    solo:         { label: 'Starter',      price: 149 },
    team:         { label: 'Professional', price: 299 },
  },

  COMMISSION_RATE: 0.05,

  CUSTOMER_STATUSES: {
    active:   { label: 'Aktiv',        color: '#10b981' },
    inactive: { label: 'Inaktiv',      color: '#f59e0b' },
    churned:  { label: 'Abgewandert',  color: '#ef4444' }
  },

  CALL_DIRECTIONS: {
    inbound:  { label: 'Eingehend', icon: '↙' },
    outbound: { label: 'Ausgehend', icon: '↗' }
  },

  CALL_OUTCOMES: {
    reached:   { label: 'Erreicht' },
    voicemail: { label: 'Mailbox' },
    no_answer: { label: 'Nicht erreicht' },
    busy:      { label: 'Besetzt' },
    callback:  { label: 'Rückruf' },
    follow_up: { label: 'Follow-up' }
  },

  INDUSTRIES: {
    handwerk:       'Handwerk',
    immobilien:     'Immobilien',
    gesundheit:     'Gesundheit & Praxis',
    recht:          'Rechtsanwälte & Kanzleien',
    auto:           'Autohandel & Werkstatt',
    gastronomie:    'Gastronomie & Hotel',
    ecommerce:      'E-Commerce',
    dienstleistung: 'Dienstleistung',
    it:             'IT & Software',
    sonstige:       'Sonstige'
  },

  HEALTH_THRESHOLDS: { good: 70, warning: 40 },

  getPlanPrice(plan) {
    const key = (plan || 'starter').toLowerCase();
    return (this.PLANS[key] || this.PLANS.starter).price;
  },

  getPlanLabel(plan) {
    const key = (plan || 'starter').toLowerCase();
    return (this.PLANS[key] || this.PLANS.starter).label;
  },

  getHealthColor(score) {
    if (score >= this.HEALTH_THRESHOLDS.good) return '#10b981';
    if (score >= this.HEALTH_THRESHOLDS.warning) return '#f59e0b';
    return '#ef4444';
  },

  getIndustryLabel(key) {
    return this.INDUSTRIES[key] || key || '—';
  }
};

window.CONFIG = CONFIG;
