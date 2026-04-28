require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.from('opportunities').select('id, status').eq('status', 'won');
  console.log(`Remaining "won" count: ${data ? data.length : error}`);
}
run();
