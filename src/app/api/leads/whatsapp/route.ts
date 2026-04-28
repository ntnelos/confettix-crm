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
 * POST /api/leads/whatsapp
 *
 * Receives webhooks from Green API.
 * Delegates routing logic to processIncomingLead().
 */
export async function POST(request: NextRequest) {
  const supabase = getServiceClient()

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  console.log('=== WHATSAPP LEAD WEBHOOK (Green API) ===')
  console.log('Timestamp:', new Date().toISOString())
  console.log('Raw payload:', JSON.stringify(body, null, 2))
  console.log('=========================================')

  // ── Handle incoming and outgoing message webhooks ──
  const webhookType = body.typeWebhook
  const allowedWebhooks = [
    'incomingMessageReceived',
    'incomingMessage',
    'outgoingMessageReceived',
    'outgoingAPIMessageReceived'
  ]
  if (!allowedWebhooks.includes(webhookType)) {
    console.log('Skipping non-message webhook:', webhookType)
    return NextResponse.json({ skipped: true, typeWebhook: webhookType })
  }

  // ── Extract sender info ──
  const senderData = body.senderData || body.sender || {}
  const messageData = body.messageData || body.message || {}

  // Phone: Green API sends in format "972521234567@c.us" → clean to local format
  // For incoming messages, prioritize `sender` (important for groups @g.us where chatId is the group ID).
  // For outgoing messages, `sender` is our business number, so we must prioritize `chatId` (the customer).
  let rawPhone: string = ''
  
  if (webhookType.startsWith('outgoing')) {
    rawPhone = senderData.chatId || senderData.sender || senderData.phone || ''
  } else {
    rawPhone = senderData.sender || senderData.chatId || senderData.phone || ''
  }

  const cleanPhone = rawPhone
    .replace('@c.us', '')
    .replace('@g.us', '')
    .replace('@s.whatsapp.net', '')
    .replace(/^972/, '0')
    .trim()

  const senderName: string | null =
    senderData.senderName ||
    senderData.senderContactName ||
    senderData.name ||
    senderData.pushName ||
    null

  // ── Extract message text ──
  let messageText: string =
    messageData?.textMessageData?.textMessage ||
    messageData?.text ||
    messageData?.body ||
    messageData?.caption ||
    body.text ||
    ''

  // ── Handle Media Attachments ──
  const image = messageData?.imageMessageData
  const video = messageData?.videoMessageData
  const doc = messageData?.documentMessageData
  const audio = messageData?.audioMessageData
  const fileMsg = messageData?.fileMessageData

  const downloadUrl = image?.downloadUrl || video?.downloadUrl || doc?.downloadUrl || audio?.downloadUrl || fileMsg?.downloadUrl
  const mimeType = image?.mimeType || video?.mimeType || doc?.mimeType || audio?.mimeType || fileMsg?.mimeType || 'application/octet-stream'
  const fileName = doc?.fileName || fileMsg?.fileName || 'whatsapp_media'

  if (downloadUrl) {
    try {
      console.log(`Downloading media from Green API: ${downloadUrl}`)
      const res = await fetch(downloadUrl)
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        console.log(`Uploading to Google Drive... (${buffer.length} bytes)`)
        const { uploadFileToDrive } = await import('@/lib/google-drive')
        const driveResult = await uploadFileToDrive(buffer, fileName, mimeType)
        
        const mediaTag = `\n\n[📎 קובץ מצורף] ${driveResult.url}`
        messageText = messageText ? messageText + mediaTag : mediaTag
      } else {
        console.error('Failed to download media from Green API:', res.statusText)
      }
    } catch (err) {
      console.error('Error handling media attachment:', err)
    }
  }

  if (!cleanPhone && !messageText) {
    return NextResponse.json({ skipped: true, reason: 'No phone or message' })
  }

  try {
    const result = await processIncomingLead(supabase, {
      source: 'whatsapp',
      name: senderName,
      phone: cleanPhone || null,
      email: null,
      company: null,
      message: messageText,
      rawPayload: body,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    console.error('Error processing WhatsApp lead:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/leads/whatsapp',
    method: 'POST',
  })
}
