const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  // Try to push an SQL RPC if available, or just throw it via a manual query
  const res1 = await supa.rpc('execute_sql', { sql: 'ALTER TABLE delivery_addresses ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE;' })
  const res2 = await supa.rpc('execute_sql', { sql: 'ALTER TABLE delivery_addresses ALTER COLUMN organization_id DROP NOT NULL;' })
  console.log("RPC Res:", res1, res2)
}
run()
