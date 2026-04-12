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
  { params }: { params: Promise<{ quoteId: string }> }
) {
  const { quoteId } = await params
  const supabase = getServiceClient()

  // 1. Fetch the Order record bridging to the Quote
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*')
    .eq('quote_id', quoteId)
    .single()

  if (!order) {
    console.error('Order fetch error:', orderErr)
    return NextResponse.json({ error: `Order not found: ${orderErr?.message || 'No specific error'}` }, { status: 404 })
  }

  // 2. Fetch the Quote + items
  const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).single()
  const { data: items } = await supabase.from('quote_items').select('*').eq('quote_id', quoteId).order('sort_order')

  // 3. Fetch Organization + Addresses + Subject
  let org = null
  let addresses = []
  let opp_subject = ''
  if (order.opportunity_id) {
     const { data: oppData } = await supabase.from('opportunities').select('organization_id, subject').eq('id', order.opportunity_id).single()
     if (oppData) {
         opp_subject = oppData.subject || ''
         if (oppData.organization_id) {
             const { data: orgData } = await supabase.from('organizations').select('*').eq('id', oppData.organization_id).single()
             org = orgData
             
             const { data: addrs } = await supabase.from('delivery_addresses').select('*').eq('organization_id', oppData.organization_id)
             addresses = addrs || []
         }
     }
  }
  
  // 4. Fetch the payment method & contact from opportunity
  let payment_method = null;
  let contact = null;
  if (order.opportunity_id) {
    const { data: oppForPay } = await supabase.from('opportunities').select('payment_method, contact_id').eq('id', order.opportunity_id).single()
    if (oppForPay) {
       payment_method = oppForPay.payment_method;
       if (oppForPay.contact_id) {
          const { data: contactData } = await supabase.from('contacts').select('*').eq('id', oppForPay.contact_id).single()
          contact = contactData
       }
    }
  }

  return NextResponse.json({ order, quote, items: items || [], org, addresses, payment_method, contact, opp_subject })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  const { quoteId } = await params
  const supabase = getServiceClient()
  
  try {
    const body = await request.json()
    const { 
      invoice_company_name, 
      company_number, 
      payment_method, 
      delivery_address_id, 
      new_address, 
      signature_data,
      total_amount 
    } = body

    // 1. Get the existing order ID
    const { data: order } = await supabase.from('orders').select('id, opportunity_id').eq('quote_id', quoteId).single()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // 2. Handle new address logic
    let final_address_id = delivery_address_id
    if (new_address && new_address.street && new_address.city) {
      // Find orig org id
      const { data: opp } = await supabase.from('opportunities').select('organization_id').eq('id', order.opportunity_id).single()
      if (opp?.organization_id) {
        const { data: insertAddr } = await supabase.from('delivery_addresses').insert({
           organization_id: opp.organization_id,
           street: new_address.street,
           city: new_address.city,
           label: new_address.label || 'כתובת מהזמנה',
           contact_name: new_address.contact_name || null,
           contact_phone: new_address.contact_phone || null
        }).select('id').single()
        if (insertAddr) final_address_id = insertAddr.id
      }
    }

    // 3. Update the Organization (if exists)
    let oppOrgId = null;
    const { data: oppForOrg } = await supabase.from('opportunities').select('organization_id').eq('id', order.opportunity_id).single()
    if (oppForOrg?.organization_id) {
       oppOrgId = oppForOrg.organization_id;
       await supabase.from('organizations').update({
         invoice_company_name,
         company_number
       }).eq('id', oppOrgId)
    }

    // 4. Update the Opportunity (payment method & status)
    if (order.opportunity_id) {
      await supabase.from('opportunities').update({
        payment_method,
        status: 'won'
      }).eq('id', order.opportunity_id)
    }

    // 5. Update the Order
    const { data: updatedOrder, error } = await supabase.from('orders').update({
       delivery_address_id: final_address_id || null,
       signature_data,
       total_amount, // The final amount including the check fee if applicable
       status: 'signed',
       signed_at: new Date().toISOString()
    }).eq('id', order.id).select().single()

    if (error) throw error

    return NextResponse.json({ success: true, order: updatedOrder })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
