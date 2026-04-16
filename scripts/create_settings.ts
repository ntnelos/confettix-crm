import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS system_settings (
        id text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamp with time zone default now()
      );
    `
  })
  
  if (error) {
    // try direct rest API hack if no exec_sql, we'll try to just insert and see if it fails
    const { error: insertErr } = await supabase.from('system_settings').select('*').limit(1)
    if (insertErr) {
       console.log('Error, table does not exist or missing permissions:', insertErr)
    } else {
       console.log('Table exists')
    }
  } else {
    console.log('Created system_settings table')
  }
}
run()
