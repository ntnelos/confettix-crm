'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// SVG Icons
const BuildingIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M14 2v4M10 2v4M9 22v-4h6v4M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" /></svg>
const MapPinIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
const GlobeIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
const InfoIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
const UsersIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>

interface Organization {
  id: string
  name: string
  industry: string | null
  employee_count: number | null
  website: string | null
  company_number: string | null
  general_info: string | null
  created_at: string
}

interface DeliveryAddress {
  id: string
  label: string | null
  street: string
  city: string
  zip_code: string | null
  notes: string | null
}

interface Contact {
  id: string
  name: string
  email: string | null
  mobile: string | null
  phone: string | null
}

export default function OrganizationDetailsPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  
  const [org, setOrg] = useState<Organization | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [newAddress, setNewAddress] = useState({ label: '', street: '', city: '' })
  
  const [showContactModal, setShowContactModal] = useState(false)
  const [newContact, setNewContact] = useState({ name: '', email: '', mobile: '' })

  useEffect(() => {
    async function loadData() {
      // Fetch Organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single()
      
      if (orgError || !orgData) {
        console.error("Org not found", orgError)
        router.push('/organizations')
        return
      }
      setOrg(orgData)

      // Fetch Contacts
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('*')
        .eq('organization_id', id)
      
      if (contactsData) {
        setContacts(contactsData)
      }

      // Fetch Delivery Addresses
      const { data: addressesData } = await supabase
        .from('delivery_addresses')
        .select('*')
        .eq('organization_id', id)
      
      if (addressesData) {
        setAddresses(addressesData as DeliveryAddress[])
      }

      setLoading(false)
    }

    if (id) loadData()
  }, [id, router, supabase])

  const updateDeliveryAddress = async (addrId: string, field: keyof DeliveryAddress, value: string | null) => {
    // DB Update
    const { error } = await (supabase.from('delivery_addresses') as any).update({ [field]: value }).eq('id', addrId)
    if (!error) {
       setAddresses(prev => prev.map(a => a.id === addrId ? { ...a, [field]: value } : a))
    }
  }

  const handleCreateAddress = async () => {
    if (!newAddress.street || !newAddress.city) {
      alert('נא למלא עיר ורחוב')
      return
    }

    const { data, error } = await supabase.from('delivery_addresses').insert({
      organization_id: id,
      street: newAddress.street,
      city: newAddress.city,
      label: newAddress.label || null
    }).select().single()
    
    if (data) {
      setAddresses(prev => [...prev, data])
      setShowAddressModal(false)
      setNewAddress({ label: '', street: '', city: '' })
    } else if (error) {
      alert(`שגיאה בשמירת כתובת: ${error.message}`)
    }
  }

  const handleCreateContact = async () => {
    if (!newContact.name) {
      alert('נא להזין שם מלא לאיש הקשר')
      return
    }

    const { data, error } = await supabase.from('contacts').insert({
      organization_id: id,
      name: newContact.name,
      email: newContact.email || null,
      mobile: newContact.mobile || null
    }).select().single()
    
    if (data) {
      setContacts(prev => [...prev, data])
      setShowContactModal(false)
      setNewContact({ name: '', email: '', mobile: '' })
    } else if (error) {
      alert(`שגיאה ביצירת איש קשר: ${error.message}`)
    }
  }

  const handleDeleteOrg = async () => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את הארגון "${org?.name}" לצמיתות? פעולה זו תמחק גם את אנשי הקשר והעסקאות המקושרים אליו ותכנס לתוקף מיידית.`)) {
      return
    }
    setLoading(true)
    const { error } = await supabase.from('organizations').delete().eq('id', id)
    if (error) {
      alert(`שגיאה במחיקת הארגון: ${error.message}`)
      setLoading(false)
    } else {
      router.push('/organizations')
    }
  }

  const updateOrgField = async (field: keyof Organization, value: string | number | null) => {
    if (!org) return
    const original = { ...org }
    // Optimistic update
    setOrg({ ...org, [field]: value as never })

    // Build the value (handle empty strings appropriately)
    const valForDB = (value === '' && typeof value === 'string') ? null : value

    // Update DB
    const { error } = await (supabase.from('organizations') as any).update({ [field]: valForDB }).eq('id', org.id)
    if (error) {
      console.error(error)
      alert(`שגיאה בעדכון השדה: ${error.message}`)
      setOrg(original) // Revert
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <span className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--pink)' }} />
      </div>
    )
  }

  if (!org) return null

  return (
    <>
      <div className="topbar">
        {/* Placeholder topbar */}
        <div></div>
      </div>

      <div className="page-body">
        {/* Header section with nice background */}
        <div style={{ 
          background: 'linear-gradient(135deg, var(--pink) 0%, #aa0065 100%)', 
          borderRadius: 'var(--radius)', 
          padding: '40px 30px', 
          color: 'white',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end'
        }}>
          <div>
            <div className="breadcrumb" style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>
              <Link href="/dashboard" style={{ color: 'inherit' }}>לוח בקרה</Link>
              <span className="breadcrumb-sep">/</span>
              <Link href="/organizations" style={{ color: 'inherit' }}>ארגונים</Link>
              <span className="breadcrumb-sep">/</span>
              <span style={{ color: 'white' }}>{org.name}</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 12 }}>
                <BuildingIcon />
              </div>
              <div>
                <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>{org.name}</h1>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>
                  {org.industry && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BriefcaseIcon /> {org.industry}</span>}
                  {org.website && (
                    <a 
                      href={org.website.startsWith('http') ? org.website : `https://${org.website}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      style={{ color: 'white', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <GlobeIcon /> {org.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <Link 
              href="/organizations/new"
              className="btn btn-secondary"
              style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}
            >
              <PlusIcon /> ארגון חדש
            </Link>
            <Link 
              href={`/opportunities/new?organization_id=${org.id}`}
              className="btn btn-primary"
              style={{ background: 'white', color: 'var(--pink)' }}
            >
              <PlusIcon /> הזדמנות חדשה
            </Link>
            <button 
               onClick={handleDeleteOrg}
               title="מחק ארגון"
               style={{ 
                 background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', 
                 color: 'white', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', 
                 display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, 
                 transition: 'all 0.2s',
               }}
               onMouseOver={e => e.currentTarget.style.background='rgba(255,0,0,0.6)'}
               onMouseOut={e => e.currentTarget.style.background='rgba(255,255,255,0.15)'}
            >
              מחק ארגון
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 24, alignItems: 'start' }}>
          
          {/* מרווח מרכזי - אנשי קשר ועוד */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UsersIcon /> אנשי קשר ({contacts.length})
                </h2>
                <button onClick={() => setShowContactModal(true)} className="btn btn-sm btn-primary">
                   <PlusIcon /> הוסף
                </button>
              </div>

              {contacts.length === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  אין אנשי קשר משויכים לארגון זה.
                </div>
              ) : (
                <table style={{ width: '100%', marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '12px 20px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, borderBottom: '1px solid var(--border)' }}>שם</th>
                      <th style={{ padding: '12px 20px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, borderBottom: '1px solid var(--border)' }}>תפקיד/מייל</th>
                      <th style={{ padding: '12px 20px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, borderBottom: '1px solid var(--border)' }}>טלפון</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(c => (
                      <tr key={c.id}>
                        <td style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)' }}>
                          <Link href={`/contacts/${c.id}`} style={{ fontWeight: 600, color: 'var(--pink)', textDecoration: 'none' }}>
                            {c.name}
                          </Link>
                        </td>
                        <td style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                           {c.email || '—'}
                        </td>
                        <td style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)', direction: 'ltr', textAlign: 'right' }}>
                          {c.mobile || c.phone || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>היסטוריה והערות</h2>
              </div>
              <div style={{ padding: '20px 0' }}>
                 {/* Communication history will go here */}
                 <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                    <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 10 }}>📝</div>
                    טרם נשמרו הערות בפרופיל הארגון.
                 </div>
              </div>
            </div>

          </div>

          {/* סרגל צדדי (פרטי הארגון - עריכה מהירה) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card">
              <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600 }}>פרטי הארגון</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 20px' }}>
                <InlineEditableField
                  icon={<InfoIcon />}
                  label="ח.פ / ע.מ"
                  value={org.company_number}
                  placeholder="הקלד כאן..."
                  dir="ltr"
                  onSave={(val) => updateOrgField('company_number', val)}
                />
                <InlineEditableField
                  label="שם חברה לחשבונית"
                  value={org.invoice_company_name}
                  placeholder="לדוגמה: תעשייה אווירית בע״מ"
                  onSave={(val) => updateOrgField('invoice_company_name', val)}
                />
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <InlineEditableField
                    label="תעשייה"
                    value={org.industry}
                    type="select"
                    options={[
                      { value: 'הייטק ותוכנה', label: 'הייטק ותוכנה' },
                      { value: 'בנקאות ופיננסים', label: 'בנקאות ופיננסים' },
                      { value: 'תחבורה', label: 'תחבורה' },
                      { value: 'ביטוח', label: 'ביטוח' },
                      { value: 'נדלן', label: 'נדל"ן' },
                      { value: 'בריאות', label: 'בריאות ופארמה' },
                      { value: 'קמעונאות', label: 'קמעונאות' },
                      { value: 'תקשורת ומדיה', label: 'תקשורת ומדיה' },
                      { value: 'תעשייה', label: 'תעשייה וייצור' },
                      { value: 'חינוך', label: 'חינוך' },
                      { value: 'ממשלה', label: 'ממשלה ומוניציפלי' },
                      { value: 'אחר', label: 'אחר' },
                    ]}
                    onSave={(val) => updateOrgField('industry', val)}
                  />
                  <InlineEditableField
                    label="מס' עובדים מוערך"
                    value={org.employee_count}
                    type="number"
                    placeholder="עובדים"
                    dir="ltr"
                    onSave={(val) => updateOrgField('employee_count', val ? parseInt(val) : null)}
                  />
                </div>

                <InlineEditableField
                  icon={<GlobeIcon />}
                  label="אתר אינטרנט"
                  value={org.website}
                  type="url"
                  placeholder="https://company.com"
                  dir="ltr"
                  onSave={(val) => updateOrgField('website', val)}
                />

                <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px dashed var(--border-strong)' }}>
                  <InlineEditableField
                    label="מידע נוסף והערות"
                    value={org.general_info}
                    type="textarea"
                    placeholder="מידע חופשי על הלקוח, היסטוריה קצרה, העדפות עבודה וכד'..."
                    onSave={(val) => updateOrgField('general_info', val)}
                  />
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: -8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>נוצר ב</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {new Date(org.created_at).toLocaleDateString('he-IL')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Addresses */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 15, fontWeight: 600 }}>כתובות אספקה</h2>
                <button onClick={() => setShowAddressModal(true)} className="btn btn-sm btn-primary" title="הוסף כתובת">
                  <PlusIcon /> הוסף כתובת
                </button>
              </div>
              <div style={{ padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {addresses.length === 0 ? (
                   <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
                     טרם הוגדרה כתובת אספקה לארגון.
                   </div>
                ) : addresses.map((addr) => (
                   <div key={addr.id} style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                     <div style={{ marginBottom: 12 }}>
                        <InlineEditableField
                          label="תווית הכתובת (למשל: סניף מרכזי)"
                          value={addr.label}
                          placeholder="תווית"
                          onSave={(val) => updateDeliveryAddress(addr.id, 'label', val)}
                        />
                     </div>
                     <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                       <InlineEditableField
                          label="רחוב ומספר"
                          value={addr.street}
                          placeholder="רחוב"
                          onSave={(val) => updateDeliveryAddress(addr.id, 'street', val)}
                       />
                       <InlineEditableField
                          label="עיר"
                          value={addr.city}
                          placeholder="עיר"
                          onSave={(val) => updateDeliveryAddress(addr.id, 'city', val)}
                       />
                     </div>
                   </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>

      {showAddressModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: 24, minWidth: 400, maxWidth: '90%', background: 'var(--surface)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>הוסף כתובת אספקה</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label>תווית הכתובת (אופציונלי)</label>
                <input 
                  className="form-input" 
                  value={newAddress.label} 
                  onChange={e => setNewAddress(prev => ({...prev, label: e.target.value}))} 
                  placeholder="למשל: סניף מרכזי, מחסן לוגיסטי" 
                />
              </div>
              <div className="form-group">
                <label>רחוב ומספר <span style={{ color: 'var(--pink)' }}>*</span></label>
                <input 
                  className="form-input" 
                  value={newAddress.street} 
                  onChange={e => setNewAddress(prev => ({...prev, street: e.target.value}))} 
                  placeholder="לדוגמה: הברזל 24" 
                />
              </div>
              <div className="form-group">
                <label>עיר <span style={{ color: 'var(--pink)' }}>*</span></label>
                <input 
                  className="form-input" 
                  value={newAddress.city} 
                  onChange={e => setNewAddress(prev => ({...prev, city: e.target.value}))} 
                  placeholder="לדוגמה: תל אביב" 
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowAddressModal(false)}>ביטול</button>
              <button className="btn btn-primary" onClick={handleCreateAddress}>שמור כתובת</button>
            </div>
          </div>
        </div>
      )}

      {showContactModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: 24, minWidth: 400, maxWidth: '90%', background: 'var(--surface)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>הוסף איש קשר</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label>שם מלא <span style={{ color: 'var(--pink)' }}>*</span></label>
                <input 
                  className="form-input" 
                  value={newContact.name} 
                  onChange={e => setNewContact(prev => ({...prev, name: e.target.value}))} 
                  placeholder="למשל: דגנית כהן" 
                />
              </div>
              <div className="form-group">
                <label>דוא״ל</label>
                <input 
                  className="form-input" 
                  type="email"
                  value={newContact.email} 
                  onChange={e => setNewContact(prev => ({...prev, email: e.target.value}))} 
                  placeholder="name@company.com" 
                  dir="ltr"
                />
              </div>
              <div className="form-group">
                <label>טלפון נייד</label>
                <input 
                  className="form-input" 
                  type="tel"
                  value={newContact.mobile} 
                  onChange={e => setNewContact(prev => ({...prev, mobile: e.target.value}))} 
                  placeholder="05X-XXXXXXX" 
                  dir="ltr"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowContactModal(false)}>ביטול</button>
              <button className="btn btn-primary" onClick={handleCreateContact}>שמור איש קשר</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function InlineEditableField({ 
  label, 
  value, 
  onSave, 
  type = 'text',
  options = [],
  placeholder = '',
  dir = 'rtl',
  icon
}: { 
  label: string, 
  value: string | number | null | undefined, 
  onSave: (val: string) => void,
  type?: string,
  options?: {value: string, label: string}[],
  placeholder?: string,
  dir?: string,
  icon?: React.ReactNode
}) {
  const [currentValue, setCurrentValue] = useState(value?.toString() || '')

  // Sync state if external prop changes
  useEffect(() => {
    setCurrentValue(value?.toString() || '')
  }, [value])

  const handleBlur = () => {
    if (currentValue !== (value?.toString() || '')) {
      onSave(currentValue)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
      {icon && <div style={{ color: 'var(--pink)', opacity: 0.8, paddingTop: 24, width: 16, display: 'flex', justifyContent: 'center' }}>{icon}</div>}
      <div style={{ flex: 1 }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>{label}</label>
        {type === 'textarea' ? (
          <textarea 
            className="form-textarea"
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
            style={{ 
              width: '100%', 
              fontSize: 13, 
              padding: '8px 10px', 
              direction: dir as any,
              border: currentValue ? '1px solid var(--border)' : '1px dashed var(--border-strong)',
              transition: 'border-color 0.2s',
              background: 'transparent'
            }}
            rows={4}
          />
        ) : type === 'select' ? (
          <select
            className="form-select"
            value={currentValue}
            onChange={(e) => {
              setCurrentValue(e.target.value)
              onSave(e.target.value)
            }}
            style={{ 
              width: '100%', 
              fontSize: 13, 
              padding: '8px 10px', 
              direction: dir as any,
              border: currentValue ? '1px solid var(--border)' : '1px dashed var(--border-strong)',
              transition: 'border-color 0.2s',
              background: 'transparent',
              appearance: 'auto'
            }}
          >
            <option value="">— בחר —</option>
            {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input 
              type={type}
              className="form-input"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              onBlur={handleBlur}
              placeholder={placeholder}
              style={{ 
                flex: 1,
                fontSize: 13, 
                padding: '8px 10px', 
                direction: dir as any,
                border: currentValue ? '1px solid var(--border)' : '1px dashed var(--border-strong)',
                transition: 'border-color 0.2s',
                background: 'transparent'
              }}
            />
            {type === 'url' && currentValue && (
              <a 
                href={currentValue.startsWith('http') ? currentValue : `https://${currentValue}`} 
                target="_blank" 
                rel="noopener noreferrer"
                title="פתח קישור בכרטיסייה חדשה"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.color = 'var(--pink)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
const BriefcaseIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
