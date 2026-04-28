require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  while (true) {
    const { data, error } = await supabase.from('opportunities').select('id').eq('status', 'won').limit(1000);
    if (error) {
      console.error(error);
      break;
    }
    
    if (!data || data.length === 0) {
      console.log('No more "won" records found.');
      break;
    }
    
    console.log(`Updating ${data.length} records...`);
    const ids = data.map(r => r.id);
    
    const { error: updateError } = await supabase.from('opportunities').update({ status: 'paid' }).in('id', ids);
    if (updateError) {
      console.error('Error updating:', updateError);
      break;
    }
  }
}

run();
