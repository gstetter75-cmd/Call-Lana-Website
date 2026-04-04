// ==========================================
// Call Lana i18n (Internationalization)
// ==========================================
// Einfaches Multi-Language System ohne Frameworks

const translations = {
  de: {
    // Navigation
    'nav.home': 'Start',
    'nav.features': 'Funktionen',
    'nav.industries': 'Branchen',
    'nav.pricing': 'Preise',
    'nav.contact': 'Kontakt',
    'nav.login': 'Login',
    'nav.cta': 'Jetzt starten',
    'nav.demo': 'Demo buchen',
    'nav.dashboard': 'Zum Dashboard',

    // Hero
    'hero.badge': 'Deine KI-Telefonagentin',
    'hero.title': 'Kein Anruf bleibt<br><span class="gradient">unbeantwortet.</span>',
    'hero.subtitle': 'Entdecke Lana, deine intelligente KI-Telefonagentin.',
    'hero.lead': 'Lana versteht deine Anrufer wirklich – dank NLP und natürlichem Dialog. Kein „Drücken Sie die 1" mehr. Einfach natürlich sprechen, rund um die Uhr, DSGVO-konform.',
    'hero.cta.primary': 'Jetzt kostenlos testen →',
    'hero.cta.secondary': 'Demo anhören',
    'hero.rating': '4,8/5',
    'hero.users': '5.000+ Unternehmen vertrauen Call Lana',

    // Trusted Companies
    'trusted.title': 'Vertraut von führenden Unternehmen',

    // Stats
    'stats.calls': 'Bearbeitete Anrufe',
    'stats.response': 'Durchschn. Reaktionszeit',
    'stats.uptime': 'Verfügbarkeit',
    'stats.setup': 'Setup-Zeit',

    // Steps
    'steps.label': 'So funktioniert\'s',
    'steps.title': 'In 3 Schritten live',
    'steps.subtitle': 'Keine Programmierung, kein IT-Team. Call Lana ist in wenigen Minuten einsatzbereit.',
    'steps.step1.title': 'Rufnummer einrichten',
    'steps.step1.desc': 'Eigene Nummer erhalten oder bestehende weiterleiten. Funktioniert mit jedem Anbieter.',
    'steps.step2.title': 'Lana konfigurieren',
    'steps.step2.desc': 'Branche, Tonfall und Anweisungen festlegen. Lana passt sich deinem Unternehmen an.',
    'steps.step3.title': 'Anrufe entgegennehmen',
    'steps.step3.desc': 'Lana ist live. Alle Anrufe, Transkripte und Aktionen siehst du im Dashboard.',

    // Features (index page cards)
    'features.label': 'Funktionen',
    'features.title': 'Alles, was dein Telefon braucht',
    'features.subtitle': 'Von natürlichem Dialog bis zum CRM-Push – Lana übernimmt den gesamten Anrufprozess.',
    'features.dialog.title': 'Natürlicher Dialog',
    'features.dialog.desc': 'Kein "Drücken Sie die 1". Anrufer sprechen natürlich, Lana versteht dank NLP sofort.',
    'features.booking.title': 'Terminbuchung',
    'features.booking.desc': 'Automatische Kalenderintegration über Cal.com. Termine werden direkt gebucht.',
    'features.dashboard.title': 'Echtzeit-Dashboard',
    'features.dashboard.desc': 'Alle Anrufe, Transkripte und KPIs auf einen Blick. Volle Transparenz.',
    'features.leads.title': 'Lead-Qualifizierung',
    'features.leads.desc': 'Lana erkennt Kaufinteresse und pusht qualifizierte Leads direkt in dein CRM.',
    'features.transcription.title': 'Transkription',
    'features.transcription.desc': 'Jedes Gespräch wird in Echtzeit transkribiert und ist sofort durchsuchbar.',
    'features.transfer.title': 'Weiterleitung',
    'features.transfer.desc': 'Bei komplexen Anfragen leitet Lana nahtlos an den richtigen Mitarbeiter weiter.',

    // Demo
    'demo.title': 'Demo sofort testen',
    'demo.subtitle': 'Ruf unsere Demo-Nummer an und erlebe Call Lana live:',
    'demo.button': 'Kopieren',
    'demo.copied': '✓ Nummer kopiert! Jetzt anrufen.',
    'demo.legal': 'Kostenlos • Keine Registrierung nötig • Sofort verfügbar',

    // Trust & DSGVO
    'trust.label': 'SICHERHEIT & DATENSCHUTZ',
    'trust.title': 'Deine Daten sind bei uns sicher',
    'trust.gdpr.title': 'DSGVO-konform',
    'trust.gdpr.desc': 'Server bei Hetzner in Nürnberg, Deutschland. Volle Datenkontrolle.',
    'trust.encrypt.title': 'Ende-zu-Ende verschlüsselt',
    'trust.encrypt.desc': '256-Bit SSL. Alle Gespräche und Daten sind vollständig verschlüsselt.',
    'trust.euai.title': 'EU AI Act konform',
    'trust.euai.desc': 'OpenAI nur über Microsoft Azure EU-Server. Keine Daten verlassen Europa.',

    // Use-Cases
    'usecases.label': 'Einsatzbereiche',
    'usecases.title': 'Lana passt sich deinem Business an',
    'usecases.subtitle': 'Egal ob Arztpraxis, E-Commerce oder Agentur – Call Lana versteht deinen Alltag.',
    'usecases.medical.title': 'Praxen & Kliniken',
    'usecases.medical.desc': 'Terminbuchung, Rezeptanfragen und Patienteninformation – rund um die Uhr.',
    'usecases.hospitality.title': 'Hotels & Gastronomie',
    'usecases.hospitality.desc': 'Reservierungen, Zimmerverfügbarkeit und Gästeanfragen automatisiert.',
    'usecases.trades.title': 'Handwerk & Service',
    'usecases.trades.desc': 'Auftragsannahme und Terminkoordination – auch wenn du auf der Baustelle bist.',
    'usecases.legal.title': 'Kanzleien & Beratung',
    'usecases.legal.desc': 'Mandantenanfragen erfassen, Rückrufwünsche notieren und priorisieren.',
    'usecases.ecommerce.title': 'E-Commerce & Support',
    'usecases.ecommerce.desc': '24/7 Kundenservice, Bestellstatus und FAQ-Beantwortung ohne Wartezeit.',
    'usecases.sales.title': 'Agenturen & Vertrieb',
    'usecases.sales.desc': 'Lead-Qualifizierung am Telefon und automatischer Push in dein CRM.',

    // Integrations
    'integrations.label': 'INTEGRATIONEN',
    'integrations.title': 'Verbindet sich nahtlos mit deinen Tools',
    'integrations.subtitle': 'Lana arbeitet mit den Tools, die du bereits nutzt.',
    'integrations.more': 'Und viele weitere über Zapier und Make.com',

    // Testimonials
    'testimonials.label': 'Kundenstimmen',
    'testimonials.title': 'Was unsere Kunden sagen',
    'testimonials.t1.text': '"Seit Call Lana verpassen wir keinen einzigen Anruf mehr. Die Terminbuchung läuft vollautomatisch – unsere Patienten sind begeistert."',
    'testimonials.t1.name': 'Dr. Sarah Müller',
    'testimonials.t1.role': 'Zahnärztin, München',
    'testimonials.t2.text': '"Die Lead-Qualifizierung per Telefon hat unsere Conversion um 34% gesteigert. Absolute Game-Changer für unser Sales-Team."',
    'testimonials.t2.name': 'Thomas Weber',
    'testimonials.t2.role': 'CEO, DCR-Agentur',
    'testimonials.t3.text': '"Setup in 20 Minuten, läuft seitdem fehlerfrei. Endlich kann ich mich auf mein Handwerk konzentrieren statt ans Telefon."',
    'testimonials.t3.name': 'Michael Klein',
    'testimonials.t3.role': 'Elektroinstallateur',

    // FAQ
    'faq.label': 'Häufige Fragen',
    'faq.title': 'Alles, was du wissen musst',
    'faq.q1': 'Wie schnell ist Call Lana einsatzbereit?',
    'faq.a1': 'In der Regel dauert das Setup weniger als 30 Minuten. Du erhältst eine eigene Rufnummer, konfigurierst Lana im Dashboard und bist live. Kein IT-Team nötig.',
    'faq.q2': 'Ist Call Lana DSGVO-konform?',
    'faq.a2': 'Ja, vollständig. Unsere Server stehen bei Hetzner in Nürnberg. Alle Daten bleiben in der EU. Wir nutzen OpenAI ausschließlich über Microsoft Azure EU-Server.',
    'faq.q3': 'Welche Sprachen unterstützt Lana?',
    'faq.a3': 'Aktuell Deutsch und Englisch. Weitere Sprachen sind in Planung. Lana erkennt automatisch die Sprache des Anrufers.',
    'faq.q4': 'Was passiert bei komplexen Anfragen?',
    'faq.a4': 'Lana erkennt, wenn ein Gespräch menschliche Betreuung braucht und leitet nahtlos an den zuständigen Mitarbeiter weiter – inklusive Kontext und Zusammenfassung.',
    'faq.q5': 'Kann ich Lana jederzeit kündigen?',
    'faq.a5': 'Ja, alle Pläne sind monatlich kündbar. Keine Mindestlaufzeit, keine versteckten Gebühren.',
    'faq.q6': 'Welche Integrationen gibt es?',
    'faq.a6': 'Direkte Integrationen mit HubSpot, Pipedrive und Cal.com. Über Zapier und Make.com verbindest du Call Lana mit über 5.000 weiteren Tools.',

    // Final CTA
    'finalcta.title': 'Bereit, keinen Anruf mehr zu verpassen?',
    'finalcta.subtitle': 'Starte jetzt kostenlos – keine Kreditkarte, keine Vertragsbindung. 14 Tage testen.',
    'finalcta.primary': 'Kostenlos starten',
    'finalcta.secondary': 'Demo buchen',

    // Features / Teaser Cards
    'feature.quick.title': 'In 30 Minuten live',
    'feature.quick.desc': 'Keine Programmierung. Rufnummer einrichten, Lana konfigurieren, starten.',
    'feature.gdpr.title': '100% DSGVO-konform',
    'feature.gdpr.desc': 'Server in Deutschland. Volle Datenkontrolle. EU AI Act konform.',
    'feature.pricing.title': 'Ab 149€/Monat',
    'feature.pricing.desc': '1.000 Inklusivminuten. Transparent. Fair. Jederzeit kündbar.',

    // Pricing
    'pricing.label': 'Preise',
    'pricing.title': 'Transparent. Fair. Skalierbar.',
    'pricing.title.html': 'Transparent. Fair. <span class="gradient">Skalierbar.</span>',
    'pricing.subtitle': 'Starte ab 149€/Monat und wachse mit Call Lana. Kein Kleingedrucktes, keine versteckten Gebühren.',
    'pricing.monthly': 'Monatlich',
    'pricing.yearly': 'Jährlich',
    'pricing.save': '2 Monate gratis',
    'pricing.popular': 'Beliebteste Wahl',
    'pricing.solo': 'Solo',
    'pricing.team': 'Team',
    'pricing.business': 'Business',
    'pricing.permonth': '/ Monat',
    'pricing.individual': 'Individuell',
    'pricing.onrequest': 'Preis auf Anfrage',
    'pricing.startnow': 'Jetzt starten',
    'pricing.bookdemo': 'Demo buchen',
    'pricing.compare.label': 'Vergleich',
    'pricing.compare.title': 'Alle Features auf einen Blick',
    'pricing.compare.title.html': 'Alle Features <span class="gradient">auf einen Blick</span>',
    'pricing.faq.label': 'Fragen & Antworten',
    'pricing.faq.title': 'Häufige Fragen',
    'pricing.faq.title.html': 'Häufige <span class="gradient">Fragen</span>',
    'pricing.cta.title': 'Starte jetzt – ab 149€/Monat',
    'pricing.cta.title.html': 'Starte jetzt – <span class="gradient">ab 149€/Monat</span>',
    'pricing.cta.subtitle': 'Keine Kreditkarte. Keine Vertragsbindung. Deine KI ist in 30 Minuten live.',
    'pricing.cta.primary': 'Kostenlos starten',
    'pricing.cta.secondary': 'Demo buchen',
    'pricing.monthly.note': 'monatlich kündbar',
    'pricing.yearly.note': 'jährlich abgerechnet, 2 Monate gratis',
    // Solo features
    'pricing.solo.f1': '1.000 Inklusivminuten',
    'pricing.solo.f2': '1 Benutzer',
    'pricing.solo.f3': '1 KI-Stimme wählbar',
    'pricing.solo.f4': 'Eigene Telefonnummer',
    'pricing.solo.f5': 'Basis-Reporting',
    'pricing.solo.f6': 'E-Mail-Support',
    'pricing.solo.f7': 'CRM-Integration',
    'pricing.solo.f8': 'Kalenderanbindung',
    // Team features
    'pricing.team.f1': '3.000 Inklusivminuten',
    'pricing.team.f2': 'Unbegrenzte Benutzer',
    'pricing.team.f3': '5 gleichzeitige Gespräche',
    'pricing.team.f4': 'Alle Stimmen verfügbar',
    'pricing.team.f5': 'Outbound-Anrufe',
    'pricing.team.f6': 'Echtzeit-Reporting & Analytics',
    'pricing.team.f7': 'CRM & Kalender-Integration',
    'pricing.team.f8': 'Priorisierter Support',
    // Business features
    'pricing.business.f1': 'Alles aus Team',
    'pricing.business.f2': 'Eigene KI-Stimme (Custom Voice)',
    'pricing.business.f3': 'SLA-Garantie (99,9 %)',
    'pricing.business.f4': 'Vollständiger API-Zugang',
    'pricing.business.f5': 'Dedizierter Account Manager',
    'pricing.business.f6': 'White-Label Option',
    'pricing.business.f7': 'Custom Integrationen',
    // Comparison table
    'pricing.compare.feature': 'Feature',
    'pricing.compare.minutes': 'Inklusivminuten',
    'pricing.compare.users': 'Benutzer',
    'pricing.compare.concurrent': 'Gleichzeitige Gespräche',
    'pricing.compare.voices': 'KI-Stimmen',
    'pricing.compare.outbound': 'Outbound-Anrufe',
    'pricing.compare.number': 'Eigene Rufnummer',
    'pricing.compare.basicreport': 'Basis-Reporting',
    'pricing.compare.dashboard': 'Echtzeit-Dashboard',
    'pricing.compare.crm': 'CRM-Integration',
    'pricing.compare.calendar': 'Kalenderanbindung',
    'pricing.compare.api': 'API-Zugang',
    'pricing.compare.whitelabel': 'White-Label',
    'pricing.compare.sla': 'SLA-Garantie',
    'pricing.compare.support': 'Support',
    'pricing.compare.unlimited': 'Unbegrenzt',
    'pricing.compare.all': 'Alle',
    'pricing.compare.allcustom': 'Alle + Custom',
    'pricing.compare.email': 'E-Mail',
    'pricing.compare.priority': 'Priorisiert',
    'pricing.compare.dedicated': 'Dediziert',
    // Pricing FAQ
    'pricing.faq.sub': 'Nicht gefunden was du suchst?',
    'pricing.faq.sublink': 'Schreib uns.',
    'pricing.faq.q1': 'Wie schnell kann ich loslegen?',
    'pricing.faq.a1': 'Die KI kann innerhalb weniger Minuten eingestellt werden und ist danach sofort einsatzbereit. Abhängig vom Integrationsaufwand in bestehende Systeme kann es etwas länger dauern – aber in der Regel bist du in unter 30 Minuten live.',
    'pricing.faq.q2': 'Werden meine Daten in der EU gespeichert?',
    'pricing.faq.a2': 'Ja, unsere Server stehen bei Hetzner in Nürnberg, Deutschland. Wir nutzen OpenAI ausschließlich über Microsoft Azure-Server in Europa – vollständig DSGVO- und EU AI Act-konform.',
    'pricing.faq.q3': 'Kann Lana auch ausgehende Anrufe machen?',
    'pricing.faq.a3': 'Ja. Outbound-Anrufe sind im Team- und Business-Tarif enthalten. Über die API oder das Dashboard kann ein Anruf initiiert werden, sobald eine Telefonnummer übermittelt wird. Zusätzlich können Variablen wie Name oder Kontext übergeben werden, um das Gespräch persönlicher zu gestalten.',
    'pricing.faq.q4': 'Was passiert nach den Inklusivminuten?',
    'pricing.faq.a4': 'Zusätzliche Minuten werden zu einem fairen Minutenpreis abgerechnet. Du wirst rechtzeitig benachrichtigt, bevor dein Kontingent aufgebraucht ist – so behältst du immer die volle Kostenkontrolle.',
    'pricing.faq.q5': 'Kann ich meine bestehende Telefonnummer behalten?',
    'pricing.faq.a5': 'Ja. Du kannst entweder eine neue Rufnummer für die KI anlegen oder deine bestehende Nummer über eine Rufumleitung mit Call Lana verbinden – das ist in wenigen Minuten erledigt.',
    'pricing.faq.q6': 'Gibt es eine Testphase?',
    'pricing.faq.a6': 'Ja! Du kannst Call Lana 14 Tage lang kostenlos testen – mit vollem Zugang zu allen Team-Features. Keine Kreditkarte erforderlich. Nach der Testphase wählst du einfach den Tarif, der zu dir passt.',

    // Funktionen page
    'funktionen.hero.label': 'Funktionen',
    'funktionen.hero.title': 'Alles, was deine KI <span class="gradient">leisten kann</span>',
    'funktionen.hero.desc': 'Von der Stimmauswahl bis zum Echtzeit-Dashboard – Call Lana ist von Grund auf so gebaut, dass es in deinen Alltag passt und wirklich hilft.',
    'funktionen.hero.cta': 'Jetzt starten',
    'funktionen.core.label': 'Was Call Lana kann',
    'funktionen.core.title': 'Die wichtigsten <span class="gradient">Funktionen</span>',
    'funktionen.cta.title': 'Alles klar – <span class="gradient">starte jetzt</span>',
    'funktionen.cta.desc': 'Teste Call Lana 14 Tage lang kostenlos. Keine Kreditkarte, keine Vertragsbindung.',

    // Branchen page
    'branchen.hero.label': 'Branchen',
    'branchen.hero.title': 'Call Lana passt sich <span class="gradient">deiner Welt</span> an',
    'branchen.hero.desc': 'Egal ob Arztpraxis, Hotellerie, Handwerk oder Kanzlei – unser KI-Assistent versteht deinen Alltag und entlastet dich dort, wo es am meisten hilft.',
    'branchen.cases.label': 'Anwendungsfälle',
    'branchen.cases.title': 'Wer von <span class="gradient">Call Lana profitiert</span>',
    'branchen.cta.title': 'Für welche Branche <span class="gradient">arbeitest du?</span>',
    'branchen.cta.desc': 'Buche eine persönliche Demo – wir zeigen dir, wie Call Lana genau für deinen Betrieb aussehen würde.',

    // Kontakt page
    'kontakt.hero.label': 'Kontakt',
    'kontakt.hero.title': 'Lass uns <span class="gradient">sprechen</span>',
    'kontakt.hero.desc': 'Demo buchen, Fragen stellen oder direkt loslegen – wir sind für dich da. Antwort innerhalb von 24 Stunden garantiert.',
    'kontakt.form.title': 'Schreib uns',
    'kontakt.form.desc': 'Wir antworten innerhalb von 24 Stunden – versprochen.',
    'kontakt.form.submit': 'Nachricht senden →',

    // Footer
    'footer.product': 'Produkt',
    'footer.legal': 'Rechtliches',
    'footer.account': 'Konto',
    'footer.imprint': 'Impressum',
    'footer.privacy': 'Datenschutz',
    'footer.terms': 'AGB',
    'footer.register': 'Registrieren',
    'footer.login': 'Login',
    'footer.dashboard': 'Dashboard',
    'footer.copyright': 'Copyright 2025 by Call Lana – Alle Rechte vorbehalten',
    'footer.tagline': 'Der KI-Telefonassistent auf Deutsch. DSGVO-konform, skalierbar, sofort einsatzbereit.',

    // Login
    'login.title': 'Willkommen zurück',
    'login.subtitle': 'Noch kein Konto?',
    'login.register': 'Jetzt kostenlos registrieren →',
    'login.email': 'E-Mail-Adresse',
    'login.password': 'Passwort',
    'login.remember': 'Angemeldet bleiben',
    'login.forgot': 'Passwort vergessen?',
    'login.button': 'Zum Dashboard →',
    'login.loading': 'Anmeldung läuft...',

    // Trust badges
    'trust.ssl': '256-Bit SSL',
    'trust.gdpr': 'DSGVO',

    // Dashboard
    'dashboard.logout': 'Abmelden',
  },

  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.features': 'Features',
    'nav.industries': 'Industries',
    'nav.pricing': 'Pricing',
    'nav.contact': 'Contact',
    'nav.login': 'Login',
    'nav.cta': 'Get started',
    'nav.demo': 'Book a demo',
    'nav.dashboard': 'To Dashboard',

    // Hero
    'hero.badge': 'Your AI Phone Agent',
    'hero.title': 'No call goes<br><span class="gradient">unanswered.</span>',
    'hero.subtitle': 'Meet Lana, your intelligent AI phone agent.',
    'hero.lead': 'Lana truly understands your callers – thanks to NLP and natural dialog. No more "press 1". Just speak naturally, 24/7, GDPR-compliant.',
    'hero.cta.primary': 'Try for free →',
    'hero.cta.secondary': 'Listen to Demo',
    'hero.rating': '4.8/5',
    'hero.users': '5,000+ companies trust Call Lana',

    // Trusted Companies
    'trusted.title': 'Trusted by leading companies',

    // Stats
    'stats.calls': 'Processed Calls',
    'stats.response': 'Avg. Response Time',
    'stats.uptime': 'Availability',
    'stats.setup': 'Setup Time',

    // Steps
    'steps.label': 'How it works',
    'steps.title': 'Live in 3 steps',
    'steps.subtitle': 'No programming, no IT team. Call Lana is ready in minutes.',
    'steps.step1.title': 'Set up number',
    'steps.step1.desc': 'Get your own number or forward an existing one. Works with any provider.',
    'steps.step2.title': 'Configure Lana',
    'steps.step2.desc': 'Set industry, tone, and instructions. Lana adapts to your business.',
    'steps.step3.title': 'Start taking calls',
    'steps.step3.desc': 'Lana is live. See all calls, transcripts, and actions in your dashboard.',

    // Features (index page cards)
    'features.label': 'Features',
    'features.title': 'Everything your phone needs',
    'features.subtitle': 'From natural dialog to CRM push – Lana handles the entire call process.',
    'features.dialog.title': 'Natural Dialog',
    'features.dialog.desc': 'No "press 1". Callers speak naturally, Lana understands instantly via NLP.',
    'features.booking.title': 'Appointment Booking',
    'features.booking.desc': 'Automatic calendar integration via Cal.com. Appointments booked directly.',
    'features.dashboard.title': 'Real-time Dashboard',
    'features.dashboard.desc': 'All calls, transcripts, and KPIs at a glance. Full transparency.',
    'features.leads.title': 'Lead Qualification',
    'features.leads.desc': 'Lana detects buying interest and pushes qualified leads directly to your CRM.',
    'features.transcription.title': 'Transcription',
    'features.transcription.desc': 'Every conversation is transcribed in real-time and instantly searchable.',
    'features.transfer.title': 'Call Transfer',
    'features.transfer.desc': 'For complex inquiries, Lana seamlessly transfers to the right team member.',

    // Demo
    'demo.title': 'Test Demo Now',
    'demo.subtitle': 'Call our demo number and experience Call Lana live:',
    'demo.button': 'Copy',
    'demo.copied': '✓ Number copied! Call now.',
    'demo.legal': 'Free • No registration • Available immediately',

    // Trust & DSGVO
    'trust.label': 'SECURITY & DATA PROTECTION',
    'trust.title': 'Your data is safe with us',
    'trust.gdpr.title': 'GDPR-compliant',
    'trust.gdpr.desc': 'Servers at Hetzner in Nuremberg, Germany. Full data control.',
    'trust.encrypt.title': 'End-to-end encrypted',
    'trust.encrypt.desc': '256-bit SSL. All calls and data are fully encrypted.',
    'trust.euai.title': 'EU AI Act compliant',
    'trust.euai.desc': 'OpenAI only via Microsoft Azure EU servers. No data leaves Europe.',

    // Use-Cases
    'usecases.label': 'Use Cases',
    'usecases.title': 'Lana adapts to your business',
    'usecases.subtitle': 'Whether medical practice, e-commerce, or agency – Call Lana understands your day-to-day.',
    'usecases.medical.title': 'Practices & Clinics',
    'usecases.medical.desc': 'Appointment booking, prescription requests, and patient information – around the clock.',
    'usecases.hospitality.title': 'Hotels & Gastronomy',
    'usecases.hospitality.desc': 'Reservations, room availability, and guest inquiries automated.',
    'usecases.trades.title': 'Trades & Services',
    'usecases.trades.desc': 'Order intake and scheduling – even when you are on the job site.',
    'usecases.legal.title': 'Law Firms & Consulting',
    'usecases.legal.desc': 'Capture client inquiries, note callback requests, and prioritize.',
    'usecases.ecommerce.title': 'E-Commerce & Support',
    'usecases.ecommerce.desc': '24/7 customer service, order status, and FAQ answers without wait times.',
    'usecases.sales.title': 'Agencies & Sales',
    'usecases.sales.desc': 'Phone lead qualification and automatic push to your CRM.',

    // Integrations
    'integrations.label': 'INTEGRATIONS',
    'integrations.title': 'Connects seamlessly with your tools',
    'integrations.subtitle': 'Lana works with the tools you already use.',
    'integrations.more': 'And many more via Zapier and Make.com',

    // Testimonials
    'testimonials.label': 'Testimonials',
    'testimonials.title': 'What our customers say',
    'testimonials.t1.text': '"Since Call Lana, we never miss a single call. Appointment booking runs fully automated – our patients love it."',
    'testimonials.t1.name': 'Dr. Sarah Müller',
    'testimonials.t1.role': 'Dentist, Munich',
    'testimonials.t2.text': '"Phone lead qualification increased our conversion by 34%. Absolute game-changer for our sales team."',
    'testimonials.t2.name': 'Thomas Weber',
    'testimonials.t2.role': 'CEO, DCR Agency',
    'testimonials.t3.text': '"Setup in 20 minutes, running flawlessly since. Finally I can focus on my craft instead of the phone."',
    'testimonials.t3.name': 'Michael Klein',
    'testimonials.t3.role': 'Electrician',

    // FAQ
    'faq.label': 'FAQ',
    'faq.title': 'Everything you need to know',
    'faq.q1': 'How quickly is Call Lana ready to use?',
    'faq.a1': 'Setup usually takes less than 30 minutes. You get your own number, configure Lana in the dashboard, and go live. No IT team needed.',
    'faq.q2': 'Is Call Lana GDPR-compliant?',
    'faq.a2': 'Yes, fully. Our servers are at Hetzner in Nuremberg. All data stays in the EU. We use OpenAI exclusively via Microsoft Azure EU servers.',
    'faq.q3': 'What languages does Lana support?',
    'faq.a3': 'Currently German and English. More languages are planned. Lana automatically detects the caller\'s language.',
    'faq.q4': 'What happens with complex inquiries?',
    'faq.a4': 'Lana recognizes when a conversation needs human attention and seamlessly transfers to the right team member – including context and summary.',
    'faq.q5': 'Can I cancel Lana anytime?',
    'faq.a5': 'Yes, all plans are cancelable monthly. No minimum contract, no hidden fees.',
    'faq.q6': 'What integrations are available?',
    'faq.a6': 'Direct integrations with HubSpot, Pipedrive, and Cal.com. Via Zapier and Make.com, you can connect Call Lana with over 5,000 additional tools.',

    // Final CTA
    'finalcta.title': 'Ready to never miss a call again?',
    'finalcta.subtitle': 'Start free now – no credit card, no contract. 14-day trial.',
    'finalcta.primary': 'Start for free',
    'finalcta.secondary': 'Book demo',

    // Features / Teaser Cards
    'feature.quick.title': 'Live in 30 minutes',
    'feature.quick.desc': 'No programming. Set up number, configure Lana, start.',
    'feature.gdpr.title': '100% GDPR-compliant',
    'feature.gdpr.desc': 'Servers in Germany. Full data control. EU AI Act compliant.',
    'feature.pricing.title': 'From €149/month',
    'feature.pricing.desc': '1,000 included minutes. Transparent. Fair. Cancel anytime.',

    // Pricing
    'pricing.label': 'Pricing',
    'pricing.title': 'Transparent. Fair. Scalable.',
    'pricing.title.html': 'Transparent. Fair. <span class="gradient">Scalable.</span>',
    'pricing.subtitle': 'Start from €149/month and grow with Call Lana. No fine print, no hidden fees.',
    'pricing.monthly': 'Monthly',
    'pricing.yearly': 'Yearly',
    'pricing.save': '2 months free',
    'pricing.popular': 'Most Popular',
    'pricing.solo': 'Solo',
    'pricing.team': 'Team',
    'pricing.business': 'Business',
    'pricing.permonth': '/ month',
    'pricing.individual': 'Custom',
    'pricing.onrequest': 'Price on request',
    'pricing.startnow': 'Start now',
    'pricing.bookdemo': 'Book demo',
    'pricing.compare.label': 'Comparison',
    'pricing.compare.title': 'All features at a glance',
    'pricing.compare.title.html': 'All features <span class="gradient">at a glance</span>',
    'pricing.faq.label': 'Questions & Answers',
    'pricing.faq.title': 'Frequently Asked Questions',
    'pricing.faq.title.html': 'Frequently Asked <span class="gradient">Questions</span>',
    'pricing.cta.title': 'Start now – from €149/month',
    'pricing.cta.title.html': 'Start now – <span class="gradient">from €149/month</span>',
    'pricing.cta.subtitle': 'No credit card. No contract. Your AI is live in 30 minutes.',
    'pricing.cta.primary': 'Start for free',
    'pricing.cta.secondary': 'Book demo',
    'pricing.monthly.note': 'cancel monthly',
    'pricing.yearly.note': 'billed annually, 2 months free',
    // Solo features
    'pricing.solo.f1': '1,000 included minutes',
    'pricing.solo.f2': '1 user',
    'pricing.solo.f3': '1 AI voice selectable',
    'pricing.solo.f4': 'Own phone number',
    'pricing.solo.f5': 'Basic reporting',
    'pricing.solo.f6': 'Email support',
    'pricing.solo.f7': 'CRM integration',
    'pricing.solo.f8': 'Calendar integration',
    // Team features
    'pricing.team.f1': '3,000 included minutes',
    'pricing.team.f2': 'Unlimited users',
    'pricing.team.f3': '5 concurrent calls',
    'pricing.team.f4': 'All voices available',
    'pricing.team.f5': 'Outbound calls',
    'pricing.team.f6': 'Real-time reporting & analytics',
    'pricing.team.f7': 'CRM & calendar integration',
    'pricing.team.f8': 'Priority support',
    // Business features
    'pricing.business.f1': 'Everything from Team',
    'pricing.business.f2': 'Custom AI voice',
    'pricing.business.f3': 'SLA guarantee (99.9%)',
    'pricing.business.f4': 'Full API access',
    'pricing.business.f5': 'Dedicated account manager',
    'pricing.business.f6': 'White-label option',
    'pricing.business.f7': 'Custom integrations',
    // Comparison table
    'pricing.compare.feature': 'Feature',
    'pricing.compare.minutes': 'Included minutes',
    'pricing.compare.users': 'Users',
    'pricing.compare.concurrent': 'Concurrent calls',
    'pricing.compare.voices': 'AI voices',
    'pricing.compare.outbound': 'Outbound calls',
    'pricing.compare.number': 'Own phone number',
    'pricing.compare.basicreport': 'Basic reporting',
    'pricing.compare.dashboard': 'Real-time dashboard',
    'pricing.compare.crm': 'CRM integration',
    'pricing.compare.calendar': 'Calendar integration',
    'pricing.compare.api': 'API access',
    'pricing.compare.whitelabel': 'White-label',
    'pricing.compare.sla': 'SLA guarantee',
    'pricing.compare.support': 'Support',
    'pricing.compare.unlimited': 'Unlimited',
    'pricing.compare.all': 'All',
    'pricing.compare.allcustom': 'All + Custom',
    'pricing.compare.email': 'Email',
    'pricing.compare.priority': 'Priority',
    'pricing.compare.dedicated': 'Dedicated',
    // Pricing FAQ
    'pricing.faq.sub': 'Didn\'t find what you\'re looking for?',
    'pricing.faq.sublink': 'Contact us.',
    'pricing.faq.q1': 'How quickly can I get started?',
    'pricing.faq.a1': 'The AI can be set up within minutes and is immediately ready to use. Depending on the integration effort with existing systems, it may take a bit longer – but typically you\'re live in under 30 minutes.',
    'pricing.faq.q2': 'Is my data stored in the EU?',
    'pricing.faq.a2': 'Yes, our servers are located at Hetzner in Nuremberg, Germany. We use OpenAI exclusively via Microsoft Azure servers in Europe – fully GDPR and EU AI Act compliant.',
    'pricing.faq.q3': 'Can Lana also make outbound calls?',
    'pricing.faq.a3': 'Yes. Outbound calls are included in the Team and Business plans. A call can be initiated via the API or dashboard as soon as a phone number is provided. Additionally, variables like name or context can be passed to personalize the conversation.',
    'pricing.faq.q4': 'What happens after the included minutes?',
    'pricing.faq.a4': 'Additional minutes are billed at a fair per-minute rate. You\'ll be notified in time before your allowance runs out – so you always maintain full cost control.',
    'pricing.faq.q5': 'Can I keep my existing phone number?',
    'pricing.faq.a5': 'Yes. You can either create a new number for the AI or connect your existing number via call forwarding with Call Lana – it\'s done in just a few minutes.',
    'pricing.faq.q6': 'Is there a trial period?',
    'pricing.faq.a6': 'Yes! You can try Call Lana free for 14 days – with full access to all Team features. No credit card required. After the trial, simply choose the plan that suits you.',

    // Funktionen page
    'funktionen.hero.label': 'Features',
    'funktionen.hero.title': 'Everything your AI <span class="gradient">can do</span>',
    'funktionen.hero.desc': 'From voice selection to real-time dashboard – Call Lana is built from the ground up to fit your daily workflow and truly help.',
    'funktionen.hero.cta': 'Get started',
    'funktionen.core.label': 'What Call Lana can do',
    'funktionen.core.title': 'The key <span class="gradient">features</span>',
    'funktionen.cta.title': 'All clear – <span class="gradient">start now</span>',
    'funktionen.cta.desc': 'Try Call Lana free for 14 days. No credit card, no contract.',

    // Branchen page
    'branchen.hero.label': 'Industries',
    'branchen.hero.title': 'Call Lana adapts to <span class="gradient">your world</span>',
    'branchen.hero.desc': 'Whether medical practice, hospitality, trades, or law firm – our AI assistant understands your daily routine and helps where it matters most.',
    'branchen.cases.label': 'Use Cases',
    'branchen.cases.title': 'Who benefits from <span class="gradient">Call Lana</span>',
    'branchen.cta.title': 'Which industry <span class="gradient">are you in?</span>',
    'branchen.cta.desc': 'Book a personal demo – we\'ll show you how Call Lana would look for your business.',

    // Kontakt page
    'kontakt.hero.label': 'Contact',
    'kontakt.hero.title': 'Let\'s <span class="gradient">talk</span>',
    'kontakt.hero.desc': 'Book a demo, ask questions, or get started right away – we\'re here for you. Response within 24 hours guaranteed.',
    'kontakt.form.title': 'Write to us',
    'kontakt.form.desc': 'We respond within 24 hours – promised.',
    'kontakt.form.submit': 'Send message →',

    // Footer
    'footer.product': 'Product',
    'footer.legal': 'Legal',
    'footer.account': 'Account',
    'footer.imprint': 'Imprint',
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Terms',
    'footer.register': 'Register',
    'footer.login': 'Login',
    'footer.dashboard': 'Dashboard',
    'footer.copyright': 'Copyright 2025 by Call Lana – All rights reserved',
    'footer.tagline': 'AI phone assistant in German. GDPR-compliant, scalable, ready to use.',

    // Login
    'login.title': 'Welcome back',
    'login.subtitle': "Don't have an account?",
    'login.register': 'Register for free →',
    'login.email': 'Email address',
    'login.password': 'Password',
    'login.remember': 'Stay logged in',
    'login.forgot': 'Forgot password?',
    'login.button': 'To Dashboard →',
    'login.loading': 'Logging in...',

    // Trust badges
    'trust.ssl': '256-Bit SSL',
    'trust.gdpr': 'GDPR',

    // Dashboard
    'dashboard.logout': 'Logout',
  }
};

