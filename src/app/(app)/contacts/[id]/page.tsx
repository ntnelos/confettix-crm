'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Organization {
  id: string
  name: string
}

interface Address {
  id: string
  label: string | null
  street: string
  city: string
  zip_code: string | null
  notes: string | null
  contact_id?: string | null
}

interface Contact {
  id: string
  name: string
  email: string | null
  mobile: string | null
  phone: string | null
  notes: string | null
  organization_id: string | null
  organizations?: Organization | null
  created_at: string
}

export default function ContactDetailsPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  
  const [opportunities, setOpportunities] = useState<any[]>([])
  
  // Organization Assignment Modal State
  const [organizations, setOrganizations] = useState<{id: string, name: string}[]>([])
  const [showOrgAssignModal, setShowOrgAssignModal] = useState(false)
  const [orgSearchQuery, setOrgSearchQuery] = useState('')
  const [isCreatingOrg, setIsCreatingOrg] = useState(false)
  
  // Addresses State
  const [addresses, setAddresses] = useState<Address[]>([])
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [editAddressId, setEditAddressId] = useState<string | null>(null)
  const [addrForm, setAddrForm] = useState({ label: '', street: '', city: '', zip_code: '', notes: '' })

  useEffect(() => {
    async function loadData() {
      const contactRes: any = await supabase.from('contacts').select('*, organizations(id, name)').eq('id', id).single()
      const orgsRes: any = await supabase.from('organizations').select('id, name').order('name')
      
      if (contactRes.error || !contactRes.data) {
        console.error("Contact not found", contactRes.error)
        router.push('/contacts')
        return
      }
      const c = contactRes.data as Contact
      setContact(c)
      if (orgsRes.data) setOrganizations(orgsRes.data)

      // Fetch Addresses (belonging to Org or Contact directly)
      const addrQuery = supabase.from('delivery_addresses').select('*')
      if (c.organization_id) {
        addrQuery.eq('organization_id', c.organization_id)
      } else {
        addrQuery.eq('contact_id', c.id)
      }
      
      const { data: addrs } = await addrQuery
      if (addrs) setAddresses(addrs)
      
      const { data: opps } = await supabase.from('opportunities')
        .select('*')
        .eq('contact_id', c.id)
        .order('created_at', { ascending: false })
      if (opps) setOpportunities(opps)
      
      setLoading(false)
    }

    if (id) loadData()
  }, [id, router, supabase])

  const handleDeleteContact = async () => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את איש הקשר "${contact?.name}" לצמיתות?`)) return
    
    setLoading(true)
    const { error } = await (supabase.from('contacts') as any).delete().eq('id', id)
    if (error) {
      alert(`שגיאה במחיקת איש הקשר: ${error.message}`)
      setLoading(false)
    } else {
      if (contact?.organization_id) router.push(`/organizations/${contact.organization_id}`)
      else router.push('/contacts')
    }
  }

  const updateContactField = async (field: keyof Contact, value: string | null) => {
    if (!contact) return
    const original = { ...contact }
    setContact({ ...contact, [field]: value as never })

    const valForDB = (value === '') ? null : value
    const { error } = await (supabase.from('contacts') as any).update({ [field]: valForDB }).eq('id', contact.id)
    
    if (error) {
      console.error(error)
      alert(`שגיאה בעדכון השדה: ${error.message}`)
      setContact(original) // Revert
    }
  }

  // ---- Org Assignment & Creation ----
  const handleAssignOrg = async (orgId: string, orgName: string) => {
    updateContactField('organization_id', orgId)
    // Optimistic relational update
    setContact(prev => prev ? { ...prev, organization_id: orgId, organizations: { id: orgId, name: orgName } } : prev)
    setShowOrgAssignModal(false)
    
    // Refresh addresses
    const { data } = await supabase.from('delivery_addresses').select('*').eq('organization_id', orgId)
    if (data) setAddresses(data)
  }

  const handleCreateNewOrg = async () => {
    if (!orgSearchQuery.trim()) return
    const { data, error } = await (supabase.from('organizations') as any).insert({ name: orgSearchQuery.trim() }).select().single()
    if (data) {
      setOrganizations(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      handleAssignOrg(data.id, data.name)
    } else if (error) {
      alert(`שגיאה ביצירת ארגון: ${error.message}`)
    }
  }

  const handleRemoveOrg = async () => {
    if (!window.confirm('האם להסיר את השיוך לארגון זה?')) return
    updateContactField('organization_id', null)
    setContact(prev => prev ? { ...prev, organization_id: null, organizations: null } : prev)
    
    // Refresh addresses to contact's own (if any)
    const { data } = await (supabase.from('delivery_addresses') as any).select('*').eq('contact_id', id)
    setAddresses(data || [])
  }

  // ---- Addresses Management ----
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addrForm.street || !addrForm.city) return alert('חובה להזין רחוב ועיר')

    const payload = {
       ...addrForm,
       contact_id: id // We only ever save addresses to contact_id when managing from here without an org
    }

    if (editAddressId) {
      const { error } = await (supabase.from('delivery_addresses') as any).update(payload).eq('id', editAddressId)
      if (!error) {
        setAddresses(prev => prev.map(a => a.id === editAddressId ? { ...a, ...payload } : a))
      } else alert(error.message)
    } else {
      const { data, error } = await (supabase.from('delivery_addresses') as any).insert(payload).select().single()
      if (data) setAddresses(prev => [...prev, data])
      else if (error) alert(error.message)
    }
    setShowAddressModal(false)
  }

  const handleDeleteAddress = async (addrId: string) => {
    if (!window.confirm('למחוק כתובת זו?')) return
    const { error } = await (supabase.from('delivery_addresses') as any).delete().eq('id', addrId)
    if (!error) setAddresses(prev => prev.filter(a => a.id !== addrId))
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <span className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--pink)' }} />
      </div>
    )
  }

  if (!contact) return null

  // Filter orgs by search query
  const filteredOrgs = organizations.filter(o => o.name.toLowerCase().includes(orgSearchQuery.toLowerCase()))

  return (
    <>
      <div className="topbar">
        <div></div>
      </div>

      <div className="page-body">
        {/* Header section */}
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
              {contact.organization_id && contact.organizations ? (
                <>
                  <Link href={`/organizations/${contact.organization_id}`} style={{ color: 'inherit' }}>{contact.organizations.name}</Link>
                  <span className="breadcrumb-sep">/</span>
                </>
              ) : (
                <>
                  <Link href="/contacts" style={{ color: 'inherit' }}>אנשי קשר</Link>
                  <span className="breadcrumb-sep">/</span>
                </>
              )}
              <span style={{ color: 'white' }}>{contact.name}</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 12 }}>
                <UserIcon />
              </div>
              <div>
                <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>
                  <EditableTitle value={contact.name} onSave={(val) => updateContactField('name', val)} />
                </h1>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>
                  {contact.email && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MailIcon /> <a href={`mailto:${contact.email}`} style={{ color: 'inherit' }}>{contact.email}</a></span>}
                  {contact.mobile && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><PhoneIcon /> <a href={`tel:${contact.mobile}`} style={{ color: 'inherit', direction: 'ltr', display: 'inline-block' }}>{contact.mobile}</a></span>}
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <Link 
              href="/contacts/new"
              className="btn btn-secondary"
              style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}
            >
              <PlusIcon /> איש קשר חדש
            </Link>
            <Link 
              href={`/opportunities/new?contact_id=${contact.id}${contact.organization_id ? `&organization_id=${contact.organization_id}` : ''}`}
              className="btn btn-primary"
              style={{ background: 'white', color: 'var(--pink)' }}
            >
              <PlusIcon /> הזדמנות חדשה
            </Link>
            <button 
               onClick={handleDeleteContact}
               title="מחק איש קשר"
               style={{ 
                 background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', 
                 color: 'white', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', 
                 display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, 
                 transition: 'all 0.2s',
               }}
               onMouseOver={e => e.currentTarget.style.background='rgba(255,0,0,0.6)'}
               onMouseOut={e => e.currentTarget.style.background='transparent'}
            >
              <TrashIcon />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 24, alignItems: 'start' }}>
          
          {/* Main Space */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Notes Card */}
            <div className="card">
              <div className="card-header">
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>מידע נוסף והערות</h2>
              </div>
              <div style={{ padding: '0 20px 20px 20px' }}>
                <InlineEditableField
                  label=""
                  value={contact.notes}
                  type="textarea"
                  placeholder="לחץ כאן כדי להוסיף הערות רלוונטיות, העדפות, זמנים מועדפים ליצירת קשר..."
                  onSave={(val) => updateContactField('notes', val)}
                />
              </div>
            </div>

            {/* Delivery Addresses Card */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <MapPinIcon />
                  <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                    כתובות למשלוח / אספקה
                  </h2>
                  {contact.organization_id && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 12, background: 'var(--surface-2)' }}>
                      כתובות מקושרות לארגון {contact.organizations?.name}
                    </span>
                  )}
                </div>
                {!contact.organization_id && (
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setAddrForm({ label: '', street: '', city: '', zip_code: '', notes: '' })
                      setEditAddressId(null)
                      setShowAddressModal(true)
                    }}
                  >
                    <PlusIcon /> הוסף כתובת
                  </button>
                )}
              </div>
              <div style={{ padding: 20 }}>
                
                {addresses.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
                    לא נמצאו כתובות אספקה ל{contact.organization_id ? 'ארגון זה' : 'איש קשר זה'}.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
                    {addresses.map(addr => (
                      <div key={addr.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--surface-2)', position: 'relative' }}>
                        {!contact.organization_id && (
                          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6 }}>
                            <button className="btn-icon" onClick={() => { setAddrForm(addr as any); setEditAddressId(addr.id); setShowAddressModal(true) }}>
                              <EditIcon />
                            </button>
                            <button className="btn-icon" onClick={() => handleDeleteAddress(addr.id)} style={{ color: 'var(--pink)' }}>
                              <TrashIcon />
                            </button>
                          </div>
                        )}
                        <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)', paddingLeft: contact.organization_id ? 0 : 50 }}>
                          {addr.label || 'כתובת אספקה'}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {addr.street}<br/>
                          {addr.city} {addr.zip_code ? `- ${addr.zip_code}` : ''}
                          {addr.notes && (
                            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                              הערות: {addr.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Opportunities Card */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>הזדמנויות מקושרות</h2>
                <span style={{ fontSize: 13, background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 12 }}>{opportunities.length}</span>
              </div>
              <div style={{ padding: 20 }}>
                {opportunities.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>אין הזדמנויות לאיש קשר זה.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {opportunities.map(opp => (
                      <Link key={opp.id} href={`/opportunities/${opp.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, border: '1px solid var(--border-light)', borderRadius: 12, textDecoration: 'none', color: 'inherit', transition: 'all 0.2s', background: 'var(--surface)' }} onMouseOver={e => e.currentTarget.style.borderColor='var(--border-strong)'} onMouseOut={e => e.currentTarget.style.borderColor='var(--border-light)'}>
                        <div>
                           <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{opp.subject}</div>
                           <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>נוצר ב: {new Date(opp.created_at).toLocaleDateString('he-IL')}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                           <div style={{ fontWeight: 700, fontSize: 14 }}>₪{parseFloat(opp.calculated_value || 0).toLocaleString()}</div>
                           <div style={{ fontSize: 12, padding: '4px 10px', borderRadius: 12, fontWeight: 600, background: opp.status === 'won' ? '#dcfce7' : opp.status === 'lost' ? '#fee2e2' : 'var(--surface-2)', color: opp.status === 'won' ? '#166534' : opp.status === 'lost' ? '#991b1b' : 'var(--text-secondary)' }}>
                             {opp.status === 'new' ? 'חדש' : opp.status === 'followup' ? 'בטיפול' : opp.status === 'won' ? 'זכייה' : 'בוטל'}
                           </div>
                        </div>
                      </Link>
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
                <h2 style={{ fontSize: 15, fontWeight: 600 }}>פרטי התקשרות</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 20px' }}>
                <InlineEditableField
                  label="דואר אלקטרוני"
                  value={contact.email}
                  type="email"
                  placeholder="name@example.com"
                  dir="ltr"
                  onSave={(val) => updateContactField('email', val)}
                />
                <InlineEditableField
                  label="טלפון נייד"
                  value={contact.mobile}
                  type="tel"
                  placeholder="05X-XXXXXXX"
                  dir="ltr"
                  onSave={(val) => updateContactField('mobile', val)}
                />
                <InlineEditableField
                  label="טלפון קווי עבודה / אחר"
                  value={contact.phone}
                  type="tel"
                  placeholder="0X-XXXXXXX"
                  dir="ltr"
                  onSave={(val) => updateContactField('phone', val)}
                />
                
                {/* Organization Link Block */}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--border-strong)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>שיוך לארגון</div>
                  
                  {contact.organization_id ? (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Link href={`/organizations/${contact.organization_id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text-primary)' }}>
                        <BuildingIcon />
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{contact.organizations?.name || 'ארגון מקושר'}</span>
                      </Link>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-icon" title="שנה ארגון" onClick={() => { setOrgSearchQuery(''); setShowOrgAssignModal(true) }}>
                          <EditIcon />
                        </button>
                        <button className="btn-icon" title="בטל שיוך לארגון" onClick={handleRemoveOrg} style={{ color: 'var(--pink)' }}>
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => { setOrgSearchQuery(''); setShowOrgAssignModal(true) }}
                      style={{ 
                        width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, 
                        background: 'transparent', border: '1px dashed var(--pink)', color: 'var(--pink)', 
                        padding: '10px 0', borderRadius: 8, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' 
                      }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(230,0,126,0.05)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      + שייך לארגון
                    </button>
                  )}
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
      
      {/* ORGANIZATION ASSIGNMENT MODAL */}
      {showOrgAssignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: 24, minWidth: 400, maxWidth: '90%', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>חיפוש או שיוך לארגון</h3>
              <button 
                className="btn-icon" 
                onClick={() => setShowOrgAssignModal(false)}
              >
                <XIcon />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <input 
                  autoFocus
                  className="form-input" 
                  value={orgSearchQuery} 
                  onChange={e => setOrgSearchQuery(e.target.value)} 
                  placeholder="הקלד שם ארגון לחיפוש..." 
                  style={{ width: '100%', fontSize: 14 }}
                />
              </div>

              {/* ACTION: CREATE NEW */}
              {orgSearchQuery.trim() && !organizations.some(o => o.name === orgSearchQuery.trim()) && (
                <button 
                  onClick={handleCreateNewOrg}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: 'rgba(230,0,126,0.1)', 
                    border: '1px dashed var(--pink)', color: 'var(--pink)', borderRadius: 8, cursor: 'pointer', fontWeight: 600
                  }}
                >
                  <PlusIcon /> יצירת ארגון חדש בשם: &quot;{orgSearchQuery}&quot;
                </button>
              )}

              {/* SEARCH RESULTS */}
              <div style={{ maxHeight: 250, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                {filteredOrgs.length > 0 ? filteredOrgs.map(org => (
                  <div 
                    key={org.id} 
                    onClick={() => handleAssignOrg(org.id, org.name)}
                    style={{ 
                      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', 
                      borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' 
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <BuildingIcon />
                    {org.name}
                  </div>
                )) : (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                    לא נמצאו תוצאות.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADDRESS MODAL FOR CONTACT ONLY */}
      {showAddressModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: 24, minWidth: 400, maxWidth: '90%', background: 'var(--surface)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{editAddressId ? 'עריכת כתובת ללקוח' : 'תיעוד כתובת חדשה ללקוח'}</h3>
            <form onSubmit={handleSaveAddress}>
              <div className="form-group">
                <label>כינוי / תווית הכתובת (אופציונלי)</label>
                <input className="form-input" value={addrForm.label} onChange={e => setAddrForm(p => ({...p, label: e.target.value}))} placeholder="למשל: בית, מחסן, משרד" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>עיר <span style={{color: 'var(--pink)'}}>*</span></label>
                  <input className="form-input" value={addrForm.city} onChange={e => setAddrForm(p => ({...p, city: e.target.value}))} required />
                </div>
                <div className="form-group">
                  <label>רחוב ומספר <span style={{color: 'var(--pink)'}}>*</span></label>
                  <input className="form-input" value={addrForm.street} onChange={e => setAddrForm(p => ({...p, street: e.target.value}))} required />
                </div>
              </div>
              <div className="form-group">
                <label>מיקוד</label>
                <input className="form-input" value={addrForm.zip_code} onChange={e => setAddrForm(p => ({...p, zip_code: e.target.value}))} />
              </div>
              <div className="form-group">
                <label>הערות שליח / הגעה</label>
                <textarea className="form-textarea" rows={2} value={addrForm.notes} onChange={e => setAddrForm(p => ({...p, notes: e.target.value}))} />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddressModal(false)}>ביטול</button>
                <button type="submit" className="btn btn-primary">{editAddressId ? 'שמור שינויים' : 'הוסף כתובת'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function UserIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
      <path d="M9 22v-4h6v4"></path>
      <path d="M8 6h.01"></path>
      <path d="M16 6h.01"></path>
      <path d="M12 6h.01"></path>
      <path d="M12 10h.01"></path>
      <path d="M12 14h.01"></path>
      <path d="M16 10h.01"></path>
      <path d="M16 14h.01"></path>
      <path d="M8 10h.01"></path>
      <path d="M8 14h.01"></path>
    </svg>
  )
}

function MapPinIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
}

function PlusIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}

const MailIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
const PhoneIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>

const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"></path></svg>
const EditIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
const XIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>

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
          color: 'white', 
          fontSize: 'inherit',
          fontWeight: 'inherit',
          fontFamily: 'inherit',
          padding: '2px 8px',
          borderRadius: 6,
          outline: 'none',
          width: '100%'
        }}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => {
          setEditing(false)
          if (val.trim() && val !== value) onSave(val.trim())
          else setVal(value)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
    )
  }

  return (
    <span 
      onClick={() => setEditing(true)} 
      style={{ cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.4)', paddingBottom: 2 }}
      title="לחץ לעריכה"
    >
      {value}
    </span>
  )
}

function InlineEditableField({ 
  label, 
  value, 
  onSave, 
  type = 'text',
  placeholder = '',
  dir = 'rtl',
}: { 
  label: string, 
  value: string | number | null | undefined, 
  onSave: (val: string) => void,
  type?: string,
  placeholder?: string,
  dir?: string,
}) {
  const [currentValue, setCurrentValue] = useState(value?.toString() || '')

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
      <div style={{ flex: 1 }}>
        {label && <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>{label}</label>}
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
