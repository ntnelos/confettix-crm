const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('quotes').select('id, orders(id)').limit(1);
  console.log(error ? error : "Success, orders relation exists from quotes");
}
test();
