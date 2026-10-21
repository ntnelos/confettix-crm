import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const search = 'test';
  let q = supabase
      .from('items')
      .select('*, inventory_levels(*)', { count: 'exact' });
  
  q = q.or(`name.ilike.%${search}%,category.ilike.%${search}%`);

  const { data, error, count } = await q;
  console.log('Error:', error);
  console.log('Count:', count);
  console.log('Data:', data?.length);
}
run();
