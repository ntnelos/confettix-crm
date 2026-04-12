'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import SignaturePad from '@/components/SignaturePad'

interface OrderData {
  order: any
  quote: any
  items: any[]
  org: any
  addresses: any[]
}

export default function OrderCheckoutPage() {
  const params = useParams()
  const quoteId = params.quoteId as string
  
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
  const [newAddress, setNewAddress] = useState({ street: '', city: '', contact_name: '', contact_phone: '' })
  
  // Signature
  const [signature, setSignature] = useState<string | null>(null)

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

        if (json.order.payment_method) {
            setPaymentMethod(json.order.payment_method)
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
         total_amount: calculateFinalTotal()
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

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'Heebo,sans-serif' }}>טוען נתוני הזמנה...</div>
  if (error || !data) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'Heebo,sans-serif' }}>{error || 'הזמנה לא נמצאה'}</div>

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
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '40px 20px', fontFamily: 'Heebo, sans-serif', color: '#1e293b' }}>
      <main style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 32, alignItems: 'start' }}>
        
        {/* Left Side: Forms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Header */}
          <div style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
             <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: '#4caf50', marginBottom: 8 }}>סיכום וסגירת הזמנה</h1>
             <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>הזמנה מקושרת לעסקה מול <strong>{org?.name || 'לקוח מזדמן'}</strong>.</p>
          </div>

          {/* Form: Invoice details */}
          <div style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'flex', width: 28, height: 28, background: '#f1f5f9', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>1</span> 
              פרטי חשבונית
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
          </div>

          {/* Form: Delivery */}
          <div style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'flex', width: 28, height: 28, background: '#f1f5f9', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>2</span> 
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
                 <div>
                   <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>עיר <span style={{ color: '#ef4444' }}>*</span></label>
                   <input type="text" value={newAddress.city} onChange={e => setNewAddress({...newAddress, city: e.target.value})} style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, outline: 'none' }} placeholder="עיר" />
                 </div>
                 <div>
                   <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>רחוב <span style={{ color: '#ef4444' }}>*</span></label>
                   <input type="text" value={newAddress.street} onChange={e => setNewAddress({...newAddress, street: e.target.value})} style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, outline: 'none' }} placeholder="רחוב" />
                 </div>
                 <div>
                   <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>איש קשר לאספקה</label>
                   <input type="text" value={newAddress.contact_name} onChange={e => setNewAddress({...newAddress, contact_name: e.target.value})} style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, outline: 'none' }} placeholder="שם מנדט" />
                 </div>
                 <div>
                   <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>טלפון לאספקה</label>
                   <input type="tel" dir="ltr" value={newAddress.contact_phone} onChange={e => setNewAddress({...newAddress, contact_phone: e.target.value})} style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, outline: 'none' }} placeholder="050-0000000" />
                 </div>
               </div>
            )}
          </div>

          {/* Form: Payment Method */}
          <div style={{ background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'flex', width: 28, height: 28, background: '#f1f5f9', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>3</span> 
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
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'flex', width: 28, height: 28, background: '#f1f5f9', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>4</span> 
              חתימה מרחוק
            </h2>
            <div style={{ marginBottom: 24 }}>
               <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>אנא חתום את שמך כמורשה חתימה לאישור כל תנאי ההזמנה.</p>
               <SignaturePad onSignatureChange={setSignature} />
            </div>

            <button 
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: '#131b40', marginTop: 8, borderTop: '2px solid #e2e8f0', paddingTop: 16 }}>
                 <span>סה״כ לתשלום</span>
                 <span>₪{calculateFinalTotal().toFixed(2)}</span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                 הסכום הסופי כולל מע״מ כחוק (18%).
              </div>
           </div>
        </div>

      </main>
    </div>
  )
}
