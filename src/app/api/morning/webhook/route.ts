import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getServiceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

/**
 * POST /api/morning/webhook
 *
 * Morning (Green Invoice) sends a webhook when a document is created/updated.
 * We listen for type=400 (קבלה / Receipt) events and use the linked invoice's
 * green_invoice_id to find the matching order + opportunity, then set both to "paid".
 *
 * Configure in Morning dashboard:
 *   Webhook URL → https://<your-domain>/api/morning/webhook
 *   Events      → Document created (or all)
 */
export async function POST(request: NextRequest) {
  const supabase = getServiceClient()

  try {
    const body = await request.json()

    // Morning webhook payload structure:
    // { event: 'document.created', data: { id, type, relatedDocuments: [...], ... } }
    const doc = body?.data ?? body

    const docType: number = Number(doc?.type)
    const docId: string = doc?.id    // Morning document ID of the receipt

    // Only handle receipts (type 400)
    if (docType !== 400) {
      return NextResponse.json({ skipped: true, reason: `type ${docType} is not a receipt (400)` })
    }

    if (!docId) {
      return NextResponse.json({ error: 'Missing document id in webhook payload' }, { status: 400 })
    }

    // Find the linked tax invoice (type 305) among related documents
    // Morning includes relatedDocuments array with the original invoice
    const relatedDocs: any[] = doc?.relatedDocuments ?? []
    const relatedInvoiceId: string | null =
      relatedDocs.find((d: any) => d.type === 305)?.id ?? null

    if (!relatedInvoiceId) {
      console.warn('Morning webhook: receipt has no related invoice (305). Payload:', JSON.stringify(doc))
      return NextResponse.json({ error: 'No related invoice (type 305) found in receipt' }, { status: 422 })
    }

    // Find the invoice in our DB by green_invoice_id
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('id, order_id')
      .eq('green_invoice_id', relatedInvoiceId)
      .single()

    if (invErr || !invoice) {
      console.error('Morning webhook: invoice not found for green_invoice_id', relatedInvoiceId, invErr)
      return NextResponse.json({ error: 'Invoice not found in DB' }, { status: 404 })
    }

    const orderId: string = invoice.order_id

    // Fetch the order to get opportunity_id
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, opportunity_id, status')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) {
      console.error('Morning webhook: order not found', orderId, orderErr)
      return NextResponse.json({ error: 'Order not found in DB' }, { status: 404 })
    }

    // Update order → paid
    await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId)

    // Update opportunity → paid (שולם)
    if (order.opportunity_id) {
      await supabase.from('opportunities').update({ status: 'paid' }).eq('id', order.opportunity_id)
    }

    // Insert Receipt into Invoices table
    const newReceipt = {
      order_id: orderId,
      green_invoice_id: docId,
      invoice_number: String(doc.documentNumber || doc.number || doc.document?.number || 'קבלה'),
      type: 'receipt',
      amount: doc.amount || doc.document?.amount || 0,
      pdf_url: doc.url?.he || doc.url?.origin || doc.pdfUrl || doc.documentUrl || null,
      status: 'issued',
      issued_at: new Date().toISOString()
    }
    
    const { error: receiptErr } = await supabase.from('invoices').insert(newReceipt)
    if (receiptErr) {
      console.error('Failed to create receipt record from webhook:', receiptErr)
    }

    console.log(`Morning webhook: Order ${orderId} and Opportunity ${order.opportunity_id} marked as paid via receipt ${docId}`)

    return NextResponse.json({ success: true, orderId, opportunityId: order.opportunity_id })

  } catch (err: any) {
    console.error('Morning webhook error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
