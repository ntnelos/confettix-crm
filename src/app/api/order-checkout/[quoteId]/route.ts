import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

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
  let org: any = null
  let addresses: any[] = []
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

  // 5. Fetch expected delivery from opportunity
  let expected_delivery = null;
  if (order.opportunity_id) {
     const { data: oppDate } = await supabase.from('opportunities').select('expected_delivery').eq('id', order.opportunity_id).single()
     if (oppDate) expected_delivery = oppDate.expected_delivery
  }

  return NextResponse.json({ order, quote, items: items || [], org, addresses, payment_method, contact, opp_subject, expected_delivery })
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
      total_amount,
      contact_name,
      contact_phone
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

    // 4. Update the Opportunity (payment method, status, value, and delivery date)
    if (order.opportunity_id) {
      await supabase.from('opportunities').update({
        payment_method,
        status: 'won',
        calculated_value: total_amount,
        expected_delivery: body.expected_delivery // Extracting from body
      }).eq('id', order.opportunity_id)
    }

    // 4.5 Update the Contact (if exists)
    if (order.opportunity_id) {
       const { data: oppForContact } = await supabase.from('opportunities').select('contact_id').eq('id', order.opportunity_id).single()
       if (oppForContact?.contact_id) {
          await supabase.from('contacts').update({
            name: contact_name,
            mobile: contact_phone // Using mobile for the phone number entered in the form
          }).eq('id', oppForContact.contact_id)
       }
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

    // 6. Send Emails via Resend
    let clientEmail = null;
    if (order.opportunity_id) {
       const { data: oppForContact } = await supabase.from('opportunities').select('contact_id').eq('id', order.opportunity_id).single()
       if (oppForContact?.contact_id) {
          const { data: contactData } = await supabase.from('contacts').select('email').eq('id', oppForContact.contact_id).single()
          if (contactData?.email) {
             clientEmail = contactData.email;
          }
       }
    }

    try {
        const orderLink = `https://confettix-crm.vercel.app/orders/${quoteId}/checkout?mode=readOnly`;
        const emailDate = new Date().toLocaleDateString('he-IL');
        const customerName = contact_name || invoice_company_name || 'לקוח יקר';

        // Send to Client
        if (clientEmail) {
            await resend.emails.send({
                from: 'Confettix <orders@confettix.co.il>',
                to: [clientEmail],
                subject: 'הזמנתך אושרה בהצלחה! - קונפטיקס מתנות',
                html: `
<div dir="rtl" style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; text-align: right;">
  <div style="text-align: center; margin-bottom: 20px;">
    <img src="https://confettix-crm.vercel.app/confettix-logo.png" alt="קונפטיקס מתנות בע״מ" style="max-height: 80px;" />
  </div>
  <h2 style="color: #131b40; margin-bottom: 5px;">קונפטיקס מתנות בע״מ</h2>
  <p style="color: #64748b; margin-top: 0;">${emailDate}</p>
  
  <h1 style="color: #ec4899;">הזמנתך אושרה בהצלחה!</h1>
  
  <p style="font-size: 16px;">שלום ${customerName},</p>
  <p style="font-size: 16px;">מצ"ב הזמנה חתומה.</p>
  
  <div style="margin: 30px 0; text-align: center;">
    <a href="${orderLink}" 
       style="background-color: #ec4899; color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 18px; display: inline-block; box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3);">
      לצפייה במסמך החתום
    </a>
  </div>
  
  <p style="font-size: 12px; color: #94a3b8; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
    לחיצה על הקישור להורדת המסמך מהווה הסכמתך לקבל מסמך חתום דיגיטלית בדואר אלקטרוני.
  </p>
</div>
                `
            });
        }

        // Send to Admin
        await resend.emails.send({
            from: 'Confettix <orders@confettix.co.il>',
            to: ['office@confettix.co.il'],
            subject: `הזמנה חתומה חדשה: ${invoice_company_name}`,
            html: `
<div dir="rtl" style="font-family: Arial, sans-serif; text-align: right;">
  <h2>הזמנה חתומה חדשה! 🎉</h2>
  <p>לקוח: <strong>${invoice_company_name}</strong></p>
  <p>איש קשר: <strong>${contact_name}</strong></p>
  <p>סכום: <strong>₪${total_amount}</strong></p>
  <p><a href="${orderLink}">צפה בהזמנה החתומה</a></p>
</div>
            `
        });
    } catch (emailErr) {
        console.error('Error sending emails:', emailErr);
    }

    return NextResponse.json({ success: true, order: updatedOrder })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
