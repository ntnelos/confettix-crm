import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import csv from 'csv-parser';
import * as path from 'path';
import * as crypto from 'crypto';

// Manual .env.local loader to avoid dependency issues with dotenv
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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function parseCSV(filePath: string): Promise<any[]> {
  const results: any[] = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

function getVal(obj: any, searchKey: string) {
  for (const k of Object.keys(obj)) {
    const cleanKey = k.replace(/[\u200B-\u202D\uFEFF]/g, '').replace(/\"/g, '').trim();
    const cleanSearch = searchKey.replace(/[\u200B-\u202D\uFEFF]/g, '').replace(/\"/g, '').trim();
    if (cleanKey === cleanSearch) return obj[k];
  }
  return obj[searchKey];
}

async function run() {
  console.log('Loading CSVs...');
  const organizations = await parseCSV(path.join(__dirname, 'Organizations.csv'));
  console.log(`Loaded ${organizations.length} organizations.`);
  
  const contacts = await parseCSV(path.join(__dirname, 'Contacts.csv'));
  console.log(`Loaded ${contacts.length} contacts.`);
  
  const orders = await parseCSV(path.join(__dirname, 'Orders.csv'));
  console.log(`Loaded ${orders.length} orders.`);

  const orgMap = new Map<string, string>();
  const contactMap = new Map<string, string>();

  console.log('Processing Organizations...');
  const orgsToInsert = [];
  for (const org of organizations) {
    const zohoId = getVal(org, 'organization_id') || getVal(org, 'מזהה רשומה');
    if (!zohoId) continue;
    
    if (orgMap.has(zohoId)) continue;
    
    const newId = crypto.randomUUID();
    orgMap.set(zohoId, newId);
    
    orgsToInsert.push({
      id: newId,
      name: getVal(org, 'שם ארגון') || 'ללא שם',
      invoice_company_name: getVal(org, 'שם חברה לחשבונית') || null,
      employee_count: parseInt(getVal(org, 'עובדים')) || null,
      general_info: getVal(org, 'תיאור') || null,
    });
  }

  const orgChunks = chunkArray(orgsToInsert, 1000);
  for (let i = 0; i < orgChunks.length; i++) {
    console.log(`Inserting organizations chunk ${i + 1}/${orgChunks.length}...`);
    const { error } = await supabase.from('organizations').upsert(orgChunks[i]);
    if (error) console.error('Error inserting orgs:', error);
  }

  console.log('Processing Contacts...');
  const contactsToInsert = [];
  for (const contact of contacts) {
    const zohoId = getVal(contact, 'contact_id') || getVal(contact, 'מזהה רשומה');
    if (!zohoId) continue;
    if (contactMap.has(zohoId)) continue;

    const newId = crypto.randomUUID();
    contactMap.set(zohoId, newId);

    const zohoOrgId = getVal(contact, 'organization_id') || getVal(contact, 'שם ספק.id');
    const orgId = zohoOrgId ? orgMap.get(zohoOrgId) || null : null;
    const fullName = `${getVal(contact, 'שם פרטי') || ''} ${getVal(contact, 'שם משפחה') || ''}`.trim() || 'ללא שם';

    let unsubscribed = false;
    const unsubVal = getVal(contact, 'ביטול אישור קבלת דוא"ל');
    if (unsubVal === 'true' || unsubVal === '1') unsubscribed = true;

    contactsToInsert.push({
        id: newId,
        organization_id: orgId,
        name: fullName,
        email: getVal(contact, 'כתובת דוא"ל') || null,
        mobile: getVal(contact, 'נייד') || null,
        phone: getVal(contact, 'מספר טלפון') || null,
        unsubscribed: unsubscribed,
        morning_id: getVal(contact, 'morning-id') || null,
        notes: getVal(contact, 'תיאור') || null
    });
  }

  const contactChunks = chunkArray(contactsToInsert, 1000);
  for (let i = 0; i < contactChunks.length; i++) {
    console.log(`Inserting contacts chunk ${i + 1}/${contactChunks.length}...`);
    const { error } = await supabase.from('contacts').upsert(contactChunks[i]);
    if (error) console.error('Error inserting contacts:', error);
  }

  console.log('Processing Orders...');
  const ordersToInsert = [];
  for (const order of orders) {
    const zohoId = getVal(order, 'מזהה רשומה');
    if (!zohoId) continue;

    const zohoOrgId = getVal(order, 'organization_id');
    const orgId = zohoOrgId ? orgMap.get(zohoOrgId) || null : null;
    
    const zohoContactId = getVal(order, 'contact_id');
    const contactId = zohoContactId ? contactMap.get(zohoContactId) || null : null;
    
    const amountStr = getVal(order, 'סכום') || getVal(order, 'הכנסות צפויות') || '0';
    const amount = parseFloat(amountStr) || 0;
    
    let status = 'new';
    const zohoStatus = getVal(order, 'שלב');
    if (zohoStatus === 'Closed Won') status = 'won';
    else if (zohoStatus === 'Closed Lost' || zohoStatus === 'פניה סגורה שאבדה') status = 'lost';
    else if (zohoStatus === 'Pipeline') status = 'followup';

    let createdDate = getVal(order, 'זמן יצירה');
    if (!createdDate) createdDate = new Date().toISOString();
    else {
      // Trying to fix date formats to ISO if possible, but Supabase can parse most valid date strings
      try {
        createdDate = new Date(createdDate).toISOString();
      } catch (e) {
        createdDate = new Date().toISOString();
      }
    }

    ordersToInsert.push({
        id: crypto.randomUUID(),
        subject: getVal(order, 'שם דיל') || 'הזמנה ללא שם',
        status: status,
        organization_id: orgId,
        contact_id: contactId,
        calculated_value: amount,
        description: getVal(order, 'תיאור') || null,
        created_at: createdDate
    });
  }

  const orderChunks = chunkArray(ordersToInsert, 1000);
  for (let i = 0; i < orderChunks.length; i++) {
    console.log(`Inserting orders chunk ${i + 1}/${orderChunks.length}...`);
    const { error } = await supabase.from('opportunities').upsert(orderChunks[i]);
    if (error) console.error('Error inserting orders:', error);
  }

  console.log('Import completed successfully!');
}

run().catch(console.error);
