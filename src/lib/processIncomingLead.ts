import { SupabaseClient } from '@supabase/supabase-js'

export interface IncomingLeadData {
  source: 'website' | 'whatsapp'
  name: string | null
  phone: string | null
  email: string | null
  company: string | null
  message: string | null
  giftType?: string | null
  quantity?: number | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmTerm?: string | null
  utmContent?: string | null
  rawPayload?: any
}

export type ProcessResult =
  | { action: 'message_added'; lead_id: string }
  | { action: 'inquiry_added'; contact_id: string }
  | { action: 'lead_created'; lead_id: string; is_existing_customer: boolean }

// Opportunity statuses that are considered "closed" (inactive)
const CLOSED_STATUSES = ['paid', 'closed_lost', 'won', 'lost']

/**
 * Core lead processing logic - shared between website and whatsapp webhooks.
 *
 * Algorithm:
 * 1. Check for an existing open lead (status='new') matching phone OR email
 *    → If found: append message to lead_messages, return
 * 2. Check for an existing contact matching phone OR email
 *    → If found: check if active (open opportunity OR activity in 30 days)
 *       → Active: add to contact_inquiries (silent for the team), return
 *       → Inactive: create new lead (is_existing_customer=true)
 * 3. No match: create new lead
 */
export async function processIncomingLead(
  supabase: SupabaseClient,
  data: IncomingLeadData
): Promise<ProcessResult> {
  const { source, name, phone, email, message, company, giftType, quantity, rawPayload } = data

  console.log(`[processIncomingLead] source=${source} phone=${phone} email=${email}`)

  // ─────────────────────────────────────────────
  // STEP 0: Check if sender is blacklisted ("לא לקוח")
  // ─────────────────────────────────────────────
  if (phone || email) {
    const orFilters: string[] = []
    if (phone) orFilters.push(`sender_phone.eq.${phone}`)
    if (email) orFilters.push(`sender_email.eq.${email}`)

    const { data: blacklistedLead } = await (supabase
      .from('leads')
      .select('id, lead_rejection_reasons!inner(label)')
      .eq('status', 'trash')
      .eq('lead_rejection_reasons.label', 'לא לקוח')
      .or(orFilters.join(',')) as any)
      .limit(1)
      .maybeSingle()

    if (blacklistedLead) {
      console.log(`[processIncomingLead] Dropping webhook: ${phone || email} is blacklisted ("לא לקוח")`)
      return { action: 'ignored', lead_id: blacklistedLead.id } as any
    }
  }

  // ─────────────────────────────────────────────
  // STEP 1: Check for an existing open lead
  // ─────────────────────────────────────────────
  if (phone || email) {
    const orFilters: string[] = []
    if (phone) {
      orFilters.push(`sender_phone.eq.${phone}`)
    }
    if (email) {
      orFilters.push(`sender_email.eq.${email}`)
    }

    const { data: openLead } = await (supabase
      .from('leads')
      .select('id')
      .eq('status', 'new')
      .or(orFilters.join(',')) as any)
      .limit(1)
      .maybeSingle()

    if (openLead) {
      // Append the new message to the existing lead
      await (supabase.from('lead_messages') as any).insert({
        lead_id: openLead.id,
        source,
        content: message,
        raw_payload: rawPayload ?? null,
      })

      // Touch the lead's updated_at so it surfaces in queries
      await (supabase.from('leads') as any)
        .update({ updated_at: new Date().toISOString() })
        .eq('id', openLead.id)

      console.log(`[processIncomingLead] Appended message to existing lead ${openLead.id}`)
      return { action: 'message_added', lead_id: openLead.id }
    }
  }

  // ─────────────────────────────────────────────
  // STEP 2: Check for an existing contact
  // ─────────────────────────────────────────────
  let matchedContactId: string | null = null

  if (phone || email) {
    const orFilters: string[] = []
    if (phone) {
      orFilters.push(`mobile.eq.${phone}`, `phone.eq.${phone}`)
    }
    if (email) {
      orFilters.push(`email.eq.${email}`)
    }

    const { data: existingContact } = await (supabase
      .from('contacts')
      .select('id, updated_at')
      .or(orFilters.join(',')) as any)
      .limit(1)
      .maybeSingle()

    if (existingContact) {
      matchedContactId = existingContact.id

      // ── Step 2.1: Is this contact "active"? ──
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const contactUpdatedAt: string = existingContact.updated_at

      // Check 1: Was contact updated in last 30 days?
      const recentlyUpdated = contactUpdatedAt > thirtyDaysAgo

      // Check 2: Has a recent inquiry in last 30 days?
      const { count: recentInquiryCount } = await (supabase
        .from('contact_inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('contact_id', matchedContactId)
        .gte('created_at', thirtyDaysAgo) as any)

      // Check 3: Has an open opportunity?
      const { data: openOpp } = await (supabase
        .from('opportunities')
        .select('id')
        .eq('contact_id', matchedContactId)
        .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`) as any)
        .limit(1)
        .maybeSingle()

      const isActive = recentlyUpdated || (recentInquiryCount ?? 0) > 0 || !!openOpp

      if (isActive) {
        // Add to contact inquiries — no lead created, no notification
        await (supabase.from('contact_inquiries') as any).insert({
          contact_id: matchedContactId,
          source,
          message,
          lead_id: null,
        })

        console.log(`[processIncomingLead] Active contact ${matchedContactId} — added inquiry silently`)
        return { action: 'inquiry_added', contact_id: matchedContactId! }
      }

      // Contact exists but is inactive → fall through to create new lead with is_existing_customer=true
      console.log(`[processIncomingLead] Inactive contact ${matchedContactId} — creating new lead`)
    }
  }

  // ─────────────────────────────────────────────
  // STEP 3: Create a new lead
  // ─────────────────────────────────────────────
  const leadPayload: any = {
    source,
    sender_name: name,
    sender_phone: phone,
    sender_email: email,
    company_name: company,
    message,                         // First message stored on lead for quick display
    gift_type: giftType ?? null,
    estimated_quantity: quantity ?? null,
    status: 'new',
    is_existing_customer: !!matchedContactId,
    matched_contact_id: matchedContactId,
    raw_payload: rawPayload ?? null,
  }

  // Add UTMs if present
  if (data.utmSource) leadPayload.utm_source = data.utmSource
  if (data.utmMedium) leadPayload.utm_medium = data.utmMedium
  if (data.utmCampaign) leadPayload.utm_campaign = data.utmCampaign
  if (data.utmTerm) leadPayload.utm_term = data.utmTerm
  if (data.utmContent) leadPayload.utm_content = data.utmContent

  const { data: lead, error } = await (supabase
    .from('leads')
    .insert(leadPayload)
    .select()
    .single() as any)

  if (error || !lead) {
    throw new Error(`Failed to create lead: ${error?.message}`)
  }

  // Also log the first message in lead_messages for consistent threading
  await (supabase.from('lead_messages') as any).insert({
    lead_id: lead.id,
    source,
    content: message,
    raw_payload: rawPayload ?? null,
  })

  console.log(`[processIncomingLead] Created new lead ${lead.id} (existing_customer=${!!matchedContactId})`)
  return { action: 'lead_created', lead_id: lead.id, is_existing_customer: !!matchedContactId }
}
