require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Querying opportunities with status "won"...');
  const { data, error } = await supabase.from('opportunities').select('id, status').eq('status', 'won');
  
  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('No opportunities found with status "won".');
    return;
  }

  console.log(`Found ${data.length} opportunities. Updating to "paid"...`);
  
  const { error: updateError } = await supabase
    .from('opportunities')
    .update({ status: 'paid' })
    .eq('status', 'won');

  if (updateError) {
    console.error('Error updating:', updateError);
  } else {
    console.log('Successfully updated all "won" opportunities to "paid".');
  }
}

run();
