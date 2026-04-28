'use client'

import React, { Suspense, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function NewOpportunityFormImpl() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  const [organizations, setOrganizations] = useState<{id: string, name: string}[]>([])
  const [contacts, setContacts] = useState<{id: string, name: string}[]>([])
  
  // Explicit names for display
  const [selectedContactName, setSelectedContactName] = useState('')
  const [selectedOrgName, setSelectedOrgName] = useState('')

  // Organization modal state
  const [showOrgModal, setShowOrgModal] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  
  // Contact search modal state
  const [showContactSelectModal, setShowContactSelectModal] = useState(false)
  const [contactSearchQuery, setContactSearchQuery] = useState('')

  // Org search modal state
  const [showOrgSelectModal, setShowOrgSelectModal] = useState(false)
  const [orgSearchQuery, setOrgSearchQuery] = useState('')
  
  // Contact modal state
  const [showContactModal, setShowContactModal] = useState(false)
  const [newContactName, setNewContactName] = useState('')
  
  const [form, setForm] = useState({
    subject: '',
    status: 'new',
    contact_id: searchParams.get('contact_id') || '',
    organization_id: searchParams.get('organization_id') || '',
    calculated_value: '',
    lead_source: '',
    description: '',
    expected_delivery: '',
    payment_date: '',
  })

  // Initial load of latest items (small batch)
  useEffect(() => {
    async function loadInitial() {
      const [{ data: orgs }, { data: conts }] = await Promise.all([
        (supabase.from('organizations') as any).select('id, name').order('name').limit(20),
        (supabase.from('contacts') as any).select('id, name, email, mobile, organization_id, organizations(name)').order('name').limit(20)
      ])
      if (orgs) setOrganizations(orgs)
      if (conts) setContacts(conts as any)
    }
    loadInitial()
  }, [supabase])

  // Server-side Contact Search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!contactSearchQuery.trim()) {
        const { data } = await (supabase.from('contacts') as any).select('id, name, email, mobile, organization_id, organizations(name)').order('name').limit(20)
        if (data) setContacts(data as any)
        return
      }
      
      const q = contactSearchQuery.trim()
      
      // 1. Find matching organizations
      const { data: matchedOrgs } = await (supabase.from('organizations') as any).select('id').ilike('name', `%${q}%`)
      const orgIds = (matchedOrgs as any[])?.map(o => o.id) || []
      
      // 2. Build explicit OR query
      let orQuery = `name.ilike.%${q}%,email.ilike.%${q}%,mobile.ilike.%${q}%`
      if (orgIds.length > 0) {
        orQuery += `,organization_id.in.(${orgIds.join(',')})`
      }
      
      const { data } = await (supabase
        .from('contacts') as any)
        .select('id, name, email, mobile, organization_id, organizations(name)')
        .or(orQuery)
        .limit(50)
      
      if (data) setContacts(data as any)
    }, 400)
    
    return () => clearTimeout(timer)
  }, [contactSearchQuery, supabase])

  // Server-side Org Search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!orgSearchQuery.trim()) {
        const { data } = await supabase.from('organizations').select('id, name').order('name').limit(20)
        if (data) setOrganizations(data)
        return
      }
      
      const { data } = await (supabase
        .from('organizations') as any)
        .select('id, name')
        .ilike('name', `%${orgSearchQuery.trim()}%`)
        .limit(50)
      
      if (data) setOrganizations(data)
    }, 400)
    
    return () => clearTimeout(timer)
  }, [orgSearchQuery, supabase])

  // Sync explicitly from searchParams to guarantee we have their names even if outside the 2000 limit   // Parse url params for pre-population or edit mode
  useEffect(() => {
    const cId = searchParams.get('contact_id')
    const oId = searchParams.get('organization_id')
    const editId = searchParams.get('edit_id')
    
    // Attempt Edit Mode Init
    if (editId) {
      const loadEditedOpp = async () => {
        const { data, error } = await (supabase.from('opportunities') as any).select('*, contacts(name), organizations(name)').eq('id', editId).single()
        if (data) {
          setForm({
            subject: data.subject || '',
            status: data.status || 'new',
            contact_id: data.contact_id || '',
            organization_id: data.organization_id || '',
            calculated_value: data.calculated_value?.toString() || '',
            lead_source: data.lead_source || '',
            description: data.description || '',
            expected_delivery: data.expected_delivery || '',
            payment_date: data.payment_date || '',
          })
          if (data.contacts?.name) setSelectedContactName(data.contacts.name)
          if (data.organizations?.name) setSelectedOrgName(data.organizations.name)
        }
      }
      loadEditedOpp()
      return // skip standard init
    }

    const initSelection = async () => {
      let resolvedOrgId = oId
      
      if (cId) {
        const { data: c } = await (supabase.from('contacts') as any).select('id, name, organization_id, organizations(name)').eq('id', cId).single()
        if (c) {
          setSelectedContactName(c.name)
          if (c.organization_id && c.organizations) {
            resolvedOrgId = c.organization_id
            setSelectedOrgName(c.organizations.name)
          }
        }
      }
      
      if (resolvedOrgId && !selectedOrgName) {
         const { data: o } = await (supabase.from('organizations') as any).select('id, name').eq('id', resolvedOrgId).single()
         if (o) setSelectedOrgName(o.name)
      }

      setForm(prev => ({ 
         ...prev, 
         contact_id: cId || prev.contact_id, 
         organization_id: resolvedOrgId || prev.organization_id
       }))
    }
    
    if (cId || oId) {
       initSelection()
    }
  }, [searchParams, supabase])
  
  // Update name displays if missing and available in local list
  useEffect(() => {
     if (form.contact_id && !selectedContactName && contacts.length > 0) {
        const c = contacts.find(c => String(c.id) === String(form.contact_id))
        if (c) setSelectedContactName(c.name)
     }
     if (form.organization_id && !selectedOrgName && organizations.length > 0) {
        const o = organizations.find(o => String(o.id) === String(form.organization_id))
        if (o) setSelectedOrgName(o.name)
     }
  }, [form.contact_id, form.organization_id, contacts, organizations, selectedContactName, selectedOrgName])

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return
    const { data, error } = await (supabase.from('organizations') as any).insert({ name: newOrgName.trim() }).select().single()
    if (data) {
      setOrganizations(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(prev => ({ ...prev, organization_id: data.id }))
      setSelectedOrgName(data.name)
      setShowOrgModal(false)
      setNewOrgName('')
    } else if (error) {
      alert(`שגיאה ביצירת ארגון: ${error.message}`)
    }
  }

  const handleCreateContact = async () => {
    if (!newContactName.trim()) return
    const { data, error } = await (supabase.from('contacts') as any).insert({ 
      name: newContactName.trim(),
      organization_id: form.organization_id || null // Link to selected org if any
    }).select().single()

    if (data) {
      setContacts(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(prev => ({ ...prev, contact_id: data.id }))
      setSelectedContactName(data.name)
      setShowContactModal(false)
      setNewContactName('')
    } else if (error) {
      alert(`שגיאה ביצירת איש קשר: ${error.message}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.subject.trim()) {
      setError('נושא ההזדמנות הוא שדה חובה')
      return
    }
    if (!form.contact_id) {
      setError('חובה לבחור איש קשר (למי שייכת ההזדמנות?)')
      return
    }

    setLoading(true)
    setError('')

    const editId = searchParams.get('edit_id')

    const oppPayload = {
      subject: form.subject.trim(),
      status: form.status,
      contact_id: form.contact_id,
      organization_id: form.organization_id || null,
      calculated_value: form.calculated_value ? parseFloat(form.calculated_value) : 0,
      lead_source: form.lead_source || null,
      description: form.description || null,
      expected_delivery: form.expected_delivery || null,
      payment_date: form.payment_date || null,
    }

    let sbError;
    let newId = editId;

    if (editId) {
      const { error } = await (supabase.from('opportunities') as any).update(oppPayload).eq('id', editId)
      sbError = error
    } else {
      const { data, error } = await (supabase.from('opportunities') as any).insert(oppPayload).select().single()
      sbError = error
      if (data) newId = data.id
    }

    if (sbError) {
      setError(sbError.message)
      setLoading(false)
      return
    }

    router.push(newId ? `/opportunities/${newId}` : '/opportunities')
  }

  if (!isMounted) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <span className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--pink)' }} />
      </div>
    )
  }

  return (
    <>
      <div className="topbar">
        <div />
      </div>

      <div className="page-body">
        <div className="page-header">
          <div>
            <div className="breadcrumb">
              <Link href="/dashboard">לוח בקרה</Link>
              <span className="breadcrumb-sep">/</span>
              <Link href="/opportunities">הזדמנויות</Link>
              <span className="breadcrumb-sep">/</span>
              <span>{searchParams.get('edit_id') ? 'עריכת הזדמנות' : 'הזדמנות חדשה'}</span>
            </div>
            <h1 className="page-title">{searchParams.get('edit_id') ? 'עריכת פרטי הזדמנות' : 'פתיחת הזדמנות חדשה'}</h1>
            <p className="page-subtitle">{searchParams.get('edit_id') ? 'עדכן את פרטי העסקה והלקוח ושמור שינויים' : 'הזן את פרטי העסקה והלקוח הרלוונטי'}</p>
          </div>
        </div>

        <div className="card" style={{ maxWidth: 800 }}>
          <form onSubmit={handleSubmit}>
            {error && <div className="error-box">{error}</div>}

            <div className="form-group">
              <label>נושא העסקה / שם ההזדמנות <span style={{ color: 'var(--pink)' }}>*</span></label>
              <input
                className="form-input"
                type="text"
                placeholder="לדוגמה: הקמת אתר תדמית לחברה"
                value={form.subject}
                onChange={e => set('subject', e.target.value)}
                autoFocus
                style={{ fontSize: 16, padding: '12px 14px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24, paddingBottom: 24, borderBottom: '1px solid var(--border-light)' }}>
              {/* CONTACT & ORG */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>פרטי הלקוח</h3>
                  
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ margin: 0 }}>איש קשר בעסקה <span style={{ color: 'var(--pink)' }}>*</span></label>
                      <button 
                        type="button" 
                        onClick={() => setShowContactModal(true)}
                        style={{ background: 'none', border: 'none', color: 'var(--pink)', fontSize: 12, cursor: 'pointer', fontWeight: 600, padding: 0 }}
                      >
                        + איש קשר חדש
                      </button>
                    </div>
                    <div 
                      onClick={() => setShowContactSelectModal(true)}
                      style={{ marginTop: 4, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'white', minHeight: 44, display: 'flex', alignItems: 'center', color: form.contact_id ? 'var(--text-primary)' : 'var(--text-muted)' }}
                    >
                      {form.contact_id && selectedContactName ? selectedContactName : '— לחץ לחיפוש איש קשר —'}
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ margin: 0 }}>ארגון (O2B אופציונלי)</label>
                      <button 
                        type="button" 
                        onClick={() => setShowOrgModal(true)}
                        style={{ background: 'none', border: 'none', color: 'var(--pink)', fontSize: 12, cursor: 'pointer', fontWeight: 600, padding: 0 }}
                      >
                        + ארגון חדש
                      </button>
                    </div>
                    <div 
                      onClick={() => setShowOrgSelectModal(true)}
                      style={{ marginTop: 4, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'white', minHeight: 44, display: 'flex', alignItems: 'center', color: form.organization_id ? 'var(--text-primary)' : 'var(--text-muted)' }}
                    >
                      {form.organization_id && selectedOrgName ? selectedOrgName : '— לקוח פרטי / לחץ לבחירת ארגון —'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      * אם מדובר בלקוח פרטי, השאר שדה זה ריק.
                    </div>
                  </div>
                </div>
              </div>

              {/* DEAL DETAILS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>פרטי העסקה</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label>סטטוס</label>
                      <select
                        className="form-select"
                        value={form.status}
                        onChange={e => set('status', e.target.value)}
                      >
                        <option value="new">חדש</option>
                        <option value="followup">במעקב</option>
                        <option value="won">זכייה / סגור</option>
                        <option value="lost">הפסד</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>שווי מוערך (₪)</label>
                      <input
                        className="form-input"
                        type="number"
                        placeholder="0"
                        value={form.calculated_value}
                        onChange={e => set('calculated_value', e.target.value)}
                        style={{ direction: 'ltr', textAlign: 'right' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <div className="form-group">
                      <label>מקור הליד</label>
                      <select
                        className="form-select"
                        value={form.lead_source}
                        onChange={e => set('lead_source', e.target.value)}
                      >
                        <option value="">— בחר מקור —</option>
                        <option value="website">אתר אינטרנט</option>
                        <option value="whatsapp">הודעת וואטסאפ</option>
                        <option value="phone">שיחה טלפונית</option>
                        <option value="referral">הפניה / מפה לאוזן</option>
                        <option value="returning">לקוח חוזר</option>
                        <option value="other">אחר</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>תאריך אספקה (משוער)</label>
                      <input
                        className="form-input"
                        type="date"
                        value={form.expected_delivery}
                        onChange={e => set('expected_delivery', e.target.value)}
                        style={{ padding: '7px 10px' }}
                      />
                    </div>

                    <div className="form-group">
                      <label>תאריך תשלום</label>
                      <input
                        className="form-input"
                        type="date"
                        value={form.payment_date}
                        onChange={e => set('payment_date', e.target.value)}
                        style={{ padding: '7px 10px' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 24 }}>
              <label>תיאור ופרטים נוספים</label>
              <textarea
                className="form-textarea"
                placeholder="פירוט על דרישות הלקוח, לו״ז צפוי, נקודות חשובות..."
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={4}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <Link 
                href={searchParams.get('edit_id') ? `/opportunities/${searchParams.get('edit_id')}` : "/opportunities"} 
                className="btn btn-secondary"
              >
                ביטול
              </Link>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <span className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} />
                ) : searchParams.get('edit_id') ? 'שמור שינויים' : 'צור הזדמנות'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* MODALS */}
      {showOrgModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: 24, minWidth: 400, maxWidth: '90%', background: 'var(--surface)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>יצירת ארגון בבזק</h3>
            <div className="form-group">
              <label>שם מלא של הארגון/חברה <span style={{ color: 'var(--pink)' }}>*</span></label>
              <input 
                autoFocus
                className="form-input" 
                value={newOrgName} 
                onChange={e => setNewOrgName(e.target.value)} 
                placeholder="למשל: סיילספורס ישראל" 
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleCreateOrg(); }
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowOrgModal(false)}>ביטול</button>
              <button type="button" className="btn btn-primary" onClick={handleCreateOrg}>צור ארגון</button>
            </div>
          </div>
        </div>
      )}

      {showContactModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: 24, minWidth: 400, maxWidth: '90%', background: 'var(--surface)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>יצירת איש קשר בבזק</h3>
            <div className="form-group">
              <label>שם מלא <span style={{ color: 'var(--pink)' }}>*</span></label>
              <input 
                autoFocus
                className="form-input" 
                value={newContactName} 
                onChange={e => setNewContactName(e.target.value)} 
                placeholder="למשל: דורון סגל" 
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleCreateContact(); }
                }}
              />
            </div>
            {form.organization_id && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                * תחת השיוך לארגון שנבחר בטופס
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowContactModal(false)}>ביטול</button>
              <button type="button" className="btn btn-primary" onClick={handleCreateContact}>צור איש קשר</button>
            </div>
          </div>
        </div>
      )}
      {/* Search Modals */}
      {showContactSelectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh' }}>
          <div className="card" style={{ padding: 24, width: '90%', maxWidth: 700, maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: '#ffffff', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
               <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>בחירת איש קשר</h3>
               <button onClick={() => setShowContactSelectModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24 }}>×</button>
            </div>
            <input 
              autoFocus
              className="form-input" 
              placeholder="חפש לפי שם, מייל, טלפון, או ארגון..." 
              value={contactSearchQuery}
              onChange={e => setContactSearchQuery(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border)', borderRadius: 8 }}>
               <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead style={{ background: 'var(--surface)' }}>
                     <tr>
                        <th style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>שם</th>
                        <th style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>אימייל</th>
                        <th style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>נייד</th>
                        <th style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>ארגון</th>
                     </tr>
                  </thead>
                  <tbody>
                     {contacts.map((c: any) => (
                        <tr 
                          key={c.id} 
                          onClick={() => {
                             set('contact_id', c.id)
                             setSelectedContactName(c.name)
                             if (c.organization_id && !form.organization_id) {
                               set('organization_id', c.organization_id)
                               setSelectedOrgName(c.organizations?.name || '')
                             }
                             setShowContactSelectModal(false)
                             setContactSearchQuery('')
                          }}
                          style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }}
                          onMouseOver={e => e.currentTarget.style.background = 'var(--surface)'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                           <td style={{ padding: 12, fontWeight: 600, color: 'var(--pink)' }}>{c.name}</td>
                           <td style={{ padding: 12 }}>{c.email || '-'}</td>
                           <td style={{ padding: 12 }}>{c.mobile || '-'}</td>
                           <td style={{ padding: 12 }}>{c.organizations?.name ? <span className="badge badge-gray">{c.organizations.name}</span> : '-'}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </div>
        </div>
      )}

      {showOrgSelectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh' }}>
          <div className="card" style={{ padding: 24, width: '90%', maxWidth: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: '#ffffff', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
               <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>בחירת ארגון משוייך</h3>
               <button onClick={() => { setShowOrgSelectModal(false); set('organization_id', ''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>נקה בחירה</button>
            </div>
            <input 
              autoFocus
              className="form-input" 
              placeholder="חפש ארגון..." 
              value={orgSearchQuery}
              onChange={e => setOrgSearchQuery(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border)', borderRadius: 8 }}>
               <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead style={{ background: 'var(--surface)' }}>
                     <tr>
                        <th style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>שם הארגון</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr onClick={() => { set('organization_id', ''); setSelectedOrgName(''); setShowOrgSelectModal(false); }} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>— ללא ארגון (לקוח פרטי) —</td>
                     </tr>
                     {organizations.map(o => (
                        <tr 
                          key={o.id} 
                          onClick={() => {
                             set('organization_id', o.id)
                             setSelectedOrgName(o.name)
                             setShowOrgSelectModal(false)
                             setOrgSearchQuery('')
                          }}
                          style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }}
                          onMouseOver={e => e.currentTarget.style.background = 'var(--surface)'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                           <td style={{ padding: 12, fontWeight: 600 }}>{o.name}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const NewOpportunityForm = dynamic(() => Promise.resolve(NewOpportunityFormImpl), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 100, textAlign: 'center' }}>
      <span className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--pink)' }} />
    </div>
  )
})

export default function NewOpportunityPage() {
  return (
    <Suspense fallback={<div style={{ padding: 100, textAlign: 'center' }}><span className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--pink)' }} /></div>}>
      <NewOpportunityForm />
    </Suspense>
  )
}
