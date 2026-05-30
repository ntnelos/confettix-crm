import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rfhdjggnpyzdgzurisup.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmaGRqZ2ducHl6ZGd6dXJpc3VwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTM3NzQ5MCwiZXhwIjoyMDkwOTUzNDkwfQ.gJEXJDzC7nqycMmRwBvQjKQvMDfsW880M-HMgUk-7Rs'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkConstraint() {
  const { data, error } = await supabase.rpc('get_constraint', { constraint_name: 'leads_source_check' })
  console.log('RPC result:', { data, error })
  
  // Alternative if rpc doesn't exist: try querying it or just fetch a single lead to see existing sources
  const { data: leads, error: leadErr } = await supabase.from('leads').select('source').limit(10)
  console.log('Recent lead sources:', [...new Set(leads?.map(l => l.source))])
}

checkConstraint()
