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
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer') // 'bank_transfer' | 'check_delivery'

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

        // Pre-fill
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

        // If order is signed and has signature, pre-fill it for preview
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
      {/* ----------------- PRINT ONLY LAYOUT ----------------- */}
      <div className="print-only-layout" style={{ display: isReadOnly ? 'block' : 'none', background: 'white', color: 'black', fontFamily: 'Heebo, sans-serif', padding: isReadOnly ? '40px 20px' : 40, direction: 'rtl', margin: isReadOnly ? '0 auto' : '0', maxWidth: isReadOnly ? 800 : 'none', boxShadow: isReadOnly ? '0 0 40px rgba(0,0,0,0.1)' : 'none', minHeight: isReadOnly ? '100vh' : 'auto' }}>
        {isReadOnly && (
          <div className="no-print" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px 20px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>תצוגת מסמך (PDF)</span>
            <button onClick={() => window.print()} style={{ padding: '6px 12px', background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
               🖨️ הדפס / שמור כ-PDF
            </button>
          </div>
        )}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img src="/confettix-logo.png" alt="קונפטיקס" style={{ height: 40 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>
            לכבוד: {org?.name || 'לקוח מזדמן'} {contactName ? `- ${contactName}` : ''}
          </div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {new Date(quote?.created_at || new Date()).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} {new Date(quote?.created_at || new Date()).toLocaleDateString('he-IL')}
          </div>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 900, textAlign: 'right', marginBottom: 30 }}>הזמנה מס' {quote?.quote_number || quoteId.substring(0, 4)}</h1>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#b0b6bf', color: 'white' }}>
              <th style={{ padding: 12, textAlign: 'right', fontWeight: 700 }}>מוצר</th>
              <th style={{ padding: 12, textAlign: 'right', fontWeight: 700 }}>תיאור</th>
              <th style={{ padding: 12, textAlign: 'center', fontWeight: 700 }}>כמות</th>
              <th style={{ padding: 12, textAlign: 'center', fontWeight: 700 }}>מחיר</th>
              <th style={{ padding: 12, textAlign: 'center', fontWeight: 700 }}>סה"כ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: 12, fontWeight: 800 }}>{item.product_name}</td>
                <td style={{ padding: 12 }}>{item.description || ''}</td>
                <td style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                <td style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>₪{parseFloat(item.unit_price).toFixed(2)}</td>
                <td style={{ padding: 12, textAlign: 'center', fontWeight: 800 }}>₪{parseFloat(item.line_total).toFixed(2)}</td>
              </tr>
            ))}

            <tr style={{ background: '#f1f5f9' }}>
              <td colSpan={3} style={{ border: 'none', background: 'white' }}></td>
              <td style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>סכום מוצרים</td>
              <td style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>₪{parseFloat(quote?.subtotal || 0).toFixed(2)}</td>
            </tr>
            <tr style={{ background: '#f8fafc' }}>
              <td colSpan={3} style={{ border: 'none', background: 'white' }}></td>
              <td style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>משלוח</td>
              <td style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>₪{parseFloat(quote?.shipping_cost || 0).toFixed(2)}</td>
            </tr>
            <tr style={{ background: '#f1f5f9' }}>
              <td colSpan={3} style={{ border: 'none', background: 'white' }}></td>
              <td style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>מע"מ</td>
              <td style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>₪{(((parseFloat(quote?.subtotal || 0) + parseFloat(quote?.shipping_cost || 0))) * 0.18).toFixed(2)}</td>
            </tr>
            <tr style={{ background: '#e2e8f0' }}>
              <td colSpan={3} style={{ border: 'none', background: 'white' }}></td>
              <td style={{ padding: 12, textAlign: 'right', fontWeight: 900, fontSize: 16 }}>סה"כ לתשלום</td>
              <td style={{ padding: 12, textAlign: 'center', fontWeight: 900, fontSize: 16 }}>₪{calculateFinalTotal().toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginBottom: 40, marginTop: 20, fontSize: 13, lineHeight: 1.6, fontWeight: 700, paddingRight: 20 }}>
          <ul style={{ listStyleType: 'disc' }}>
            <li>התאמת עיצוב מעיצובים קיימים, תוספת מיתוג של שם אישי, הקדשה ולוגו ללא תוספת תשלום.</li>
            <li>עיצוב חדש בהתאמה - 500 ש"ח</li>
            <li>אני מאשר/ת קבלת דיוורים מקונפטיקס</li>
          </ul>
          <div style={{ marginTop: 8 }}>
            תשלום בהעברה בנקאית עם אישור הצעת המחיר
          </div>
        </div>

        <div style={{ marginTop: 30 }}>
          <div style={{ background: '#b0b6bf', color: 'white', padding: '10px 16px', fontWeight: 800, fontSize: 16, marginBottom: 24, borderRadius: 4 }}>
            פרטי ההזמנה שלכם (חובה למלא)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32, fontSize: 15 }}>
            <div>
              <strong style={{ marginLeft: 8 }}>חשבונית על שם:</strong>
              <span>{invoiceCompany || '______________________'}</span>
            </div>
            <div>
              <strong style={{ marginLeft: 8 }}>ח"פ:</strong>
              <span>{companyNumber || '_________________'}</span>
            </div>

            <div>
              <strong style={{ marginLeft: 8 }}>איש קשר לתיאום משלוח:</strong>
              <span>{contactName || '______________________'}</span>
            </div>
            <div>
              <strong style={{ marginLeft: 8 }}>טלפון איש קשר:</strong>
              <span>{contactPhone || '_________________'}</span>
            </div>

            <div>
              <strong style={{ marginLeft: 8 }}>כתובת לאספקה:</strong>
              <span>{selectedAddressId === 'new' ? (newAddress.street ? `${newAddress.street}, ${newAddress.city}` : '______________________') : (addresses.find(a => a.id === selectedAddressId)?.street ? `${addresses.find(a => a.id === selectedAddressId)?.street}, ${addresses.find(a => a.id === selectedAddressId)?.city}` : '______________________')}</span>
            </div>
            <div>
              <strong style={{ marginLeft: 8 }}>תאריך לאספקה:</strong>
              <span>{expectedDelivery ? new Date(expectedDelivery).toLocaleDateString('he-IL') : '_________________'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 40, marginBottom: 32, fontSize: 15 }}>
            <strong>סמנו:</strong>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={paymentMethod === 'bank_transfer'} readOnly style={{ width: 18, height: 18, accentColor: 'black' }} /> תשלום בהעברה בנקאית</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={paymentMethod === 'check_delivery'} readOnly style={{ width: 18, height: 18, accentColor: 'black' }} /> תשלום באמצעות צ'ק לשליח (תוספת 25 ש"ח)</label>
          </div>

          <div style={{ marginBottom: 40, fontSize: 15 }}>
            <strong style={{ marginLeft: 8 }}>חתימה:</strong>
            {signature ? (
              <img src={signature} alt="Signature" style={{ height: 50, display: 'inline-block', verticalAlign: 'bottom' }} />
            ) : (
              <span style={{ display: 'inline-block', width: '300px', borderBottom: '1px solid black' }}></span>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 80, color: '#131b40', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 4 }}>בברכה,</div>
          <div style={{ fontWeight: 900, fontSize: 24, marginBottom: 8 }}>קונפטיקס</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>מתנות ממותגות ומיתוג אירועים</div>
          <div style={{ fontSize: 14, fontWeight: 700, direction: 'ltr' }}>052-8350600 | confettixparty@gmail.com</div>
          <img src="/confettix-logo.png" alt="קונפטיקס" style={{ height: 60, marginTop: 12 }} />
        </div>
      </div>
      {/* ----------------- END PRINT ONLY LAYOUT ----------------- */}

      {!isReadOnly && (
        <div className="web-main-container" style={{ minHeight: '100vh', background: '#f1f5f9', padding: '40px 20px', fontFamily: 'Heebo, sans-serif', color: '#1e293b' }}>
        <main style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 32, alignItems: 'start' }}>

          {/* Left Side: Forms */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <div className="no-print" style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <img src="/confettix-logo.png" alt="קונפטיקס" style={{ height: 50, marginBottom: 12 }} />
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: '#4caf50', marginBottom: 8 }}>סיכום וסגירת הזמנה</h1>
                <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>{data?.opp_subject || 'הזמנה'}&nbsp;<strong>{org.name}</strong></p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => window.print()} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  🖨️ הדפס
                </button>
                <button onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                  alert('הקישור הועתק ללוח!')
                }} style={{ padding: '8px 16px', background: '#e0f2fe', color: '#0284c7', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  🔗 העתק קישור הזמנה
                </button>
              </div>
            </div>

            {/* Form: Invoice details */}
            <div style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <h2 className="no-print" style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'flex', width: 28, height: 28, background: '#f1f5f9', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>1</span>
                פרטי חשבונית ולקוח
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
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

            {/* Form: Delivery Date */}
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

            {/* Form: Delivery */}
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #cbd5e1' }}>
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

            {/* Form: Payment Method */}
            <div className="no-print" style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'flex', width: 28, height: 28, background: '#f1f5f9', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>4</span>
                אמצעי תשלום
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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

            {/* Form: Signature & Actions */}
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

          </div>

          {/* Right Side: Order Summary */}
          <div style={{ position: 'sticky', top: 40, background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, borderBottom: '2px solid #e2e8f0', paddingBottom: 16, margin: 0 }}>סיכום ההזמנה</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto', paddingRight: 8 }}>
              {items.map((item: any) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 13, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
                  <div style={{ flex: 1, paddingLeft: 12 }}>
                    <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                    {item.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{item.description}</div>}
                    <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{item.quantity} × ₪{parseFloat(item.unit_price).toFixed(2)} {item.discount_percent > 0 ? `(-${item.discount_percent}%)` : ''}</div>
                  </div>
                  <div style={{ fontWeight: 600 }}>₪{parseFloat(item.line_total).toFixed(2)}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '2px dashed #e2e8f0', paddingTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#475569' }}>
                <span>סה״כ פריטים (לפני מע"מ)</span>
                <span>₪{parseFloat(quote.subtotal).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#475569' }}>
                <span>עלות שילוח (לפני מע"מ)</span>
                <span>₪{parseFloat(quote.shipping_cost).toFixed(2)}</span>
              </div>
              {paymentMethod === 'check_delivery' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#f59e0b', fontWeight: 600 }}>
                  <span>תוספת צ׳ק לשליח (כולל מע"מ)</span>
                  <span>₪25.00</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#475569' }}>
                <span>מע״מ (18%)</span>
                <span>₪{((parseFloat(quote.subtotal) + parseFloat(quote.shipping_cost)) * 0.18).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: '#131b40', marginTop: 8, borderTop: '2px solid #e2e8f0', paddingTop: 16 }}>
                <span>סה״כ לתשלום אישור הזמנה (כולל מע״מ)</span>
                <span>₪{calculateFinalTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>

        </main>
        <style dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body { 
            background: white !important; 
            padding: 0 !important;
          }
          .web-main-container { 
            display: none !important; 
          }
          .print-only-layout { 
            display: block !important; 
            box-shadow: none !important;
            padding: 0 !important;
            max-width: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 1.5cm;
          }
        }
      `}} />
      </div>
      )}
    </>
  )
}
