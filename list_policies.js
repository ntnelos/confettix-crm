const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://rfhdjggnpyzdgzurisup.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmaGRqZ2ducHl6ZGd6dXJpc3VwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTM3NzQ5MCwiZXhwIjoyMDkwOTUzNDkwfQ.gJEXJDzC7nqycMmRwBvQjKQvMDfsW880M-HMgUk-7Rs'; // service role

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('get_policies_exec_fallback');
  if (error) {
    // try direct REST if it exists
    const res = await fetch(`${supabaseUrl}/rest/v1/pg_policies?select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    const txt = await res.text();
    console.log(txt)
  } else {
    console.log(data);
  }
}
run();
