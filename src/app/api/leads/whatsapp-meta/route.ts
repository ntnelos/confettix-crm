import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processIncomingLead } from '@/lib/processIncomingLead'

const getServiceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

const DEFAULT_VERIFY_TOKEN = process.env.META_WHATSAPP_VERIFY_TOKEN || 'confettix_meta_verify_2026'

const cleanWaPhone = (raw: string): string =>
  (raw || '')
    .replace('@c.us', '')
    .replace('@s.whatsapp.net', '')
    .replace(/^\+/, '')
    .replace(/^972/, '0')
    .trim()

const extractMetaMessageText = (msg: any): string => {
  if (!msg) return ''
  return (
    msg.text?.body ||
    msg.image?.caption ||
    msg.video?.caption ||
    msg.document?.caption ||
    msg.button?.text ||
    msg.interactive?.button_reply?.title ||
    msg.interactive?.list_reply?.title ||
    (msg.type === 'image' ? '[📷 תמונה]' : '') ||
    (msg.type === 'audio' ? '[🎤 הודעה קולית]' : '') ||
    (msg.type === 'video' ? '[🎥 וידאו]' : '') ||
    (msg.type === 'document' ? `[📄 מסמך: ${msg.document?.filename || ''}]` : '') ||
    ''
  )
}

/**
 * GET /api/leads/whatsapp-meta
 * Meta Webhook Verification Challenge
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === DEFAULT_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({
    ok: true,
    endpoint: '/api/leads/whatsapp-meta',
    note: 'Use this URL as the Meta WhatsApp Webhook Callback URL',
  })
}

/**
 * POST /api/leads/whatsapp-meta
 * Receives Meta WhatsApp Cloud API webhooks:
 * - `messages` (incoming messages from customers)
 * - `smb_message_echoes` (Coexistence outgoing messages sent manually from the WhatsApp Business mobile/desktop app)
 */
export async function POST(request: NextRequest) {
  const supabase = getServiceClient()

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  console.log('=== META WHATSAPP WEBHOOK ===')
  console.log(JSON.stringify(body, null, 2))

  if (body.object !== 'whatsapp_business_account') {
    return NextResponse.json({ skipped: true })
  }

  const results: any[] = []

  try {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const field = change.field
        const value = change.value || {}

        // 1. Incoming customer messages (`field === 'messages'`)
        if (field === 'messages' && Array.isArray(value.messages)) {
          const contactsMap: Record<string, string> = {}
          for (const c of value.contacts || []) {
            if (c.wa_id && c.profile?.name) {
              contactsMap[c.wa_id] = c.profile.name
            }
          }

          for (const msg of value.messages) {
            // Skip reaction-only events if empty
            if (msg.type === 'reaction') continue

            const customerWaId = msg.from || ''
            const cleanPhone = cleanWaPhone(customerWaId)
            const profileName = (contactsMap[customerWaId] || '').trim()
            const isPhoneLike = /^\+?[0-9\s\-]+$/.test(profileName)
            const senderName =
              profileName && profileName !== 'קונפטיקס נייד' && !isPhoneLike
                ? profileName
                : cleanPhone || null

            const messageText = extractMetaMessageText(msg)
            if (!cleanPhone && !messageText) continue

            const normalizedPayload = {
              provider: 'meta',
              typeWebhook: 'incomingMessageReceived',
              senderData: {
                chatId: `${customerWaId}@c.us`,
                sender: `${customerWaId}@c.us`,
                senderName: senderName || cleanPhone,
                chatName: senderName || cleanPhone,
              },
              messageData: msg,
              metaEntry: change,
            }

            const res = await processIncomingLead(supabase, {
              source: 'whatsapp',
              name: senderName,
              phone: cleanPhone || null,
              email: null,
              company: null,
              message: messageText,
              rawPayload: normalizedPayload,
            })
            results.push(res)
          }
        }

        // 2. Outgoing messages sent from the WhatsApp Business mobile app (`field === 'smb_message_echoes'`)
        const echoes = value.message_echoes || value.smb_message_echoes || []
        if ((field === 'smb_message_echoes' || echoes.length > 0) && Array.isArray(echoes)) {
          for (const echo of echoes) {
            const customerWaId = echo.to || ''
            const businessWaId = echo.from || '972528350600'
            const cleanPhone = cleanWaPhone(customerWaId)
            const messageText = extractMetaMessageText(echo)
            if (!cleanPhone && !messageText) continue

            // Format raw_payload with typeWebhook: 'outgoingMessageReceived' so the CRM UI renders a blue outgoing bubble ("← שלחנו")
            const normalizedPayload = {
              provider: 'meta',
              typeWebhook: 'outgoingMessageReceived',
              senderData: {
                chatId: `${customerWaId}@c.us`,
                sender: `${businessWaId}@c.us`,
                senderName: cleanPhone,
                chatName: cleanPhone,
              },
              messageData: echo,
              metaEntry: change,
            }

            const res = await processIncomingLead(supabase, {
              source: 'whatsapp',
              name: cleanPhone || null,
              phone: cleanPhone || null,
              email: null,
              company: null,
              message: messageText,
              rawPayload: normalizedPayload,
            })
            results.push(res)
          }
        }
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results })
  } catch (err: any) {
    console.error('Error processing Meta WhatsApp webhook:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
