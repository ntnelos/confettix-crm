import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMorningErrorMessage } from '@/lib/morning/errors'
import { getMorningConfig, getMorningToken, searchMorningClient } from '@/lib/morning/client'

const getServiceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

async function logSystem(
  supabase: any,
  level: 'error' | 'warn' | 'info',
  message: string,
  details?: any
) {
  try {
    await supabase.from('system_logs').insert({
      level,
      service: 'morning_api',
      message,
      details: details || null
    })
  } catch (logErr) {
    console.error('Failed to log to system_logs:', logErr)
  }
}

export async function POST(request: NextRequest) {
  const supabase = getServiceClient()
  let currentOrderId: string | null = null

  try {
    const body = await request.json()
    const { orderId } = body
    currentOrderId = orderId

    if (!orderId) {
      await logSystem(supabase, 'warn', 'ניסיון להפקת חשבונית ללא orderId', { body })
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    // 1. Fetch Order and related data
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, quotes(id, subtotal, shipping_cost, quote_items(*)), opportunities(id, contact_id, organization_id)')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) {
      const errMsg = `הזמנה לא נמצאה במערכת: ${orderErr?.message || orderId}`
      await logSystem(supabase, 'error', errMsg, { orderId, orderErr })
      return NextResponse.json({ error: errMsg }, { status: 404 })
    }

    const opportunity = order.opportunities
    if (!opportunity?.contact_id) {
      const errMsg = 'לא מקושר איש קשר להזדמנות זו'
      await logSystem(supabase, 'error', errMsg, { orderId, opportunity })
      return NextResponse.json({ error: errMsg }, { status: 400 })
    }

    // Fetch Contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', opportunity.contact_id)
      .single()

    if (!contact) {
      const errMsg = 'פרטי איש הקשר לא נמצאו בבסיס הנתונים'
      await logSystem(supabase, 'error', errMsg, { orderId, contactId: opportunity.contact_id })
      return NextResponse.json({ error: errMsg }, { status: 404 })
    }

    // 2. Authenticate with Morning API (OAuth2)
    const { apiUrl } = getMorningConfig()
    let token: string

    try {
      token = await getMorningToken()
    } catch (authErr: any) {
      const authMessage = authErr.message || 'שגיאת אימות מול שרתי Morning'
      console.error('Morning Authentication Failed:', authErr)
      await logSystem(supabase, 'error', `כשל באימות מול Morning: ${authMessage}`, {
        orderId,
        error: authMessage
      })
      return NextResponse.json({ error: authMessage }, { status: 500 })
    }

    // 3. Smart Client Logic (Morning ID Check)
    let morningId: string | null = null
    let organizationData: any = null

    if (opportunity.organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', opportunity.organization_id)
        .single()
      organizationData = org
      morningId = org?.morning_id || contact.morning_id
    } else {
      morningId = contact.morning_id
    }

    // If client ID is missing in CRM, check if exists in Morning by email/name before creating
    if (!morningId) {
      const clientName = (
        organizationData?.invoice_company_name ||
        organizationData?.name ||
        contact.name ||
        ''
      ).trim()

      const existingMorningClient = await searchMorningClient(token, {
        email: contact.email,
        name: clientName,
        phone: contact.mobile || contact.phone
      })

      if (existingMorningClient && existingMorningClient.id) {
        morningId = existingMorningClient.id
        console.log(`Reusing existing Morning client ID: ${morningId} for ${clientName}`)
      }
    }

    // If still no Morning ID, create client in Morning
    if (!morningId) {
      const clientPayload: any = {
        name: organizationData?.invoice_company_name || organizationData?.name || contact.name,
        emails: contact.email ? [contact.email] : [],
        active: true
      }

      if (contact.mobile || contact.phone) {
        clientPayload.phone = contact.mobile || contact.phone
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

        // Fallback: If duplicate/identical client error (code 1010), attempt to find client
        if (errorCode === 1010 || errText.includes('1010')) {
          const fallbackFound = await searchMorningClient(token, {
            email: contact.email,
            name: clientPayload.name
          })
          if (fallbackFound?.id) {
            morningId = fallbackFound.id
          }
        }

        if (!morningId) {
          console.error('Morning Client Create Error:', errText)
          await logSystem(supabase, 'error', translatedError || 'נכשלה יצירת כרטיס לקוח ב-Morning', {
            error: errText,
            errorCode,
            payload: clientPayload,
            orderId
          })

          return NextResponse.json(
            {
              error: translatedError || 'שגיאה ביצירת לקוח במערכת Morning',
              details: errText
            },
            { status: 500 }
          )
        }
      } else {
        const clientData = await clientRes.json()
        morningId = clientData.id
      }

      // Update in our DB for future documents
      if (morningId) {
        if (organizationData && organizationData.id) {
          const { error: orgErr } = await supabase
            .from('organizations')
            .update({ morning_id: morningId })
            .eq('id', organizationData.id)
          if (orgErr) console.warn('Non-critical: could not update org morning_id', orgErr.message)

          const { error: contactErr } = await supabase
            .from('contacts')
            .update({ morning_id: morningId })
            .eq('id', contact.id)
          if (contactErr) console.warn('Non-critical: could not update contact morning_id', contactErr.message)
        } else {
          const { error: contactErr } = await supabase
            .from('contacts')
            .update({ morning_id: morningId })
            .eq('id', contact.id)
          if (contactErr) console.warn('Non-critical: could not update contact morning_id', contactErr.message)
        }
      }
    }

    // 4. Document Creation (Type 305 - Tax Invoice)
    // Gather line items
    const { data: quoteItems } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', order.quote_id)

    let income: any[] = []
    if (quoteItems && quoteItems.length > 0) {
      income = quoteItems.map((item: any) => ({
        description: item.description ? `${item.product_name}\n${item.description}` : item.product_name,
        quantity: item.quantity || 1,
        price: item.quantity > 0 ? item.line_total / item.quantity : item.line_total
      }))
    }

    // Add shipping if > 0
    const { data: quote } = await supabase
      .from('quotes')
      .select('shipping_cost, subtotal')
      .eq('id', order.quote_id)
      .single()

    if (quote && quote.shipping_cost > 0) {
      income.push({
        description: 'משלוח',
        quantity: 1,
        price: quote.shipping_cost
      })
    }

    // Check delivery fee addition
    const expectedSubtotal = quote ? quote.subtotal + (quote.shipping_cost || 0) : 0
    const expectedTotalAmountWithVat = expectedSubtotal * 1.18
    if (Math.abs(order.total_amount - (expectedTotalAmountWithVat + 25)) < 1) {
      income.push({
        description: "תוספת תשלום בצ'ק לשליח",
        quantity: 1,
        price: 25 / 1.18
      })
    }

    // Fallback: If income is somehow empty, add default row so Morning accepts document
    if (income.length === 0) {
      income.push({
        description: order.order_number ? `הזמנה ${order.order_number}` : 'הזמנה',
        quantity: 1,
        price: (order.total_amount || 0) / 1.18
      })
    }

    // Fetch opportunity to get the subject and description
    const { data: oppForDesc } = await supabase
      .from('opportunities')
      .select('subject, description')
      .eq('id', order.opportunity_id)
      .single()

    // Configuration Text (from settings data)
    let invoiceFooter = ''
    let invoiceEmailText = ''

    try {
      const fs = require('fs')
      const path = require('path')
      const settingsPath = path.join(process.cwd(), 'data', 'settings.json')
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
        invoiceFooter = settings.invoice_footer || ''
        invoiceEmailText = settings.invoice_email || ''
      }
    } catch (e) {
      console.warn('Failed to load local settings for Invoice.')
    }

    const docPayload: any = {
      type: 305, // Tax Invoice
      client: {
        id: morningId
      },
      currency: 'ILS',
      lang: 'he',
      income: income,
      description: order.order_number || oppForDesc?.subject || '',
      remarks: oppForDesc?.description || '',
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

      // Log error to DB
      await logSystem(supabase, 'error', translatedError || 'נכשלה הפקת חשבונית מס ב-Morning', {
        error: errText,
        errorCode,
        payload: docPayload,
        orderId
      })

      return NextResponse.json(
        {
          error: translatedError || `נכשלה הפקת המסמך ב-Morning: ${errText}`,
          details: errText
        },
        { status: 500 }
      )
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

    const { data: insertedInvoice, error: invError } = await supabase
      .from('invoices')
      .insert(newInvoice)
      .select()
      .single()

    if (invError) {
      console.error('Insert Invoice Error:', invError)
      await logSystem(supabase, 'error', 'חשבונית הופקה ב-Morning אך נכשלה השמירה במסד הנתונים', {
        invError,
        docData,
        orderId
      })
      return NextResponse.json(
        { error: 'החשבונית נוצרה במורנינג אך אירעה שגיאה בשמירתה במערכת.', details: invError },
        { status: 500 }
      )
    }

    // 5. Update Opportunity Status to 'pending_payment'
    const { error: oppUpdateErr } = await supabase
      .from('opportunities')
      .update({ status: 'pending_payment' })
      .eq('id', order.opportunity_id)

    if (oppUpdateErr) {
      console.warn('Failed to update opportunity status to pending_payment:', oppUpdateErr.message)
    }

    // Log success
    await logSystem(supabase, 'info', `חשבונית מס מס' ${newInvoice.invoice_number} הופקה בהצלחה`, {
      invoiceId: insertedInvoice.id,
      orderId,
      invoiceNumber: newInvoice.invoice_number,
      amount: newInvoice.amount
    })

    return NextResponse.json({ success: true, invoice: insertedInvoice, docData })
  } catch (err: any) {
    console.error('Unexpected Morning Document Route Error:', err)
    await logSystem(
      supabase,
      'error',
      `שגיאה פנימית בהפקת חשבונית: ${err.message}`,
      { stack: err.stack, orderId: currentOrderId }
    )
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
