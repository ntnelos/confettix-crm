require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const csv = require('csv-parser');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const urlToReceiptNumber = {};

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream('scripts/הזמנות.csv') // Note: if the filename actually is 'הזמנות.csv'
        .pipe(csv())
        .on('data', row => {
          if (row.pcfsystemfield33 && row.pcfpaymentNumber) {
            urlToReceiptNumber[row.pcfsystemfield33.trim()] = row.pcfpaymentNumber.trim();
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
  } catch (err) {
    console.error("Failed to read CSV:", err);
    return;
  }

  console.log(`Loaded ${Object.keys(urlToReceiptNumber).length} URL->Receipt mappings from CSV.`);

  // Load all invoices
  const { data: invoices, error } = await supabase.from('invoices').select('*').in('type', ['invoice', '305']);
  if (error) {
    console.error('Error fetching invoices', error);
    return;
  }

  console.log(`Found ${invoices.length} general invoices in DB.`);

  const newReceipts = [];

  for (const inv of invoices) {
    if (!inv.pdf_url) continue;

    const uKey = Object.keys(urlToReceiptNumber).find(u => inv.pdf_url.includes(u) || u.includes(inv.pdf_url));
    if (uKey) {
      const receiptNumber = urlToReceiptNumber[uKey];
      newReceipts.push({
        order_id: inv.order_id,
        invoice_number: receiptNumber,
        type: 'receipt', // docType 400
        amount: inv.amount,
        status: 'issued', // keep issued generic since we don't know it's green status
        issued_at: inv.issued_at || new Date().toISOString()
      });
    }
  }

  console.log(`Found ${newReceipts.length} matching receipts to create.`);

  if (newReceipts.length > 0) {
    const { error: insertError } = await supabase.from('invoices').insert(newReceipts);
    if (insertError) {
      console.error("Error inserting receipts:", insertError);
    } else {
      console.log(`Successfully inserted ${newReceipts.length} receipts!`);
    }
  }
}

run();
