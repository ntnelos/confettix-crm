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

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const userId = process.argv[2];
  if (!userId) {
    const { data: users } = await supabase.from('profiles').select('id, email').limit(1);
    if (!users || users.length === 0) {
      console.error('No users found to assign to. Please provide a user ID.');
      process.exit(1);
    }
    console.log(`No user ID provided. Using first user: ${users[0].email} (${users[0].id})`);
    assignTo(users[0].id);
  } else {
    assignTo(userId);
  }
}

async function assignTo(userId: string) {
  const tables = ['organizations', 'contacts', 'opportunities'];
  for (const table of tables) {
    console.log(`Assigning records in ${table} to user ${userId}...`);
    const { error } = await (supabase.from(table) as any).update({ created_by: userId }).is('created_by', null);
    if (error) console.error(`Error updating ${table}:`, error);
    else console.log(`Finished ${table}.`);
  }
}

run().catch(console.error);
