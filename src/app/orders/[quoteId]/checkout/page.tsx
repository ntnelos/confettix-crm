'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import SignaturePad from '@/components/SignaturePad'

interface OrderData {
  order: any
  quote: any
  items: any[]
  org: any
  addresses: any[]
  opp_subject?: string
  expected_delivery?: string | null
}

export default function OrderCheckoutPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const quoteId = params.quoteId as string
  const viewMode = searchParams.get('mode')
  const isReadOnly = viewMode === 'readOnly'

  const [data, setData] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Form state
  const [invoiceCompany, setInvoiceCompany] = useState('')
  const [companyNumber, setCompanyNumber] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')

  // Address State
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [newAddress, setNewAddress] = useState({ label: '', street: '', city: '', contact_name: '', contact_phone: '' })

  // Contact details
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  // Signature
  const [signature, setSignature] = useState<string | null>(null)
  const [expectedDelivery, setExpectedDelivery] = useState<string>('')

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/order-checkout/${quoteId}`)
        if (!res.ok) throw new Error('Order not found or invalid access')
        const json = await res.json()
        setData(json)

        if (json.order.invoice_company_name || json.org?.invoice_company_name) {
          setInvoiceCompany(json.order.invoice_company_name || json.org?.invoice_company_name || '')
        } else if (json.org?.name) {
          setInvoiceCompany(json.org.name)
        }

        if (json.order.company_number || json.org?.company_number) {
          setCompanyNumber(json.order.company_number || json.org?.company_number || '')
        }

        if (json.order.delivery_address_id) {
          setSelectedAddressId(json.order.delivery_address_id)
        } else if (json.addresses?.length > 0) {
          setSelectedAddressId(json.addresses[0].id)
        } else {
          setSelectedAddressId('new')
        }

        if (json.payment_method) {
          setPaymentMethod(json.payment_method)
        }

        if (json.contact) {
          setContactName(json.contact.name || '')
          setContactPhone(json.contact.mobile || json.contact.phone || '')
          setContactEmail(json.contact.email || '')
        }

        if (json.expected_delivery) {
          setExpectedDelivery(json.expected_delivery)
        }

        if (json.order?.signature_data) {
          setSignature(json.order.signature_data)
        }

      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [quoteId])

  const calculateFinalTotal = () => {
    if (!data?.quote) return 0
    let baseTotal = parseFloat(data.quote.total_with_vat)
    if (paymentMethod === 'check_delivery') {
      baseTotal += 25
    }
    return baseTotal
  }

  const handleSubmit = async () => {
    if (!signature) {
      alert("נא להוסיף חתימה לאישור העסקה.")
      return
    }

    if (selectedAddressId === 'new' && (!newAddress.street || !newAddress.city)) {
      alert("נא למלא עיר ורחוב לכתובת האספקה.")
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        invoice_company_name: invoiceCompany,
        company_number: companyNumber,
        payment_method: paymentMethod,
        delivery_address_id: selectedAddressId === 'new' ? null : selectedAddressId,
        new_address: selectedAddressId === 'new' ? newAddress : null,
        signature_data: signature,
        total_amount: calculateFinalTotal(),
        expected_delivery: expectedDelivery,
        contact_name: contactName,
        contact_phone: contactPhone
      }

      const res = await fetch(`/api/order-checkout/${quoteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('Failed to submit order processing')

      setSuccess(true)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleWhatsAppShare = () => {
    const phone = window.prompt('הזן מספר וואטסאפ (לדוגמה: 0501234567):', contactPhone);
    if (phone) {
      let cleanPhone = phone.replace(/[^\d+]/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '972' + cleanPhone.substring(1);
      }

      const orgNameText = data?.org?.name ? ` - ${data.org.name}` : '';
      const text = `הצעת מחיר${orgNameText}
לינק להזמנה:
${window.location.href}

ניתן לחתום דיגיטלית על המסמך
בברכה,
קונפטיקס`;

      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
    }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Heebo,sans-serif' }}>טוען נתוני הזמנה...</div>
  if (error || !data) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Heebo,sans-serif' }}>{error || 'הזמנה לא נמצאה'}</div>

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 20, fontFamily: 'Heebo, sans-serif' }}>
        <div style={{ background: 'white', padding: 40, borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.05)', textAlign: 'center', maxWidth: 400 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#4caf50' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: '#131b40' }}>ההזמנה אושרה בהצלחה!</h1>
          <p style={{ color: '#64748b', lineHeight: 1.5 }}>
            פרטי ההזמנה התקבלו ונשמרו במערכת. עותק חוזה יישלח לכתובת המייל המקושרת במידה וקיימת.
          </p>
        </div>
      </div>
    )
  }

  const { quote, items, org, addresses } = data

  return (
    <>
      {isReadOnly && (
        <div className="no-print" style={{ position: 'fixed', bottom: 30, left: 30, zIndex: 1000 }}>
          <button onClick={() => window.print()} style={{ padding: '12px 24px', background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 50, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🖨️</span>
            הדפס / שמור כ-PDF
          </button>
        </div>
      )}
      {/* ----------------- PRINT ONLY LAYOUT ----------------- */}
      <div className="print-only-layout" style={{ display: isReadOnly ? 'block' : 'none', background: 'white', color: 'black', fontFamily: 'Heebo, sans-serif', padding: isReadOnly ? '40px 48px' : 40, direction: 'rtl', margin: isReadOnly ? '0 auto' : '0', maxWidth: isReadOnly ? 860 : 'none', boxShadow: isReadOnly ? '0 0 40px rgba(0,0,0,0.1)' : 'none', minHeight: isReadOnly ? '100vh' : 'auto' }}>

        {/* Print Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #e93b7e', paddingBottom: 20, marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 4px', color: '#131b40' }}>הזמנה מס&apos; {quote?.quote_number || quoteId.substring(0, 4)}</h1>
            <div style={{ fontSize: 14, color: '#555', fontWeight: 600 }}>לכבוד: {org?.name || 'לקוח מזדמן'}{contactName ? ` — ${contactName}` : ''}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
              {new Date(quote?.created_at || new Date()).toLocaleDateString('he-IL')} {new Date(quote?.created_at || new Date()).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <img src="/confettix-logo.png" alt="קונפטיקס" style={{ height: 52 }} />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 14, borderRadius: 8, overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: '#131b40', color: 'white' }}>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>מוצר</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>תיאור</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>כמות</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>מחיר יח&apos;</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>סה&quot;כ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>{item.product_name}</td>
                <td style={{ padding: '12px 16px', color: '#555', fontSize: 13 }}>{item.description || ''}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>₪{parseFloat(item.unit_price).toFixed(2)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800 }}>₪{parseFloat(item.line_total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals block */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div style={{ minWidth: 260, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <span>סכום מוצרים</span><span style={{ fontWeight: 600 }}>₪{parseFloat(quote?.subtotal || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
              <span>משלוח</span><span style={{ fontWeight: 600 }}>₪{parseFloat(quote?.shipping_cost || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <span>מע&quot;מ (18%)</span><span style={{ fontWeight: 600 }}>₪{((parseFloat(quote?.subtotal || 0) + parseFloat(quote?.shipping_cost || 0)) * 0.18).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#131b40', color: 'white' }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>סה&quot;כ לתשלום</span>
              <span style={{ fontWeight: 900, fontSize: 16 }}>₪{calculateFinalTotal().toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 40, marginTop: 20, fontSize: 13, lineHeight: 1.6, fontWeight: 700, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>🎨</span>
              <span>התאמת עיצוב מעיצובים קיימים, תוספת מיתוג של שם אישי, הקדשה ולוגו ללא תוספת תשלום.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>✨</span>
              <span>עיצוב חדש בהתאמה - 500 ש"ח</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>📬</span>
              <span>אני מאשר/ת קבלת דיוורים מקונפטיקס</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>💳</span>
              <span>תשלום בהעברה בנקאית עם אישור הצעת המחיר</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div style={{ background: '#131b40', color: 'white', padding: '8px 16px', fontWeight: 800, fontSize: 14 }}>
            📋 פרטי ההזמנה
          </div>

          <div style={{ padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 16px', marginBottom: 16 }}>
              <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #f1f5f9' }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2, fontWeight: 600 }}>חשבונית על שם</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{invoiceCompany || '_________________'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #f1f5f9' }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2, fontWeight: 600 }}>ח&quot;פ / עוסק מורשה</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{companyNumber || '_________________'}</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #f1f5f9' }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2, fontWeight: 600 }}>איש קשר</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{contactName || '_________________'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #f1f5f9' }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2, fontWeight: 600 }}>טלפון</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{contactPhone || '_________________'}</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #f1f5f9' }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2, fontWeight: 600 }}>כתובת לאספקה</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedAddressId === 'new' ? (newAddress.street ? `${newAddress.street}, ${newAddress.city}` : '_________________') : (addresses.find(a => a.id === selectedAddressId)?.street ? `${addresses.find(a => a.id === selectedAddressId)?.street}, ${addresses.find(a => a.id === selectedAddressId)?.city}` : '_________________')}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #f1f5f9' }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2, fontWeight: 600 }}>תאריך אספקה</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{expectedDelivery ? new Date(expectedDelivery).toLocaleDateString('he-IL') : '_________________'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 16px', borderRadius: 6, border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
                <strong style={{ color: '#64748b' }}>צורת תשלום:</strong>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}><input type="checkbox" checked={paymentMethod === 'bank_transfer'} readOnly style={{ width: 14, height: 14, accentColor: 'black' }} /> העברה בנקאית</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}><input type="checkbox" checked={paymentMethod === 'check_delivery'} readOnly style={{ width: 14, height: 14, accentColor: 'black' }} /> צ&apos;ק לשליח</label>
              </div>

              <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <strong style={{ color: '#64748b' }}>חתימה:</strong>
                {signature ? (
                  <img src={signature} alt="Signature" style={{ height: 40, display: 'inline-block' }} />
                ) : (
                  <span style={{ display: 'inline-block', width: '150px', borderBottom: '1px solid #cbd5e1' }}></span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 48, borderTop: '2px solid #e2e8f0', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#444' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#131b40' }}>קונפטיקס — מתנות ממותגות ומיתוג אירועים</div>
            <div style={{ fontSize: 13, marginTop: 2, direction: 'ltr', textAlign: 'right' }}>052-8350600 | confettixparty@gmail.com</div>
          </div>
          <img src="/confettix-logo.png" alt="קונפטיקס" style={{ height: 44 }} />
        </div>
      </div>
      {/* ----------------- END PRINT ONLY LAYOUT ----------------- */}

      {!isReadOnly && (
        <>
          <div className="send-toolbar no-print">
            <span className="tb-label">פעולות:</span>
            <button className="tb-btn green" onClick={handleWhatsAppShare}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.096.54 4.064 1.482 5.775L0 24l6.388-1.463A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.044-1.39l-.36-.214-3.733.854.876-3.648-.235-.374A9.818 9.818 0 0 1 12 2.182c5.42 0 9.818 4.398 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z" />
              </svg>
              ווצאפ
            </button>
            <button className="tb-btn blue" onClick={() => {
              navigator.clipboard.writeText(window.location.href)
              alert('הקישור הועתק ללוח!')
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              העתק קישור
            </button>
            <button className="tb-btn pink" onClick={() => window.print()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              הדפס / PDF
            </button>
          </div>
          <div className="web-main-container" style={{ minHeight: '100vh', background: '#f1f5f9', padding: '40px 20px', fontFamily: 'Heebo, sans-serif', color: '#1e293b' }}>
            <main style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Header */}
              <div className="no-print checkout-header" style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <img src="/confettix-logo.png" alt="קונפטיקס" style={{ marginBottom: 12, maxWidth: 150, alignSelf: 'center' }} />
                  <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: '#4caf50', marginBottom: 8 }}>סיכום וסגירת הזמנה</h1>
                  <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>{data?.opp_subject || 'הזמנה'}&nbsp;<strong>{org.name}</strong></p>
                </div>
              </div>

              {/* 🛒 Order Summary — shown first so customer knows what they're signing */}
              <div style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, color: '#131b40', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🛒</span> פירוט ההזמנה
                </h2>
                {/* Desktop view: Table */}
                <div className="desktop-only table-responsive-wrapper" style={{ overflowX: 'auto', marginBottom: 20 }}>
                  <table className="desktop-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40%' }}>מוצר ותיאור</th>
                        <th style={{ width: '15%', textAlign: 'center' }}>כמות</th>
                        <th style={{ width: '20%', textAlign: 'center' }}>מחיר ליח׳</th>
                        <th style={{ width: '25%', textAlign: 'center' }}>סה״כ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any) => (
                        <tr key={item.id}>
                          <td>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{item.product_name}</div>
                            {item.description && <div style={{ fontSize: 13, color: '#64748b', whiteSpace: 'pre-wrap', marginTop: 4 }}>{item.description}</div>}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.quantity} יח׳</td>
                          <td style={{ textAlign: 'center' }}>
                            ₪{parseFloat(item.unit_price).toFixed(2)}
                            {item.discount_percent > 0 && (
                              <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>(-{item.discount_percent}%)</div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>₪{parseFloat(item.line_total).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view: Cards */}
                <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px 8px', borderBottom: '2px solid #e2e8f0', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>פירוט פריטים</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>סה״כ</span>
                  </div>
                  {items.map((item: any) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 14, borderBottom: '1px solid #f1f5f9', paddingBottom: 14, gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{item.product_name}</div>
                        {item.description && <div style={{ fontSize: 13, color: '#64748b', whiteSpace: 'pre-wrap', lineHeight: 1.5, marginBottom: 4 }}>{item.description}</div>}
                        <div style={{ color: '#000', fontSize: 13, fontWeight: 700 }}>
                          {item.quantity} יח׳ 
                          <span style={{ color: '#64748b', fontWeight: 400, marginRight: 8 }}>
                            × ₪{parseFloat(item.unit_price).toFixed(2)}{item.discount_percent > 0 ? ` (-${item.discount_percent}%)` : ''}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', marginTop: 2 }}>₪{parseFloat(item.line_total).toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '2px dashed #e2e8f0', paddingTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#475569' }}>
                    <span>סה״כ פריטים (לפני מע״מ)</span>
                    <span>₪{parseFloat(quote.subtotal).toFixed(2)}</span>
                  </div>
                  {parseFloat(quote.shipping_cost) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#475569' }}>
                      <span>עלות שילוח (לפני מע״מ)</span>
                      <span>₪{parseFloat(quote.shipping_cost).toFixed(2)}</span>
                    </div>
                  )}
                  {paymentMethod === 'check_delivery' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#f59e0b', fontWeight: 600 }}>
                      <span>תוספת צ׳ק לשליח (כולל מע״מ)</span>
                      <span>₪25.00</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#475569' }}>
                    <span>מע״מ (18%)</span>
                    <span>₪{((parseFloat(quote.subtotal) + parseFloat(quote.shipping_cost)) * 0.18).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800, color: '#131b40', marginTop: 8, borderTop: '2px solid #e2e8f0', paddingTop: 16 }}>
                    <span>סה״כ לתשלום (כולל מע״מ)</span>
                    <span style={{ color: '#4caf50' }}>₪{calculateFinalTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Form 1: Invoice details */}
              <div style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <h2 className="no-print" style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'flex', width: 28, height: 28, background: '#f1f5f9', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>1</span>
                  פרטי חשבונית ולקוח
                </h2>
                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>שם החברה לחשבונית <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      value={invoiceCompany}
                      onChange={e => setInvoiceCompany(e.target.value)}
                      style={{ width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, outline: 'none' }}
                      placeholder="הקלד שם רשמי"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>ח.פ / עוסק מורשה <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      value={companyNumber}
                      onChange={e => setCompanyNumber(e.target.value)}
                      style={{ width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, outline: 'none' }}
                      placeholder="למשל: 512345678"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>שם לקוח / איש קשר</label>
                    <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }} placeholder="שם איש קשר" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>טלפון</label>
                    <input type="tel" dir="ltr" value={contactPhone} onChange={e => setContactPhone(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }} placeholder="טלפון" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>אימייל</label>
                    <input type="email" dir="ltr" value={contactEmail} onChange={e => setContactEmail(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }} placeholder="אימייל" />
                  </div>
                </div>
              </div>

              {/* Form 2: Delivery Date */}
              <div className="no-print" style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'flex', width: 28, height: 28, background: '#f1f5f9', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>2</span>
                  תאריך אספקה מבוקש
                </h2>
                <div style={{ maxWidth: 240 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>בחרו תאריך אספקה <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="date"
                    value={expectedDelivery}
                    onChange={e => setExpectedDelivery(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, outline: 'none' }}
                  />
                  <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>נתון זה יתעדכן בהזמנה ויועבר לצוות הלוגיסטיקה.</p>
                </div>
              </div>

              {/* Form 3: Delivery Address */}
              <div style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <h2 className="no-print" style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'flex', width: 28, height: 28, background: '#f1f5f9', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>3</span>
                  כתובת אספקה
                </h2>

                {addresses.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                    {addresses.map(addr => (
                      <label key={addr.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, border: selectedAddressId === addr.id ? '2px solid #4caf50' : '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', background: selectedAddressId === addr.id ? '#f0fdf4' : 'transparent', transition: 'all 0.2s' }}>
                        <input type="radio" value={addr.id} checked={selectedAddressId === addr.id} onChange={() => setSelectedAddressId(addr.id)} style={{ accentColor: '#4caf50', width: 18, height: 18 }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{addr.label || 'כתובת קיימת'}</div>
                          <div style={{ fontSize: 13, color: '#64748b' }}>{addr.street}, {addr.city} {addr.contact_name ? `(${addr.contact_name} - ${addr.contact_phone})` : ''}</div>
                        </div>
                      </label>
                    ))}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, border: selectedAddressId === 'new' ? '2px solid #4caf50' : '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', background: selectedAddressId === 'new' ? '#f0fdf4' : 'transparent', transition: 'all 0.2s' }}>
                      <input type="radio" value="new" checked={selectedAddressId === 'new'} onChange={() => setSelectedAddressId('new')} style={{ accentColor: '#4caf50', width: 18, height: 18 }} />
                      <div style={{ fontWeight: 600, fontSize: 14 }}>הזנת כתובת חדשה</div>
                    </label>
                  </div>
                )}

                {selectedAddressId === 'new' && (
                  <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #cbd5e1' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>תווית הכתובת (למשל: סניף מרכזי)</label>
                      <input type="text" value={newAddress.label} onChange={e => setNewAddress({ ...newAddress, label: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, outline: 'none' }} placeholder="סניף / ייעוד הכתובת" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>עיר <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" value={newAddress.city} onChange={e => setNewAddress({ ...newAddress, city: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, outline: 'none' }} placeholder="עיר" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>רחוב <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" value={newAddress.street} onChange={e => setNewAddress({ ...newAddress, street: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, outline: 'none' }} placeholder="רחוב" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>איש קשר לאספקה</label>
                      <input type="text" value={newAddress.contact_name} onChange={e => setNewAddress({ ...newAddress, contact_name: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, outline: 'none' }} placeholder="שם איש קשר" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>טלפון לאספקה</label>
                      <input type="tel" dir="ltr" value={newAddress.contact_phone} onChange={e => setNewAddress({ ...newAddress, contact_phone: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, outline: 'none' }} placeholder="050-0000000" />
                    </div>
                  </div>
                )}
              </div>

              {/* Form 4: Payment Method */}
              <div className="no-print" style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'flex', width: 28, height: 28, background: '#f1f5f9', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>4</span>
                  אמצעי תשלום
                </h2>
                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 20, border: paymentMethod === 'bank_transfer' ? '2px solid #4caf50' : '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', background: paymentMethod === 'bank_transfer' ? '#f0fdf4' : 'transparent', transition: 'all 0.2s', textAlign: 'center' }}>
                    <input type="radio" value="bank_transfer" checked={paymentMethod === 'bank_transfer'} onChange={() => setPaymentMethod('bank_transfer')} style={{ display: 'none' }} />
                    <div style={{ fontSize: 32, opacity: paymentMethod === 'bank_transfer' ? 1 : 0.4 }}>🏦</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>העברה בנקאית</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>תשלום מראש לחשבון החברה.</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 20, border: paymentMethod === 'check_delivery' ? '2px solid #4caf50' : '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', background: paymentMethod === 'check_delivery' ? '#f0fdf4' : 'transparent', transition: 'all 0.2s', textAlign: 'center' }}>
                    <input type="radio" value="check_delivery" checked={paymentMethod === 'check_delivery'} onChange={() => setPaymentMethod('check_delivery')} style={{ display: 'none' }} />
                    <div style={{ fontSize: 32, opacity: paymentMethod === 'check_delivery' ? 1 : 0.4 }}>🚚</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>צ׳ק מזומן לשליח</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>כרוך בתוספת טיפול בסך 25 ₪ לחיוב.</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Form 5: Signature & Actions */}
              <div style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <h2 className="no-print" style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'flex', width: 28, height: 28, background: '#f1f5f9', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>5</span>
                  חתימה מרחוק
                </h2>
                <div className="no-print" style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>אנא חתום את שמך כמורשה חתימה לאישור כל תנאי ההזמנה.</p>
                  <SignaturePad onSignatureChange={setSignature} />
                </div>

                <button
                  className="no-print"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  style={{ width: '100%', padding: '16px 24px', background: isSubmitting ? '#94a3b8' : '#4caf50', color: 'white', border: 'none', borderRadius: 12, fontSize: 18, fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(76, 175, 80, 0.4)', transition: 'all 0.2s' }}
                >
                  {isSubmitting ? 'מעבד הזמנה...' : 'אישור וסיום הזמנה 🚀'}
                </button>
              </div>

            </main>
          </div>
        </>
      )}
      <style dangerouslySetInnerHTML={{
        __html: `
        .send-toolbar {
          position: sticky; top: 0; z-index: 100;
          background: #0b1536; color: white;
          padding: 12px 24px;
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          box-shadow: 0 2px 12px rgba(0,0,0,.3);
        }
        .tb-label { font-size: 13px; color: rgba(255,255,255,.55); }
        .tb-btn {
          padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; border: none; display: flex; align-items: center; gap: 6px;
          transition: opacity .18s;
        }
        .tb-btn:hover { opacity: .82; }
        .tb-btn.green { background: #25D366; color: #fff; }
        .tb-btn.blue  { background: #3B82F6; color: #fff; }
        .tb-btn.ghost { background: rgba(255,255,255,.13); color: #fff; border: 1px solid rgba(255,255,255,.3); }
        .tb-btn.pink  { background: #e40187; color: #fff; }

        @media screen and (min-width: 769px) {
          .mobile-only { display: none !important; }
          .desktop-table { width: 100%; border-collapse: collapse; font-size: 14px; }
          .desktop-table th { background: #f8fafc; padding: 12px; text-align: right; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 700; }
          .desktop-table td { padding: 16px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
        }

        @media screen and (max-width: 768px) {
          .desktop-only { display: none !important; }
          .web-main-container { padding: 16px 12px !important; }
          .responsive-grid { grid-template-columns: 1fr !important; }
          .no-print h2 { font-size: 16px !important; }
          
          .send-toolbar {
            justify-content: center;
            padding: 10px 8px !important;
            gap: 6px !important;
          }
          .tb-label { display: none !important; }
          .tb-btn {
            padding: 8px !important;
            font-size: 11px !important;
            flex: 1;
            justify-content: center;
            white-space: nowrap;
          }
          .tb-btn svg { width: 13px !important; height: 13px !important; margin-left: -2px; }
        }
        @media print {
          body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .web-main-container {
            display: none !important;
          }
          .print-only-layout {
            display: block !important;
            box-shadow: none !important;
            padding: 40px 60px !important;
            max-width: none !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 20mm 0;
            size: A4;
          }
        }
      `}} />
    </>
  )
}
