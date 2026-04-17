'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import QuotesManager from '@/components/QuotesManager'

interface Opportunity {
  id: string
  subject: string
  status: 'new' | 'followup' | 'won' | 'lost'
  contact_id: string | null
  organization_id: string | null
  calculated_value: number
  lead_source: string | null
  description: string | null
  expected_delivery: string | null
  created_at: string
  contacts?: { id: string, name: string } | null
  organizations?: { id: string, name: string } | null
}

interface UpdateRecord {
  id: string
  type: 'phone' | 'whatsapp' | 'note' | 'email' | 'meeting'
  content: string
  is_task: boolean
  task_deadline: string | null
  task_completed: boolean
  created_at: string
}

export default function OpportunityDetailsPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  
  const [opp, setOpp] = useState<Opportunity | null>(null)
  const [updates, setUpdates] = useState<UpdateRecord[]>([])
  const [loading, setLoading] = useState(true)
  
  const [signedOrder, setSignedOrder] = useState<any>(null)
  const [deliveryAddress, setDeliveryAddress] = useState<any>(null)
  
  // Invoice State
  const [invoice, setInvoice] = useState<any>(null)
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [existingInvoiceUrl, setExistingInvoiceUrl] = useState('')
  const [existingInvoiceNumber, setExistingInvoiceNumber] = useState('')
  
  // New Update Form
  const [newUpdate, setNewUpdate] = useState({ content: '', type: 'note' as any })
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false)

  const loadData = async () => {
    const { data: oppData, error: oppErr } = await (supabase
      .from('opportunities') as any)
      .select('*, contacts(id,name), organizations(id,name)')
      .eq('id', id)
      .single()
    
    if (oppErr || !oppData) {
      console.error("Opp not found! ID attempted:", id);
      console.error("Error from Supabase:", oppErr);
      setLoading(false);
      return;
    }
    
    setOpp(oppData as Opportunity)
    
    const { data: updatesData } = await (supabase
      .from('opportunity_updates') as any)
      .select('*')
      .eq('opportunity_id', id)
      .order('created_at', { ascending: false })
    
    if (updatesData) setUpdates(updatesData as UpdateRecord[])

    const { data: orderData } = await (supabase.from('orders') as any)
      .select('*, quotes(quote_number), invoices(*)')
      .eq('opportunity_id', id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (orderData) {
      setSignedOrder(orderData)
      const typedOrder = orderData as any
      if (typedOrder.invoices && typedOrder.invoices.length > 0) {
        setInvoice(typedOrder.invoices[0])
      } else {
        setInvoice(null) // Reset if no invoices
      }
      if (typedOrder.delivery_address_id) {
        const { data: addr } = await supabase.from('delivery_addresses').select('*').eq('id', typedOrder.delivery_address_id).single()
        if (addr) setDeliveryAddress(addr)
      } else {
        setDeliveryAddress(null)
      }
    } else {
      setSignedOrder(null)
      setInvoice(null)
      setDeliveryAddress(null)
    }
    
    setLoading(false);
  }

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, router, supabase]);

  const handleDeleteOpp = async () => {
    if (!window.confirm(`האם למחוק את ההזדמנות "${opp?.subject}" לצמיתות?`)) return
    setLoading(true)
    const { error } = await (supabase.from('opportunities') as any).delete().eq('id', id)
    if (error) alert(error.message)
    else router.push('/opportunities')
  }

  const updateField = async (field: keyof Opportunity, value: string | number | null) => {
    if (!opp) return
    const original = { ...opp }
    setOpp({ ...opp, [field]: value as never })

    const valForDB = (value === '') ? null : value
    const { error } = await (supabase.from('opportunities') as any).update({ [field]: valForDB }).eq('id', opp.id)
    if (error) {
       alert(`שגיאה בעדכון: ${error.message}`)
       setOpp(original)
    }
  }

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUpdate.content.trim()) return

    setIsSubmittingUpdate(true)
    const payload = {
      opportunity_id: id as string,
      type: newUpdate.type,
      content: newUpdate.content.trim()
    }
    const { data, error } = await (supabase.from('opportunity_updates') as any).insert(payload).select().single()
    if (data) {
      setUpdates([data as UpdateRecord, ...updates])
      setNewUpdate({ content: '', type: 'note' })
    } else if (error) {
      alert(error.message)
    }
    setIsSubmittingUpdate(false)
  }

  const handleDeleteUpdate = async (updateId: string) => {
    if (!window.confirm("למחוק תיעוד זה?")) return
    const { error } = await (supabase.from('opportunity_updates') as any).delete().eq('id', updateId)
    if (!error) setUpdates(prev => prev.filter(u => u.id !== updateId))
  }

  const handleGenerateInvoice = async () => {
    if (!signedOrder) return
    setIsGeneratingInvoice(true)
    try {
      const res = await fetch('/api/morning/document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: signedOrder.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate invoice')
      
      setInvoice(data.invoice)
      await loadData()
      alert('חשבונית מס הופקה בהצלחה!')
      setShowInvoiceModal(false)
    } catch (err: any) {
      alert(`שגיאה בהפקת החשבונית: ${err.message}`)
    } finally {
      setIsGeneratingInvoice(false)
    }
  }

  const handleAttachExistingInvoice = async () => {
    if (!signedOrder || !existingInvoiceUrl) return
    setIsGeneratingInvoice(true)
    try {
      const { data, error } = await (supabase.from('invoices') as any).insert({
        order_id: signedOrder.id,
        pdf_url: existingInvoiceUrl,
        invoice_number: existingInvoiceNumber || 'חשבונית חיצונית',
        type: 'invoice',
        amount: signedOrder.total_amount,
        status: 'issued',
        issued_at: new Date().toISOString()
      }).select().single()

      if (error) throw error
      
      setInvoice(data)
      await loadData()
      setShowInvoiceModal(false)
      alert('החשבונית קושרה בהצלחה!')
    } catch (err: any) {
      alert(`שגיאה בקישור חשבונית: ${err.message}`)
    } finally {
      setIsGeneratingInvoice(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
         <span className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--blue)' }} />
      </div>
    )
  }

  if (!opp) return null

  // Value formatting
  const formattedValue = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(opp.calculated_value || 0)

  return (
    <>
      <div className="topbar">
        <div></div>
      </div>

      <div className="page-body">
        {/* Header section */}
        <div style={{ 
          background: 'linear-gradient(135deg, #0b1536 0%, #1a1b41 50%, rgba(228, 1, 135, 0.45) 100%)', 
          borderRadius: 'var(--radius)', 
          padding: '40px 30px', 
          color: 'white',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <div className="breadcrumb" style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>
              <Link href="/dashboard" style={{ color: 'inherit' }}>לוח בקרה</Link>
              <span className="breadcrumb-sep">/</span>
              <Link href="/opportunities" style={{ color: 'inherit' }}>הזדמנויות</Link>
              <span className="breadcrumb-sep">/</span>
              <span style={{ color: 'white' }}>{opp.subject}</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 12 }}>
                <TargetIcon />
              </div>
              <div>
                <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0, marginBottom: 6 }}>
                  <EditableTitle value={opp.subject} onSave={(val) => updateField('subject', val)} />
                </h1>
                <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'rgba(255,255,255,0.9)', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                     <StatusBadge status={opp.status} /> 
                  </span>
                  <span>• תאריך יצירה: {new Date(opp.created_at).toLocaleDateString('he-IL')}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
             {/* Huge Value Display */}
             <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>שווי עסקה</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{formattedValue}</div>
             </div>
             <Link
               href="/opportunities/new"
               style={{
                 background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
                 color: 'white', padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                 display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                 textDecoration: 'none', justifyContent: 'center', width: '100%'
               }}
             >
               + הזדמנות חדשה
             </Link>
             <button 
               onClick={handleDeleteOpp}
               title="מחק הזדמנות"
               style={{ 
                 background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', 
                 color: 'white', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', 
                 display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, 
                 transition: 'all 0.2s', width: '100%', justifyContent: 'center'
               }}
               onMouseOver={e => e.currentTarget.style.background='rgba(255,0,0,0.6)'}
               onMouseOut={e => e.currentTarget.style.background='transparent'}
            >
              <TrashIcon /> מחיקה
            </button>
          </div>
        </div>

        {/* Huge Full-Width Pipeline */}
        <div style={{ display: 'flex', width: '100%', marginBottom: 24, height: 46 }}>
          {[
            { id: 'new', label: 'חדש/נוצר' },
            { id: 'followup', label: 'פולואפ / בטיפול' },
            { id: 'won', label: 'זכייה / מאושר' },
            { id: 'pending_payment', label: 'ממתין לתשלום' },
            { id: 'paid', label: 'שולם' },
            { id: 'lost', label: 'לא נסגר / בוטל' }
          ].map((step, idx, arr) => {
             const activeIndex = arr.findIndex(s => s.id === opp.status)
             const isActive = activeIndex === idx
             const isPast = activeIndex > idx
             
             let bg = 'linear-gradient(90deg, #e3e8f8, #f0f4ff)' // Future
             let color = '#55699c'
             if (isActive) {
                bg = 'linear-gradient(90deg, #131b40, #222b63)' // Royal Navy
                color = '#fff'
             } else if (isPast) {
                bg = 'linear-gradient(90deg, #a4b6eb, #b8c7f2)' // Lighter highlight
                color = '#fff'
             }

             let clipPath = 'polygon(100% 0, calc(100% - 16px) 50%, 100% 100%, 16px 100%, 0 50%, 16px 0)'
             if (idx === 0) clipPath = 'polygon(100% 0, 100% 50%, 100% 100%, 16px 100%, 0 50%, 16px 0)'
             if (idx === arr.length - 1) clipPath = 'polygon(100% 0, calc(100% - 16px) 50%, 100% 100%, 0 100%, 0 50%, 0 0)'

             return (
               <div 
                  key={step.id}
                  onClick={() => updateField('status', step.id)}
                  style={{
                    flex: 1,
                    background: bg,
                    color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    clipPath,
                    marginRight: idx === 0 ? 0 : -14,
                    cursor: 'pointer',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 14,
                    position: 'relative',
                    zIndex: arr.length - idx,
                    transition: 'all 0.2s'
                  }}
               >
                 {step.label}
               </div>
             )
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
          
          {/* Main Space */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Description Card */}
            <div className="card">
              <div className="card-header">
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>פרטי העסקה והערות</h2>
              </div>
              <div style={{ padding: '0 20px 20px 20px' }}>
                <InlineEditableField
                  label=""
                  value={opp.description}
                  type="textarea"
                  placeholder="הקלד כאן פירוט על העסקה, דמיות מפתח, שלבים שנסגרו..."
                  onSave={(val) => updateField('description', val)}
                />
              </div>
            </div>

            {/* Quotes Builder */}
            <div className="card" style={{ overflow: 'visible' }}>
               <QuotesManager opportunityId={opp.id} onOrderUpdated={loadData} />
            </div>

            {/* Updates / History Card */}
            <div className="card">
              <div className="card-header">
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>היסטוריית תקשורת</h2>
              </div>
              <div style={{ padding: 20 }}>
                {/* Form to insert a new update */}
                <form onSubmit={handleAddUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32, background: 'var(--surface-2)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
                   <textarea
                     className="form-input"
                     rows={5}
                     placeholder="תעד כאן את תוכן השיחה, המסקנות או המשימות להמשך..."
                     value={newUpdate.content}
                     onChange={e => setNewUpdate({...newUpdate, content: e.target.value})}
                     required
                     style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}
                   />
                   <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                     <select
                       className="form-select"
                       value={newUpdate.type}
                       onChange={e => setNewUpdate({...newUpdate, type: e.target.value as any})}
                       style={{ minWidth: 180 }}
                     >
                        <option value="note">📝 פתק / הערה</option>
                        <option value="phone">📞 שיחה טלפונית</option>
                        <option value="whatsapp">💬 הודעת WhatsApp</option>
                        <option value="email">📧 דואר אלקטרוני</option>
                        <option value="meeting">🤝 פגישה פרונטלית</option>
                     </select>
                     <button type="submit" className="btn btn-primary" disabled={isSubmittingUpdate} style={{ marginRight: 'auto' }}>
                        {isSubmittingUpdate ? 'שומר...' : 'שמור'}
                     </button>
                   </div>
                </form>

                {/* Timeline display */}
                {updates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>אין היסטוריית תקשורת להזדמנות זו.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                     {updates.map(update => (
                        <div key={update.id} style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: '1px dashed var(--border-light)' }}>
                           <div style={{ 
                             width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,102,255,0.1)', color: 'var(--blue)',
                             display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0
                           }}>
                             {update.type === 'phone' ? '📞' : update.type === 'whatsapp' ? '💬' : update.type === 'meeting' ? '🤝' : update.type === 'email' ? '📧' : '📝'}
                           </div>
                           <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontWeight: 600, fontSize: 14 }}>
                                  {update.type === 'phone' ? 'שיחה טלפונית' : update.type === 'whatsapp' ? 'הודעת WhatsApp' : update.type === 'meeting' ? 'פגישה' : update.type === 'email' ? 'דואר אלקטרוני' : 'הערה'}
                                </span>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                  {new Date(update.created_at).toLocaleString('he-IL')}
                                </span>
                              </div>
                              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: 14, whiteSpace: 'pre-wrap' }}>
                                 {update.content}
                              </div>
                           </div>
                           <button onClick={() => handleDeleteUpdate(update.id)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }} title="מחק תיעוד">
                              <TrashIcon />
                           </button>
                        </div>
                     ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card">
              <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600 }}>פרטי הזדמנות</h2>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  <InlineEditableField
                     label="שווי מוערך בניתוח (₪)"
                     value={opp.calculated_value?.toString()}
                     dir="ltr"
                     type="number"
                     onSave={val => updateField('calculated_value', val ? parseFloat(val) : 0)}
                  />

                  <InlineEditableField
                     label="תאריך אספקה (משוער)"
                     value={opp.expected_delivery?.toString() || ''}
                     type="date"
                     onSave={val => updateField('expected_delivery', val)}
                  />

                  <div className="form-group">
                    <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>מקור הליד</label>
                    <select 
                      className="form-select" 
                      value={opp.lead_source || ''} 
                      onChange={e => updateField('lead_source', e.target.value)}
                    >
                      <option value="">— לא ידוע —</option>
                      <option value="website">אתר אינטרנט</option>
                      <option value="whatsapp">הודעת וואטסאפ</option>
                      <option value="phone">שיחה טלפונית</option>
                      <option value="referral">הפניה / מפה לאוזן</option>
                      <option value="returning">לקוח חוזר</option>
                      <option value="other">אחר</option>
                    </select>
                  </div>

                </div>
                
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed var(--border-strong)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>שיוך נתונים לקוח</div>
                    <Link href={`/opportunities/new?edit_id=${opp.id}`} style={{ fontSize: 11, color: 'var(--pink)', textDecoration: 'none', fontWeight: 600 }}>עריכה ✎</Link>
                  </div>
                  
                  {opp.contact_id && opp.contacts ? (
                    <Link href={`/contacts/${opp.contact_id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, textDecoration: 'none', color: 'var(--text-primary)', border: '1px solid var(--border)', marginBottom: 8, transition: 'all 0.2s' }}>
                      <div style={{ color: 'var(--pink)', display: 'flex' }}><UserIconSmall /></div>
                      <span style={{ fontWeight: 500, fontSize: 13, flex: 1 }}>{opp.contacts.name}</span>
                    </Link>
                  ) : (
                    <Link href={`/opportunities/new?edit_id=${opp.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 14px', background: 'var(--surface)', borderRadius: 8, textDecoration: 'none', color: 'var(--text-primary)', border: '1px dashed var(--border)', marginBottom: 8, fontSize: 13, fontWeight: 500 }}>
                      + שיוך איש קשר
                    </Link>
                  )}

                  {opp.organization_id && opp.organizations ? (
                    <Link href={`/organizations/${opp.organization_id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, textDecoration: 'none', color: 'var(--text-primary)', border: '1px solid var(--border)', transition: 'all 0.2s' }}>
                      <div style={{ color: 'var(--blue, #0d6efd)', display: 'flex' }}><BuildingIconSmall /></div>
                      <span style={{ fontWeight: 500, fontSize: 13, flex: 1 }}>{opp.organizations.name}</span>
                    </Link>
                  ) : (
                    <Link href={`/opportunities/new?edit_id=${opp.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 14px', background: 'var(--surface)', borderRadius: 8, textDecoration: 'none', color: 'var(--text-primary)', border: '1px dashed var(--border)', fontSize: 13, fontWeight: 500 }}>
                      + שיוך ארגון
                    </Link>
                  )}
                </div>

              </div>
            </div>

            {signedOrder && (
              <div className="card" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #86efac' }}>
                <div className="card-header" style={{ borderBottom: '1px solid rgba(76, 175, 80, 0.2)', paddingBottom: 12 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
                    ✅ הזמנה אושרה ונחתמה
                  </h2>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                   <div style={{ fontSize: 13, color: '#166534' }}>
                     <strong>סה"כ אושר: </strong>
                     ₪{parseFloat(signedOrder.total_amount || 0).toLocaleString()}
                   </div>
                   <div style={{ fontSize: 13, color: '#166534' }}>
                     <strong>נחתם ב: </strong>
                     {new Date(signedOrder.signed_at || signedOrder.updated_at).toLocaleString('he-IL')}
                   </div>
                   
                   <a target="_blank" href={`/orders/${signedOrder.quote_id}/checkout?mode=readOnly`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', background: '#16a34a', color: 'white', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13, marginTop: 8 }}>
                     👁️ צפו בהזמנה החתומה (PDF)
                   </a>
                </div>
              </div>
            )}

            {/* INVOICE BLOCK */}
            {signedOrder && (
              <div className="card" style={{ background: 'var(--surface)' }}>
                <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    📄 חשבוניות
                  </h2>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                   {invoice ? (
                     <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <strong>סוג מסמך:</strong>
                          <span>{invoice.type === '305' || invoice.type === 'invoice' ? 'חשבונית מס' : invoice.type}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <strong>מספר מסמך:</strong>
                          <span>{invoice.invoice_number}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <strong>תאריך:</strong>
                          <span>{new Date(invoice.issued_at).toLocaleDateString('he-IL')}</span>
                        </div>
                        {invoice.pdf_url && (
                          <a target="_blank" href={invoice.pdf_url} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', background: '#e0e7ff', color: '#3730A3', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13, marginTop: 8 }}>
                            👁️ צפייה במסמך מורנינג
                          </a>
                        )}
                     </>
                   ) : (
                     <button
                        onClick={() => setShowInvoiceModal(true)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', background: '#3730A3', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.2s', width: '100%' }}
                     >
                        📄 חשבונית מס
                     </button>
                   )}
                </div>
              </div>
            )}

            {deliveryAddress && (
               <div className="card">
                <div className="card-header" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: 12 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    🚚 כתובת אספקה נבחרה
                  </h2>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                   {deliveryAddress.label && <div><strong>תווית אספקה:</strong> {deliveryAddress.label}</div>}
                   <div><strong>עיר:</strong> {deliveryAddress.city}</div>
                   <div><strong>רחוב:</strong> {deliveryAddress.street}</div>
                   {(deliveryAddress.contact_name || deliveryAddress.contact_phone) && (
                     <div><strong>איש קשר לאספקה:</strong> {deliveryAddress.contact_name} {deliveryAddress.contact_phone}</div>
                   )}
                </div>
               </div>
            )}
          </div>

        </div>
      </div>

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: 32, minWidth: 460, maxWidth: '92%', background: 'var(--surface)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>📄 הפקת חשבונית מס</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>בחר כיצד לצרף חשבונית להזמנה זו</p>

            {/* Option A: Generate via Morning */}
            <div style={{ background: 'rgba(55,48,163,0.06)', border: '1px solid rgba(55,48,163,0.2)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>🤖 הפקה אוטומטית דרך מורנינג</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>תיווצר חשבונית מס חדשה ישירות במערכת מורנינג על פי פריטי ההזמנה</p>
              <button
                className="btn btn-primary"
                onClick={handleGenerateInvoice}
                disabled={isGeneratingInvoice}
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              >
                {isGeneratingInvoice ? <span className="spinner" style={{ width: 18, height: 18 }} /> : '📄 הפק חשבונית עכשיו'}
              </button>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>או קשר חשבונית קיימת</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* Option B: Attach existing */}
            <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>קישור לקובץ PDF (URL)</label>
                <input 
                  className="form-input" 
                  placeholder="https://..." 
                  dir="ltr" 
                  value={existingInvoiceUrl} 
                  onChange={e => setExistingInvoiceUrl(e.target.value)} 
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>מספר חשבונית (אופציונלי)</label>
                <input 
                  className="form-input" 
                  placeholder="לדוגמה: 10024" 
                  dir="ltr" 
                  value={existingInvoiceNumber} 
                  onChange={e => setExistingInvoiceNumber(e.target.value)} 
                />
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleAttachExistingInvoice}
                disabled={isGeneratingInvoice || !existingInvoiceUrl}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {isGeneratingInvoice ? <span className="spinner" style={{ width: 18, height: 18 }} /> : '🔗 שמור חשבונית קיימת'}
              </button>
            </div>

            <div style={{ textAlign: 'center' }}>
              <button onClick={() => setShowInvoiceModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function StatusBadge({ status }: { status: string }) {
   if (status === 'new') return <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 600, border: '1px solid white' }}>חדש/נוצר</span>
   if (status === 'followup') return <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 600, border: '1px solid white' }}>בטיפול / פולואפ</span>
   if (status === 'won') return <span style={{ background: '#4caf50', color: 'white', padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 600 }}>זכייה / מאושר</span>
   if (status === 'pending_payment') return <span style={{ background: '#3f51b5', color: 'white', padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 600 }}>ממתין לתשלום</span>
   if (status === 'paid') return <span style={{ background: '#009688', color: 'white', padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 600 }}>שולם</span>
   if (status === 'lost') return <span style={{ background: '#e53935', color: 'white', padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 600 }}>לא נסגר / בוטל</span>
   return <span>{status}</span>
}

function TargetIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
}

function UserIconSmall() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
}

function BuildingIconSmall() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>
}

const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"></path></svg>

function EditableTitle({ value, onSave }: { value: string, onSave: (val: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)

  if (editing) {
    return (
      <input 
        autoFocus
        style={{ 
          background: 'rgba(255,255,255,0.1)', 
          border: '1px solid rgba(255,255,255,0.4)', 
          color: 'white', fontSize: 'inherit', fontWeight: 'inherit', fontFamily: 'inherit',
          padding: '2px 8px', borderRadius: 6, outline: 'none', width: '100%', maxWidth: 400
        }}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => {
          setEditing(false)
          if (val.trim() && val !== value) onSave(val.trim())
          else setVal(value)
        }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
    )
  }

  return (
    <span onClick={() => setEditing(true)} style={{ cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.4)', paddingBottom: 2 }} title="לחץ לעריכה">
      {value}
    </span>
  )
}

function InlineEditableField({ 
  label, value, onSave, type = 'text', placeholder = '', dir = 'rtl',
}: { 
  label: string, value: string | number | null | undefined, onSave: (val: string) => void, type?: string, placeholder?: string, dir?: string,
}) {
  const [currentValue, setCurrentValue] = useState(value?.toString() || '')

  useEffect(() => { setCurrentValue(value?.toString() || '') }, [value])

  const handleBlur = () => { if (currentValue !== (value?.toString() || '')) onSave(currentValue) }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
      <div style={{ flex: 1 }}>
        {label && <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>{label}</label>}
        {type === 'textarea' ? (
          <textarea 
            className="form-textarea"
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
            style={{ width: '100%', fontSize: 13, padding: '8px 10px', direction: dir as any, border: currentValue ? '1px solid var(--border)' : '1px dashed var(--border-strong)', background: 'transparent' }}
            rows={4}
          />
        ) : (
          <input 
            type={type}
            className="form-input"
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
            style={{ width: '100%', fontSize: 13, padding: '8px 10px', direction: dir as any, border: currentValue ? '1px solid var(--border)' : '1px dashed var(--border-strong)', background: 'transparent' }}
          />
        )}
      </div>
    </div>
  )
}
