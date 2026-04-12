import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getServiceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

export async function POST(request: NextRequest) {
  const supabase = getServiceClient()
  
  try {
    const { orderId } = await request.json()
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    // 1. Fetch Order and related data
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, quotes(id, subtotal, shipping_cost, quotes_items(*)), opportunities(id, contact_id, organization_id)')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const opportunity = order.opportunities
    if (!opportunity?.contact_id) {
      return NextResponse.json({ error: 'No contact associated with this opportunity.' }, { status: 400 })
    }

    // Fetch Contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', opportunity.contact_id)
      .single()

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // 2. Authenticate with Morning API
    const apiKey = process.env.MORNING_API_KEY || process.env.GREEN_INVOICE_API_KEY
    const apiSecret = process.env.MORNING_API_SECRET
    
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Morning API credentials not configured.' }, { status: 500 })
    }

    const authRes = await fetch('https://api.greeninvoice.co.il/api/v1/account/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: apiKey, secret: apiSecret })
    })

    if (!authRes.ok) {
      const err = await authRes.text()
      console.error('Morning Auth Error:', err)
      return NextResponse.json({ error: 'Failed to authenticate with Morning API' }, { status: 500 })
    }

    const authData = await authRes.json()
    const token = authData.token

    // 3. Smart Client Logic (Morning ID Check)
    let morningId = contact.morning_id

    if (!morningId) {
      // Create new client in Morning
      const clientPayload: any = {
        name: contact.name,
        emails: contact.email ? [contact.email] : [],
        active: true
      }
      
      if (contact.mobile || contact.phone) {
        clientPayload.phone = contact.mobile || contact.phone
      }

      // Add organization name if available
      if (opportunity.organization_id) {
        const { data: org } = await supabase.from('organizations').select('name').eq('id', opportunity.organization_id).single()
        if (org) {
          clientPayload.name = `${org.name} - ${contact.name}`
        }
      }

      const clientRes = await fetch('https://api.greeninvoice.co.il/api/v1/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(clientPayload)
      })

      if (!clientRes.ok) {
        const err = await clientRes.text()
        console.error('Morning Client Create Error:', err)
        return NextResponse.json({ error: 'Failed to create client in Morning API' }, { status: 500 })
      }

      const clientData = await clientRes.json()
      morningId = clientData.id

      // Update contact in our DB
      await supabase.from('contacts').update({ morning_id: morningId }).eq('id', contact.id)
    }

    // 4. Document Creation (Type 305 - Tax Invoice)
    // Gather line items
    const quoteArgs = order.quotes as any;
    // Wait, the query `quotes(id, subtotal, shipping_cost, quotes_items(*))` might not have `quotes_items`. Let's fetch quote items explicitly.
    const { data: quoteItems } = await supabase.from('quote_items').select('*').eq('quote_id', order.quote_id)
    
    let income: any[] = [];
    if (quoteItems) {
      income = quoteItems.map((item: any) => ({
        description: item.product_name,
        quantity: item.quantity,
        price: item.line_total / item.quantity // price after discount, BEFORE VAT
      }))
    }

    // Add shipping if > 0
    // Wait, need to fetch quote.shipping_cost explicitly if nested relation is weird.
    const { data: quote } = await supabase.from('quotes').select('shipping_cost, subtotal').eq('id', order.quote_id).single()
    if (quote && quote.shipping_cost > 0) {
      income.push({
        description: 'דמי משלוח',
        quantity: 1,
        price: quote.shipping_cost
      })
    }
    
    // Also check if delivery method was 'check_delivery' with fee. We will just use the final order amount. Wait, if there's a discrepancy, let's just make it simple.
    // Instead of precise calculation checking if total_amount matches, we can calculate total income. If it doesn't match total_amount, we might have check_delivery 25 ILS.
    const calculatedIncomeSum = income.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    const expectedSubtotal = quote ? (quote.subtotal + quote.shipping_cost) : 0;
    
    // If order.total_amount > (expectedSubtotal * 1.18 + 0.05) or something similar...
    // Actually, check delivery fee is 25 ILS INCLUDING VAT, meaning ~21.36 ILS before VAT.
    const expectedTotalAmountWithVat = expectedSubtotal * 1.18;
    // If total_amount and expectedTotalAmountWithVat difference is about 25:
    if (Math.abs(order.total_amount - (expectedTotalAmountWithVat + 25)) < 1) {
      income.push({
        description: 'תוספת תשלום בצ\'ק לשליח',
        quantity: 1,
        price: 25 / 1.18
      })
    }

    const docPayload = {
      type: 305, // Tax Invoice
      client: {
        id: morningId
      },
      currency: 'ILS',
      lang: 'he',
      income: income,
      // You can add payment logic here if it's considered paid, but it's just Tax Invoice, not Receipt.
    }

    const docRes = await fetch('https://api.greeninvoice.co.il/api/v1/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(docPayload)
    })

    if (!docRes.ok) {
      const err = await docRes.text()
      console.error('Morning Document Create Error:', err)
      return NextResponse.json({ error: `Failed to create document: ${err}` }, { status: 500 })
    }

    const docData = await docRes.json()

    // 5. Data Storage (Insert into existing invoices table)
    const newInvoice = {
      order_id: order.id,
      green_invoice_id: docData.id,
      invoice_number: String(docData.documentNumber || docData.number || 'חשבונית'), // depends on their response schema
      type: 'invoice', // We enforce 'invoice' enum based on types
      amount: docData.amount || order.total_amount,
      pdf_url: docData.url?.he?.pdf || docData.pdfUrl || docData.fileUrl || null, // Common fields
      status: 'issued',
      issued_at: new Date().toISOString()
    }
    
    // Wait, let's see what is standard returned PDF field: `url.he.pdf` or `url.en.pdf` or `downloadUrl`. According to their API, it's `downloadUrl` or `url`.
    // I'll grab docData.documentUrl or docData.downloadUrl just in case.
    if (docData.downloadUrl) {
      newInvoice.pdf_url = docData.downloadUrl;
    }

    const { data: insertedInvoice, error: invError } = await supabase.from('invoices').insert(newInvoice).select().single()

    if (invError) {
      console.error('Insert Invoice Error:', invError)
      return NextResponse.json({ error: 'Created in Morning, but failed to save in DB.', details: invError }, { status: 500 })
    }

    return NextResponse.json({ success: true, invoice: insertedInvoice, docData })

  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
