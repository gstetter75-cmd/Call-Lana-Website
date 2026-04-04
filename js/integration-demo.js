// Integration Demo Mode — Generates realistic mock data for demonstrations
// Depends on: supabase-init.js
const IntegrationDemo = {
  enabled: false,

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('clana_demo_mode', this.enabled ? '1' : '0');
    if (typeof showToast !== 'undefined') {
      showToast(this.enabled ? 'Demo-Modus aktiviert' : 'Demo-Modus deaktiviert');
    }
    return this.enabled;
  },

  isEnabled() {
    if (this.enabled) return true;
    return localStorage.getItem('clana_demo_mode') === '1';
  },

  // Generate mock calls for dashboard demo
  getMockCalls(count = 10) {
    const outcomes = ['termin', 'info', 'weiterleitung', 'abbruch', 'mailbox'];
    const names = ['Max Müller', 'Anna Schmidt', 'Thomas Weber', 'Lisa Meyer', 'Frank Becker', 'Julia Koch', 'Stefan Schulz', 'Maria Wagner'];
    const phones = ['+49 151 1234', '+49 171 5678', '+49 160 9012', '+49 152 3456', '+49 176 7890'];

    return Array.from({ length: count }, (_, i) => {
      const date = new Date();
      date.setHours(date.getHours() - Math.random() * 48);
      return {
        id: crypto.randomUUID(),
        phone_number: phones[Math.floor(Math.random() * phones.length)] + Math.floor(Math.random() * 1000),
        caller_name: names[Math.floor(Math.random() * names.length)],
        duration: Math.floor(Math.random() * 300) + 30,
        status: 'completed',
        outcome: outcomes[Math.floor(Math.random() * outcomes.length)],
        sentiment_score: Math.round((Math.random() * 3 + 2) * 10) / 10,
        created_at: date.toISOString()
      };
    });
  },

  // Generate mock appointments
  getMockAppointments(count = 5) {
    const names = ['Praxis Dr. Meier', 'Autohaus Schmidt', 'Friseur Elegant', 'Steuerberater Koch', 'Zahnarzt Wagner'];
    return Array.from({ length: count }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + Math.floor(Math.random() * 7));
      date.setHours(9 + Math.floor(Math.random() * 8), Math.random() > 0.5 ? 0 : 30);
      return {
        id: crypto.randomUUID(),
        appointment_date: date.toISOString(),
        customer_name: names[i % names.length],
        phone: '+49 ' + (150 + Math.floor(Math.random() * 30)) + ' ' + Math.floor(Math.random() * 9000000 + 1000000),
        duration_minutes: [15, 30, 45, 60][Math.floor(Math.random() * 4)],
        status: 'confirmed',
        source: 'lana'
      };
    });
  },

  // Generate mock leads for CRM demo
  getMockLeads(count = 8) {
    const companies = ['TechStart GmbH', 'Müller & Söhne', 'Digital Solutions AG', 'Handwerk Plus', 'Praxis am Park', 'Hotel Sonnblick', 'Autohaus Weber', 'Bäckerei Frisch'];
    const contacts = ['Jan Kowalski', 'Sarah Berger', 'Michael Hoffmann', 'Elena Popov', 'David Chen', 'Marie Dupont', 'Ahmed Hassan', 'Lena Braun'];
    const statuses = ['new', 'contacted', 'qualified', 'proposal'];
    const sources = ['Website', 'Empfehlung', 'Messe', 'LinkedIn', 'Google Ads'];

    return Array.from({ length: count }, (_, i) => ({
      id: crypto.randomUUID(),
      company_name: companies[i % companies.length],
      contact_name: contacts[i % contacts.length],
      email: contacts[i % contacts.length].toLowerCase().replace(' ', '.') + '@example.de',
      phone: '+49 ' + (150 + i) + ' ' + (1000000 + i * 111111),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
      value: Math.floor(Math.random() * 50000) + 5000,
      score: Math.floor(Math.random() * 80) + 20,
      created_at: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString()
    }));
  },

  // Generate mock calendar sync events
  getMockCalendarEvents(count = 6) {
    const titles = ['Kundentermin', 'Team Meeting', 'Produktdemo', 'Nachbesprechung', 'Kickoff', 'Review'];
    return Array.from({ length: count }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + Math.floor(Math.random() * 14));
      date.setHours(8 + Math.floor(Math.random() * 10));
      return {
        id: crypto.randomUUID(),
        title: titles[i % titles.length],
        start_at: date.toISOString(),
        end_at: new Date(date.getTime() + 3600000).toISOString(),
        location: ['Büro', 'Zoom', 'Vor Ort', 'Teams'][Math.floor(Math.random() * 4)],
        source: ['google', 'outlook', 'manual'][Math.floor(Math.random() * 3)]
      };
    });
  },

  // Simulate integration sync result
  simulateSync(provider) {
    const results = {
      contacts: Math.floor(Math.random() * 50) + 5,
      appointments: Math.floor(Math.random() * 20),
      duration: (Math.random() * 2 + 0.5).toFixed(1)
    };
    return {
      success: true,
      provider,
      records_synced: results.contacts + results.appointments,
      details: `${results.contacts} Kontakte, ${results.appointments} Termine synchronisiert (${results.duration}s)`
    };
  }
};

window.IntegrationDemo = IntegrationDemo;
