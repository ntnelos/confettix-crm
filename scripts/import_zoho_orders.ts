import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import csvParser from 'csv-parser'

// Note: Ensure you run this script with `npx tsx scripts/import_zoho_orders.ts`
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
  if (!dateStr) return null
  try {
    // 16.4.2026 10:30
    const [datePart, timePart] = dateStr.split(' ')
    const [day, month, year] = datePart.split('.')
    if (!year || !month || !day) return null
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
  console.log('Loading CSV files...')
  const orders = await parseCsv(path.join(__dirname, 'new_orders.csv'))
  const orderItems = await parseCsv(path.join(__dirname, 'order_items.csv'))

  console.log(`Loaded ${orders.length} orders and ${orderItems.length} items.`)

  // Group items by crmorderidname
  const itemsByOrder: Record<string, any[]> = {}
  for (const item of orderItems) {
    const orderNum = item.crmorderidname // corresponds to crmordernumber
    if (!itemsByOrder[orderNum]) {
      itemsByOrder[orderNum] = []
    }
    itemsByOrder[orderNum].push(item)
  }

  // Pre-load all organizations to avoid redundant queries
  const { data: orgsData } = await supabase.from('organizations').select('id, name')
  const orgMap = new Map((orgsData || []).map(o => [o.name, o.id]))

  for (let i = 0; i < orders.length; i++) {
    const r = orders[i]
    const orderNumber = r.crmordernumber
    console.log(`Processing Order #${orderNumber} (${i + 1}/${orders.length})...`)

    // Extract necessary fields
    const orgName = r.accountidname?.trim()
    const orgIdNumber = r.orgidnumber?.trim()
    
    if (!orgName) {
      console.log(`  Skip: No organization name provided.`)
      continue
    }

    // 1. Resolve Organization
    let organizationId = orgMap.get(orgName)
    if (!organizationId) {
       console.log(`  Creating organization: ${orgName}`)
       // Add the orgidnumber maybe into general_info if requested? For now just invoice_company_name 
       const { data: newOrg, error: orgErr } = await supabase.from('organizations').insert({ 
         name: orgName,
         general_info: orgIdNumber ? `ח.פ: ${orgIdNumber}` : null
       }).select('id').single()
       
       if (orgErr || !newOrg) {
         console.error('  Failed to create organization:', orgErr)
         continue
       }
       organizationId = newOrg.id
       orgMap.set(orgName, organizationId)
    }

    // 2. Create Opportunity
    const subject = `הזמנה מקורית #${orderNumber}`
    const expectedDelivery = parseDate(r.pcfSupplyTime)
    const createdAt = parseDate(r.createdon) || new Date().toISOString()
    const description = r.description || null
    const calculatedValue = parseFloat(r.nistotalamount) || 0
    let paymentMethod = r.pcfsystemfield23name || null

    const { data: opp, error: oppErr } = await supabase.from('opportunities').insert({
      subject,
      organization_id: organizationId,
      status: 'won', // approved
      expected_delivery: expectedDelivery,
      calculated_value: calculatedValue,
      description,
      payment_method: paymentMethod,
      created_at: createdAt
    }).select('id').single()

    if (oppErr || !opp) {
       console.error('  Failed to create opportunity:', oppErr)
       continue
    }

    // 3. Create Quote
    const subtotal = parseFloat(r.productstotal) || 0
    const tax = parseFloat(r.taxvalue) || 0
    const discount = parseFloat(r.amountdiscount) || 0
    // If taxpercent exists, we can extract it or use 17% default
    const vatRate = parseFloat(r.taxpercent) || 17

    const { data: quote, error: quoteErr } = await supabase.from('quotes').insert({
      opportunity_id: opp.id,
      name: `הצעת מחיר עבור: ${subject}`,
      status: 'approved',
      subtotal: subtotal,
      vat_rate: vatRate,
      shipping_cost: 0,
      total_with_vat: calculatedValue,
      version: 1,
      created_at: createdAt
    }).select('id').single()

    if (quoteErr || !quote) {
      console.error('  Failed to create quote:', quoteErr)
      continue
    }

    // 4. Create Quote Items
    const items = itemsByOrder[orderNumber] || []
    if (items.length > 0) {
      const formattedItems = items.map((item, index) => {
        return {
          quote_id: quote.id,
          product_name: item.productname || 'פריט לא ידוע',
          description: item.description || null,
          quantity: parseFloat(item.itemquantity) || 1,
          unit_price: parseFloat(item.itemprice) || 0,
          discount_percent: 0,
          line_total: parseFloat(item.itemtotalprice) || 0,
          sort_order: index,
          created_at: parseDate(item.createdon) || createdAt
        }
      })
      
      const { error: itemsErr } = await supabase.from('quote_items').insert(formattedItems)
      if (itemsErr) {
        console.error('  Failed to insert quote items:', itemsErr)
      } else {
        console.log(`  Inserted ${items.length} items.`)
      }
    } else {
      console.log(`  No items found for this order.`)
    }

    // 5. Create Order
    const { error: orderErr } = await supabase.from('orders').insert({
      opportunity_id: opp.id,
      quote_id: quote.id,
      order_number: `ORD-${orderNumber}`,
      status: 'paid', // approved order
      total_amount: calculatedValue,
      created_at: createdAt,
      notes: r.description || null
    })

    if (orderErr) {
      console.error('  Failed to create order:', orderErr)
    } else {
      console.log(`  Order successfully imported!`)
    }
  }

  console.log('Import completed.')
}

run().catch(console.error)
