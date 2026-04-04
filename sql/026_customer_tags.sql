-- =============================================
-- Call Lana: Customer Tags for Segmentation
-- =============================================

CREATE TABLE IF NOT EXISTS customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text DEFAULT '#7c3aed',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_tag_assignments (
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES customer_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, tag_id)
);

ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tag_assignments ENABLE ROW LEVEL SECURITY;

-- Tags: readable by sales+superadmin, writable by superadmin
CREATE POLICY "read_tags" ON customer_tags FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('sales', 'superadmin'))
);
CREATE POLICY "manage_tags" ON customer_tags FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
);

-- Tag assignments: manageable by sales+superadmin
CREATE POLICY "manage_tag_assignments" ON customer_tag_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('sales', 'superadmin'))
);
