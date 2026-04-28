require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { count, error } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('status', 'paid');
  console.log('Total paid opportunities:', count, error || '');
}
run();
