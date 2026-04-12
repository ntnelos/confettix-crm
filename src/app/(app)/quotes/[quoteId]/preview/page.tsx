'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Quote {
  id: string
  name: string
  quote_number: string
  opportunity_id: string
  shipping_cost: number
  vat_rate: number
  subtotal: number
  total_with_vat: number
  created_at: string
}

interface QuoteItem {
  id: string
  product_name: string
  description: string
  quantity: number
  unit_price: number
  discount_percent: number
  line_total: number
  image_url?: string
  woo_product_url?: string
}

interface Opportunity {
  subject: string
  contact_id: string
}

interface Contact {
  first_name: string
  last_name: string
}

export default function QuotePreviewPage() {
  const { quoteId } = useParams<{ quoteId: string }>()
  const supabase = createClient()
  const printRef = useRef<HTMLDivElement>(null)

  const [quote, setQuote] = useState<Quote | null>(null)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [opp, setOpp] = useState<Opportunity | null>(null)
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)

  // WhatsApp message state
  const [waPhone, setWaPhone] = useState('')
  const [showWaInput, setShowWaInput] = useState(false)

  // Email state
  const [emailTo, setEmailTo] = useState('')
  const [showEmailInput, setShowEmailInput] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: qData } = await (supabase.from('quotes') as any)
        .select('*').eq('id', quoteId).single()
      if (!qData) { setLoading(false); return }
      setQuote(qData)

      const { data: iData } = await (supabase.from('quote_items') as any)
        .select('*').eq('quote_id', quoteId).order('created_at')
      setItems(iData || [])

      if (qData.opportunity_id) {
        const { data: oppData } = await (supabase.from('opportunities') as any)
          .select('subject, contact_id').eq('id', qData.opportunity_id).single()
        setOpp(oppData)

        if (oppData?.contact_id) {
          const { data: cData } = await (supabase.from('contacts') as any)
            .select('first_name, last_name').eq('id', oppData.contact_id).single()
          setContact(cData)
        }
      }
      setLoading(false)
    }
    load()
  }, [quoteId])

  const handlePrint = () => window.print()

  const handleWhatsApp = () => {
    if (!waPhone) return
    const phone = waPhone.replace(/\D/g, '').replace(/^0/, '972')
    const pageUrl = window.location.href
    const msg = encodeURIComponent(
      `שלום,\n\nמצורפת הצעת המחיר שלנו עבורך:\n${pageUrl}\n\nבברכה,\nקונפטיקס`
    )
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  const handleEmail = () => {
    if (!emailTo) return
    const pageUrl = window.location.href
    const subject = encodeURIComponent(`הצעת מחיר ${quote?.quote_number || ''} - קונפטיקס`)
    const body = encodeURIComponent(
      `שלום,\n\nמצורפת הצעת המחיר שלנו:\n${pageUrl}\n\nבברכה,\nקונפטיקס\nמתנות ממותגות ואירועים\n052-8350600\nconfettixparty@gmail.com`
    )
    window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Heebo, sans-serif' }}>
      טוען...
    </div>
  )
  if (!quote) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Heebo, sans-serif' }}>
      הצעה לא נמצאה
    </div>
  )

  const contactName = contact ? `${contact.first_name} ${contact.last_name || ''}`.trim() : opp?.subject || ''

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Heebo', sans-serif; direction: rtl; background: #f0f2f5; }

        /* Toolbar — hidden on print */
        .send-toolbar {
          position: sticky;
          top: 0;
          z-index: 100;
          background: #0b1536;
          color: white;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          box-shadow: 0 2px 12px rgba(0,0,0,0.3);
        }
        .send-toolbar .tb-label { font-size: 13px; color: rgba(255,255,255,0.6); }
        .tb-btn {
          padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; border: none; display: flex; align-items: center; gap: 6px;
          transition: opacity 0.2s;
        }
        .tb-btn:hover { opacity: 0.85; }
        .tb-btn.green { background: #25D366; color: white; }
        .tb-btn.blue  { background: #3B82F6; color: white; }
        .tb-btn.dark  { background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); }
        .tb-btn.pink  { background: #e40187; color: white; }
        .inline-input {
          padding: 7px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.1); color: white; font-size: 13px; outline: none;
          width: 180px; direction: ltr;
        }
        .inline-input::placeholder { color: rgba(255,255,255,0.5); }

        /* Quote document */
        .quote-doc {
          max-width: 800px;
          margin: 28px auto 60px;
          background: white;
          padding: 48px 52px;
          box-shadow: 0 4px 30px rgba(0,0,0,0.12);
          border-radius: 4px;
        }

        /* Header */
        .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
        .logo-box {
          width: 160px; height: 110px; border: 1.5px solid #ddd;
          display: flex; align-items: center; justify-content: center;
          border-radius: 4px; overflow: hidden;
        }
        .logo-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .doc-meta { font-size: 13px; color: #444; text-align: right; }
        .doc-meta .meta-date { color: #666; font-size: 12px; margin-top: 4px; }

        /* Title */
        .doc-title {
          text-align: center; font-size: 26px; font-weight: 800;
          margin-bottom: 24px; color: #111;
          border-bottom: 2px solid #eee; padding-bottom: 16px;
        }

        /* Table */
        .quote-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
        .quote-table thead tr { background: #c8c8c8; }
        .quote-table thead th {
          padding: 10px 12px; text-align: right; font-weight: 700; color: #222;
          border: 1px solid #bbb;
        }
        .quote-table tbody tr { border-bottom: 1px solid #e5e5e5; }
        .quote-table tbody tr:nth-child(even) { background: #fafafa; }
        .quote-table tbody td { padding: 10px 12px; vertical-align: top; color: #333; border: 1px solid #e5e5e5; }
        .quote-table tbody td.line-total { font-weight: 700; white-space: nowrap; }

        /* Shipping row */
        .shipping-row td { background: #f5f5f5; font-weight: 500; }

        /* Disclaimers */
        .disclaimers {
          margin-top: 20px; padding: 16px 20px;
          border: 1px solid #e5e5e5; border-radius: 4px;
          background: #fafafa; font-size: 12px; color: #555; line-height: 1.8;
        }
        .disclaimers li { margin-right: 12px; }

        /* Footer */
        .doc-footer {
          margin-top: 36px; text-align: center;
          border-top: 2px solid #e5e5e5; padding-top: 24px;
        }
        .doc-footer .footer-greeting { font-size: 14px; color: #555; margin-bottom: 6px; }
        .doc-footer .footer-name { font-size: 22px; font-weight: 800; color: #111; }
        .doc-footer .footer-tagline { font-size: 13px; color: #777; margin-top: 2px; }
        .doc-footer .footer-contact { font-size: 13px; color: #555; margin-top: 8px; }
        .logo-footer { width: 60px; margin: 12px auto 0; display: block; }

        @media print {
          .send-toolbar { display: none !important; }
          body { background: white; }
          .quote-doc { box-shadow: none; margin: 0; max-width: 100%; border-radius: 0; padding: 32px 40px; }
        }
      `}</style>

      {/* ─── Sticky Send Toolbar ─── */}
      <div className="send-toolbar">
        <span className="tb-label">שלח הצעה:</span>

        {/* WhatsApp */}
        {!showWaInput ? (
          <button className="tb-btn green" onClick={() => { setShowWaInput(true); setShowEmailInput(false) }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.096.54 4.064 1.482 5.775L0 24l6.388-1.463A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.044-1.39l-.36-.214-3.733.854.876-3.648-.235-.374A9.818 9.818 0 0 1 12 2.182c5.42 0 9.818 4.398 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z"/></svg>
            ווצאפ
          </button>
        ) : (
          <>
            <input className="inline-input" type="tel" placeholder="מספר טלפון (050...)" value={waPhone} onChange={e => setWaPhone(e.target.value)} />
            <button className="tb-btn green" onClick={handleWhatsApp}>שלח</button>
            <button className="tb-btn dark" onClick={() => setShowWaInput(false)}>ביטול</button>
          </>
        )}

        {/* Email */}
        {!showEmailInput ? (
          <button className="tb-btn blue" onClick={() => { setShowEmailInput(true); setShowWaInput(false) }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>
            מייל
          </button>
        ) : (
          <>
            <input className="inline-input" type="email" placeholder="כתובת מייל" value={emailTo} onChange={e => setEmailTo(e.target.value)} />
            <button className="tb-btn blue" onClick={handleEmail}>שלח</button>
            <button className="tb-btn dark" onClick={() => setShowEmailInput(false)}>ביטול</button>
          </>
        )}

        {/* PDF / Print */}
        <button className="tb-btn pink" onClick={handlePrint}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          הדפס / PDF
        </button>
      </div>

      {/* ─── Quote Document ─── */}
      <div className="quote-doc" ref={printRef}>

        {/* Header */}
        <div className="doc-header">
          <div className="logo-box">
            <img src="/confettix-logo.png" alt="קונפטיקס" onError={e => { e.currentTarget.style.display = 'none' }} />
          </div>
          <div className="doc-meta">
            {contactName && (
              <div style={{ marginBottom: 4 }}>
                <strong>לכבוד:</strong> {contactName}
              </div>
            )}
            <div className="meta-date">{formatDate(quote.created_at)}</div>
          </div>
        </div>

        {/* Title */}
        <div className="doc-title">הצעת מחיר {quote.quote_number || ''}</div>

        {/* Products table */}
        <table className="quote-table">
          <thead>
            <tr>
              <th style={{ width: '35%' }}>מוצר</th>
              <th style={{ width: '30%' }}>תיאור</th>
              <th style={{ width: '10%', textAlign: 'center' }}>כמות</th>
              <th style={{ width: '12%', textAlign: 'center' }}>מחיר</th>
              <th style={{ width: '13%', textAlign: 'center' }}>סה״כ</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td style={{ fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.image_url && (
                      <img src={item.image_url} alt="" width={32} height={32} style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                    )}
                    {item.product_name}
                  </div>
                </td>
                <td style={{ fontSize: 12, color: '#555' }}>{item.description || ''}</td>
                <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ textAlign: 'center' }}>₪{item.unit_price.toFixed(2)}</td>
                <td className="line-total" style={{ textAlign: 'center' }}>₪{item.line_total.toFixed(2)}</td>
              </tr>
            ))}
            {/* Shipping row if > 0 */}
            {quote.shipping_cost > 0 && (
              <tr className="shipping-row">
                <td>משלוח</td>
                <td></td>
                <td style={{ textAlign: 'center' }}>1.00</td>
                <td style={{ textAlign: 'center' }}>₪{quote.shipping_cost.toFixed(2)}</td>
                <td className="line-total" style={{ textAlign: 'center' }}>₪{quote.shipping_cost.toFixed(2)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Disclaimers */}
        <div className="disclaimers">
          <ul style={{ paddingRight: 16 }}>
            <li>התאמת עיצוב מעיצובים קיימים, הדפסה מיתוג של שם אישי, הקדשה ולוגו לא תופסת תשלום.</li>
            <li>עיצוב חדש בהתאמה אישית – 500 ש״ח.</li>
            <li>מחירים לא כוללים מע״מ.</li>
          </ul>
          <div style={{ marginTop: 12, fontWeight: 600 }}>תשלום בהעברה בנקאית עם אישור הצעת המחיר</div>
        </div>

        {/* Footer */}
        <div className="doc-footer">
          <div className="footer-greeting">בברכה,</div>
          <div className="footer-name">קונפטיקס</div>
          <div className="footer-tagline">מתנות ממותגות ואירועים</div>
          <div className="footer-contact">
            טלפון 052-8350600 &nbsp;|&nbsp; confettixparty@gmail.com
          </div>
          <img
            src="/confettix-logo.png"
            className="logo-footer"
            alt="לוגו קונפטיקס"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        </div>
      </div>
    </>
  )
}
