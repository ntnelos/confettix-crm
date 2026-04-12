import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) return;
    const [key, ...valueParts] = trimmedLine.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      process.env[key.trim()] = value;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: users, error: userErr } = await supabase.from('profiles').select('id, email, role');
  if (userErr) console.error('User Error:', userErr);
  else console.log('Users found:', users);

  const tables = ['organizations', 'contacts', 'opportunities'];
  for (const table of tables) {
    const { count, error } = await (supabase.from(table) as any).select('*', { count: 'exact', head: true });
    if (error) console.error(`Error counting ${table}:`, error);
    else console.log(`Table ${table} has ${count} records.`);
  }
}

run().catch(console.error);
