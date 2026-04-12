import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getServiceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }  // Next.js 15+ params is a Promise
) {
  const { quoteId } = await params   // must await!
  const supabase = getServiceClient()

  // 1. Quote
  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single()

  if (!quote) {
    return NextResponse.json(
      { error: 'Quote not found', detail: qErr?.message },
      { status: 404 }
    )
  }

  // 2. Items
  const { data: items } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', quoteId)
    .order('created_at')

  // 3. Opportunity → Contact + Org
  let opp = null, contact = null, org = null
  if (quote.opportunity_id) {
    const { data: oppData } = await supabase
      .from('opportunities')
      .select('subject, contact_id, organization_id')
      .eq('id', quote.opportunity_id)
      .single()

    if (oppData) {
      opp = oppData

      if (oppData.contact_id) {
        const { data: c } = await supabase
          .from('contacts')
          .select('first_name, last_name')
          .eq('id', oppData.contact_id)
          .single()
        contact = c
      }

      if (oppData.organization_id) {
        const { data: o } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', oppData.organization_id)
          .single()
        org = o
      }
    }
  }

  return NextResponse.json({ quote, items: items || [], opp, contact, org })
}
