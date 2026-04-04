-- =============================================
-- Call Lana: Lead Scoring + Email Templates + Onboarding
-- =============================================

-- Lead scoring columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score integer DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_factors jsonb DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);

-- Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  category text DEFAULT 'general',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_email_templates" ON email_templates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('sales', 'superadmin'))
  );

CREATE POLICY "manage_email_templates" ON email_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('sales', 'superadmin'))
  );

-- Seed default templates
INSERT INTO email_templates (name, subject, body, category) VALUES
  ('Follow-up nach Demo', 'Ihr Call Lana Demo-Gespräch – nächste Schritte', 'Hallo {{kontakt}},

vielen Dank für das angenehme Gespräch zur Vorstellung von Call Lana für {{firma}}.

Wie besprochen fasse ich hier die wichtigsten Punkte zusammen:
- [Punkt 1]
- [Punkt 2]

Gerne können wir einen Folgetermin vereinbaren. Wann passt es Ihnen?

Beste Grüße', 'follow_up'),
  ('Angebot senden', 'Ihr individuelles Angebot von Call Lana', 'Hallo {{kontakt}},

wie besprochen sende ich Ihnen hiermit unser Angebot für {{firma}}.

Plan: {{plan}}
Monatlicher Preis: {{preis}} € netto

Bei Fragen stehe ich Ihnen gerne zur Verfügung.

Beste Grüße', 'proposal'),
  ('Willkommen als Kunde', 'Willkommen bei Call Lana, {{firma}}!', 'Hallo {{kontakt}},

herzlich willkommen bei Call Lana! Wir freuen uns, {{firma}} als neuen Kunden begrüßen zu dürfen.

Ihre nächsten Schritte:
1. Loggen Sie sich in Ihr Dashboard ein
2. Erstellen Sie Ihren ersten KI-Assistenten
3. Weisen Sie eine Telefonnummer zu

Bei Fragen sind wir jederzeit für Sie da.

Beste Grüße', 'welcome'),
  ('Nachfassen – kein Kontakt', 'Kurze Rückfrage zu Call Lana', 'Hallo {{kontakt}},

ich wollte kurz nachfragen, ob Sie noch Interesse an Call Lana für {{firma}} haben.

Gerne zeige ich Ihnen in einem kurzen Gespräch (15 Min.), wie andere Unternehmen aus der Branche {{branche}} Call Lana erfolgreich einsetzen.

Wann hätten Sie Zeit?

Beste Grüße', 'follow_up')
ON CONFLICT DO NOTHING;

-- Onboarding Progress
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  completed_at timestamptz DEFAULT now(),
  UNIQUE (user_id, step_key)
);

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_onboarding" ON onboarding_progress
  FOR ALL USING (user_id = auth.uid());
