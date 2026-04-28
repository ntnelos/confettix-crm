import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processIncomingLead } from '@/lib/processIncomingLead'

const getServiceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

/**
 * POST /api/leads/website
 *
 * Receives a webhook from Bricks Builder.
 * Delegates routing logic to processIncomingLead().
 */
export async function POST(request: NextRequest) {
  const supabase = getServiceClient()

  let body: any = {}
  const contentType = request.headers.get('content-type') || ''

  try {
    if (contentType.includes('application/json')) {
      body = await request.json()
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const formData = await request.formData()
      body = Object.fromEntries(formData.entries())
    } else {
      body = await request.json()
    }
  } catch (err) {
    console.log('Error parsing body:', err)
    return NextResponse.json({ error: 'Failed to parse request body' }, { status: 400 })
  }

  console.log('=== WEBSITE LEAD WEBHOOK ===')
  console.log('Timestamp:', new Date().toISOString())
  console.log('Raw payload:', JSON.stringify(body, null, 2))
  console.log('============================')

  // ── Normalize Bricks Builder field IDs ──
  const name =
    body['form-field-467dd7'] || body.name || body.sender_name || body.full_name || null

  const phone =
    body['form-field-pudvel'] || body.phone || body.telephone || body.mobile || null

  const email =
    body['form-field-7792b6'] || body.email || null

  const company =
    body['form-field-wxzten'] || body.company || body.company_name || null

  let message = body['form-field-owpmol'] || body.message || null
  if (message && !message.startsWith('מחפשים מתנה ל')) {
    message = `מחפשים מתנה ל${message}`
  }

  const giftType = body['form-field-jyokyn'] || body.gift_type || null
  const quantityRaw = body['form-field-rxawud'] || body.quantity || body.estimated_quantity || null
  const quantity = quantityRaw ? parseInt(String(quantityRaw)) : null

  try {
    const result = await processIncomingLead(supabase, {
      source: 'website',
      name,
      phone,
      email,
      company,
      message,
      giftType,
      quantity,
      utmSource: body.utm_source || null,
      utmMedium: body.utm_medium || null,
      utmCampaign: body.utm_campaign || null,
      utmTerm: body.utm_term || null,
      utmContent: body.utm_content || null,
      rawPayload: body,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    console.error('Error processing website lead:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/leads/website',
    method: 'POST',
    timestamp: new Date().toISOString(),
  })
}
