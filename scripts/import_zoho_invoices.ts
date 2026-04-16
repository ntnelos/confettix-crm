import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import csvParser from 'csv-parser'

// Load environment variables directly via file reading
const envPath = path.join(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8')
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      process.env[match[1]] = match[2]
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Parsing helper function
function parseCsv(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = []
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err))
  })
}

// Convert "DD.MM.YYYY HH:mm" to ISO if possible
function parseDate(dateStr: string) {
  if (!dateStr || !dateStr.trim()) return null
  try {
    const [datePart, timePart] = dateStr.trim().split(' ')
    if (!datePart) return null
    const parts = datePart.split('.')
    if (parts.length < 3) return null
    const [day, month, year] = parts
    let iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    if (timePart) {
      iso += `T${timePart}:00.000Z`
    }
    return new Date(iso).toISOString()
  } catch (e) {
    return null
  }
}

async function run() {
  console.log('Loading new_orders.csv...')
  const orders = await parseCsv(path.join(__dirname, 'new_orders.csv'))
  
  const ordersWithInvoice = orders.filter(o => o.pcfsystemfield33 && o.pcfsystemfield33.trim().length > 0)
  console.log(`Found ${ordersWithInvoice.length} orders with an actual invoice link attached.`)

  for (let i = 0; i < ordersWithInvoice.length; i++) {
    const r = ordersWithInvoice[i]
    const orderNumber = r.crmordernumber
    const formattedOrderNumber = `ORD-${orderNumber}`
    console.log(`Processing invoice for Order ${formattedOrderNumber} (${i + 1}/${ordersWithInvoice.length})...`)

    // 1. Fetch Order ID from DB
    const { data: dbOrder, error: orderErr } = await supabase
      .from('orders')
      .select('id, total_amount, created_at')
      .eq('order_number', formattedOrderNumber)
      .single()

    if (orderErr || !dbOrder) {
      console.log(`  Skip: Could not find order ${formattedOrderNumber} in the database.`)
      continue
    }

    // 2. Parse Invoice Data
    const pdfUrl = r.pcfsystemfield33.trim()
    const invoiceNumber = r.pcfsystemfield37?.trim() || null
    let issuedAt = parseDate(r.pcfsystemfield25)
    
    // Fallback if issuedAt parsing failed but we must have a date, we use order date
    if (!issuedAt) {
      issuedAt = dbOrder.created_at
    }

    // Amount can be taken from nistotalamount or just the order total
    // But since order total already exists, we use it directly or fallback to order total.
    const amount = parseFloat(r.nistotalamount) || dbOrder.total_amount

    // 3. Insert Invoice
    const { error: invErr } = await supabase.from('invoices').insert({
      order_id: dbOrder.id,
      pdf_url: pdfUrl,
      invoice_number: invoiceNumber,
      issued_at: issuedAt,
      amount: amount,
      type: 'invoice_receipt', // Default assumption for paid standard orders
      status: 'paid'
    })

    if (invErr) {
      console.error(`  Error creating invoice:`, invErr)
    } else {
      console.log(`  Invoice ${invoiceNumber || ''} created successfully!`)
    }
  }

  console.log('Invoice import complete!')
}

run().catch(console.error)
