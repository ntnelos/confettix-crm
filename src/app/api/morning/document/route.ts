import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMorningErrorMessage } from '@/lib/morning/errors'

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
      .select('*, quotes(id, subtotal, shipping_cost, quote_items(*)), opportunities(id, contact_id, organization_id)')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: `Order not found or query error: ${orderErr?.message}` }, { status: 404 })
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

    const apiUrl = process.env.MORNING_API_URL || 'https://api.greeninvoice.co.il/api/v1'

    let authRes;
    try {
      authRes = await fetch(`${apiUrl}/account/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: apiKey, secret: apiSecret })
      })
    } catch (fetchErr: any) {
      console.error('Morning Auth Network Error:', fetchErr)
      return NextResponse.json({ error: `Network error connecting to Morning: ${fetchErr.message}` }, { status: 500 })
    }

    if (!authRes.ok) {
      const err = await authRes.text()
      console.error('Morning Auth Error:', err)
      return NextResponse.json({ error: `Morning Auth Error: ${err}` }, { status: 500 })
    }

    const authData = await authRes.json()
    const token = authData.token

    // 3. Smart Client Logic (Morning ID Check)
    let morningId: string | null = null;
    let organizationData = null;

    if (opportunity.organization_id) {
      const { data: org } = await supabase.from('organizations').select('*').eq('id', opportunity.organization_id).single()
      organizationData = org;
      // Using existing morning_id column, assuming we'll fall back to contact logic if this fails, but wait, DB might not have morning_id on orgs.
      // We will rely on contact's morning_id or organization's if available. To be safe, we'll store organization's morning_id in the 'notes' or a new column if exists.
      morningId = org?.morning_id || contact.morning_id;
    } else {
      morningId = contact.morning_id;
    }

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

      // Smart Naming Logic
      if (organizationData) {
         clientPayload.name = organizationData.invoice_company_name || organizationData.name || contact.name;
      }

      const clientRes = await fetch(`${apiUrl}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(clientPayload)
      })

      if (!clientRes.ok) {
        const errText = await clientRes.text()
        let errorCode: any = null
        let translatedError = ''
        
        try {
          const parsed = JSON.parse(errText)
          errorCode = parsed.errorCode || parsed.code
          if (errorCode) {
            translatedError = getMorningErrorMessage(errorCode)
          }
        } catch (e) {}

        console.error('Morning Client Create Error:', errText)
        
        // Log to DB
        await supabase.from('system_logs').insert({
          level: 'error',
          service: 'morning_api',
          message: translatedError || 'Failed to create client',
          details: { error: errText, errorCode, payload: clientPayload, orderId }
        })

        return NextResponse.json({ 
          error: translatedError || 'Failed to create client in Morning API', 
          details: errText 
        }, { status: 500 })
      }

      const clientData = await clientRes.json()
      morningId = clientData.id

      // Update in our DB
      if (organizationData && organizationData.id) {
        // Try updating org morning_id if column exists, otherwise contact.
        // We will just try safely.
        const { error: orgErr } = await supabase.from('organizations').update({ morning_id: morningId }).eq('id', organizationData.id)
        if (orgErr) console.warn("Non-critical: could not update org morning_id", orgErr.message)
        
        const { error: contactErr } = await supabase.from('contacts').update({ morning_id: morningId }).eq('id', contact.id)
        if (contactErr) console.warn("Non-critical: could not update contact morning_id", contactErr.message)
      } else {
        const { error: contactErr } = await supabase.from('contacts').update({ morning_id: morningId }).eq('id', contact.id)
        if (contactErr) console.warn("Non-critical: could not update contact morning_id", contactErr.message)
      }
    }

    // 4. Document Creation (Type 305 - Tax Invoice)
    // Gather line items
    const quoteArgs = order.quotes as any;
    // Wait, the query `quotes(id, subtotal, shipping_cost, quotes_items(*))` might not have `quotes_items`. Let's fetch quote items explicitly.
    const { data: quoteItems } = await supabase.from('quote_items').select('*').eq('quote_id', order.quote_id)
    
    let income: any[] = [];
    if (quoteItems) {
      income = quoteItems.map((item: any) => ({
        description: item.description ? `${item.product_name}\n${item.description}` : item.product_name,
        quantity: item.quantity,
        price: item.line_total / item.quantity // price after discount, BEFORE VAT
      }))
    }

    // Add shipping if > 0
    const { data: quote } = await supabase.from('quotes').select('shipping_cost, subtotal').eq('id', order.quote_id).single()
    if (quote && quote.shipping_cost > 0) {
      income.push({
        description: 'משלוח',
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

    // Fetch opportunity to get the subject and description
    const { data: oppForDesc } = await supabase.from('opportunities').select('subject, description').eq('id', order.opportunity_id).single()

    // Configuration Text (from settings data)
    let invoiceFooter = '';
    let invoiceEmailText = '';

    try {
      const fs = require('fs');
      const path = require('path');
      const settingsPath = path.join(process.cwd(), 'data', 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        invoiceFooter = settings.invoice_footer || '';
        invoiceEmailText = settings.invoice_email || '';
      }
    } catch (e) {
      console.warn("Failed to load local settings for Invoice.");
    }

    const docPayload: any = {
      type: 305, // Tax Invoice
      client: {
        id: morningId
      },
      currency: 'ILS',
      lang: 'he',
      income: income,
      description: order.order_number || oppForDesc?.subject || '', // Order number maps to document description
      remarks: oppForDesc?.description || '', // opp description maps to document remarks
      footer: invoiceFooter,
      email: {
        send: true,
        text: invoiceEmailText
      }
    }

    const docRes = await fetch(`${apiUrl}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(docPayload)
    })

    if (!docRes.ok) {
      const errText = await docRes.text()
      let errorCode: any = null
      let translatedError = ''
      
      try {
        const parsed = JSON.parse(errText)
        errorCode = parsed.errorCode || parsed.code
        if (errorCode) {
          translatedError = getMorningErrorMessage(errorCode)
        }
      } catch (e) {}

      console.error('Morning Document Create Error:', errText)
      
      // Log to DB
      await supabase.from('system_logs').insert({
        level: 'error',
        service: 'morning_api',
        message: translatedError || 'Failed to create document',
        details: { error: errText, errorCode, payload: docPayload, orderId }
      })

      return NextResponse.json({ error: translatedError || `Failed to create document: ${errText}` }, { status: 500 })
    }

    const docData = await docRes.json()

    // Morning API response structure:
    // docData.id = document ID
    // docData.number = invoice number
    // docData.url.he = Hebrew PDF download URL
    // docData.url.origin = original language PDF
    const newInvoice: any = {
      order_id: order.id,
      green_invoice_id: docData.id,
      invoice_number: String(docData.number || docData.documentNumber || 'חשבונית'),
      type: 'invoice',
      amount: docData.amount || order.total_amount,
      pdf_url: docData.url?.he || docData.url?.origin || null,
      origin_url: docData.url?.origin || null,
      status: 'issued',
      issued_at: new Date().toISOString()
    }
    
    // Log the full docData for debugging
    console.log('Morning docData:', JSON.stringify(docData, null, 2))

    const { data: insertedInvoice, error: invError } = await supabase.from('invoices').insert(newInvoice).select().single()
    
    if (invError) {
      console.error('Insert Invoice Error:', invError)
      return NextResponse.json({ error: 'Created in Morning, but failed to save in DB.', details: invError }, { status: 500 })
    }

    // 5. Update Opportunity Status to 'pending_payment'
    const { error: oppUpdateErr } = await supabase
      .from('opportunities')
      .update({ status: 'pending_payment' })
      .eq('id', order.opportunity_id)

    if (oppUpdateErr) {
      console.warn('Failed to update opportunity status to pending_payment:', oppUpdateErr.message)
    }

    return NextResponse.json({ success: true, invoice: insertedInvoice, docData })

  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
