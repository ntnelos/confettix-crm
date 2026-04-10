ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS company_number text,
ADD COLUMN IF NOT EXISTS industry text,
ADD COLUMN IF NOT EXISTS website text;

-- Fix delivery_addresses policies just in case
ALTER TABLE delivery_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active users can manage delivery addrs" ON delivery_addresses;
CREATE POLICY "delivery_addresses_select"  ON delivery_addresses FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "delivery_addresses_insert"  ON delivery_addresses FOR INSERT  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "delivery_addresses_update"  ON delivery_addresses FOR UPDATE  USING (auth.uid() IS NOT NULL);
CREATE POLICY "delivery_addresses_delete"  ON delivery_addresses FOR DELETE  USING (auth.uid() IS NOT NULL);