// ==========================================
// Simple i18n Class
// ==========================================
class I18n {
  constructor() {
    this.currentLang = localStorage.getItem('calllana_language') || 'de';
    document.documentElement.lang = this.currentLang;
  }

  setLanguage(lang) {
    if (!translations[lang]) lang = 'de';
    this.currentLang = lang;
    localStorage.setItem('calllana_language', lang);
    document.documentElement.lang = lang;
    this.translatePage();
  }

  t(key) {
    return translations[this.currentLang]?.[key] || translations['de']?.[key] || key;
  }

  translatePage() {
    // Safe: use textContent by default
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      el.textContent = this.t(key);
    });

    // Explicit: use innerHTML only for keys that contain trusted HTML (e.g. gradient spans)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.dataset.i18nHtml;
      el.innerHTML = this.t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      el.placeholder = this.t(key);
    });

    // Toggle .lang-de / .lang-en visibility (used by design pages)
    document.querySelectorAll('.lang-de').forEach(el => el.classList.toggle('hidden', this.currentLang !== 'de'));
    document.querySelectorAll('.lang-en').forEach(el => el.classList.toggle('hidden', this.currentLang !== 'en'));

    // Update language switcher buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === this.currentLang);
    });
  }
}

const i18n = new I18n();

document.addEventListener('DOMContentLoaded', () => {
  i18n.translatePage();
});

window.i18n = i18n;
