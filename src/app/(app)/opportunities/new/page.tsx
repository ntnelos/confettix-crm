'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function NewOpportunityForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [organizations, setOrganizations] = useState<{id: string, name: string}[]>([])
  const [contacts, setContacts] = useState<{id: string, name: string}[]>([])
  
  // Organization modal state
  const [showOrgModal, setShowOrgModal] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  
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
  })

  // Load Orgs and Contacts
  useEffect(() => {
    async function loadData() {
      const [{ data: orgs }, { data: conts }] = await Promise.all([
        supabase.from('organizations').select('id, name').order('name'),
        supabase.from('contacts').select('id, name').order('name')
      ])
      if (orgs) setOrganizations(orgs)
      if (conts) setContacts(conts)
    }
    loadData()
  }, [supabase])

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return
    const { data, error } = await supabase.from('organizations').insert({ name: newOrgName.trim() }).select().single()
    if (data) {
      setOrganizations(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(prev => ({ ...prev, organization_id: data.id }))
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

    const { error: sbError } = await (supabase.from('opportunities') as any).insert({
      subject: form.subject.trim(),
      status: form.status,
      contact_id: form.contact_id,
      organization_id: form.organization_id || null,
      calculated_value: form.calculated_value ? parseFloat(form.calculated_value) : 0,
      lead_source: form.lead_source || null,
      description: form.description || null,
      expected_delivery: form.expected_delivery || null,
    })

    if (sbError) {
      setError(sbError.message)
      setLoading(false)
      return
    }

    router.push('/opportunities')
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="חיפוש..." disabled />
        </div>
      </div>

      <div className="page-body">
        <div className="page-header">
          <div>
            <div className="breadcrumb">
              <Link href="/dashboard">לוח בקרה</Link>
              <span className="breadcrumb-sep">/</span>
              <Link href="/opportunities">הזדמנויות</Link>
              <span className="breadcrumb-sep">/</span>
              <span>הזדמנות חדשה</span>
            </div>
            <h1 className="page-title">פתיחת הזדמנות חדשה</h1>
            <p className="page-subtitle">הזן את פרטי העסקה והלקוח הרלוונטי</p>
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
                    <select
                      className="form-select"
                      value={form.contact_id}
                      onChange={e => set('contact_id', e.target.value)}
                      style={{ marginTop: 4 }}
                    >
                      <option value="">— בחר איש קשר —</option>
                      {contacts.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
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
                    <select
                      className="form-select"
                      value={form.organization_id}
                      onChange={e => set('organization_id', e.target.value)}
                      style={{ marginTop: 4 }}
                    >
                      <option value="">— לקוח פרטי / בחר ארגון —</option>
                      {organizations.map(org => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))}
                    </select>
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
              <Link href="/opportunities" className="btn btn-secondary">
                ביטול
              </Link>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <span className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} />
                ) : 'צור הזדמנות'}
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
    </>
  )
}

export default function NewOpportunityPage() {
  return (
    <Suspense fallback={<div style={{ padding: 100, textAlign: 'center' }}><span className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--pink)' }} /></div>}>
      <NewOpportunityForm />
    </Suspense>
  )
}
