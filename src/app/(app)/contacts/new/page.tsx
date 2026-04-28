'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function NewContactPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [organizations, setOrganizations] = useState<{id: string, name: string}[]>([])
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    phone: '',
    organization_id: '',
    notes: '',
  })
  
  const [showOrgSearchModal, setShowOrgSearchModal] = useState(false)
  const [orgSearchQuery, setOrgSearchQuery] = useState('')
  const [isSearchingOrgs, setIsSearchingOrgs] = useState(false)
  const [selectedOrgName, setSelectedOrgName] = useState('')
  const [newOrgName, setNewOrgName] = useState('')

  // Debounced search for organizations
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!showOrgSearchModal) return
      
      setIsSearchingOrgs(true)
      const query = supabase.from('organizations').select('id, name')
      
      if (orgSearchQuery.trim()) {
        query.ilike('name', `%${orgSearchQuery.trim()}%`)
      }
      
      const { data } = await query.order('name').limit(20)
      if (data) setOrganizations(data)
      setIsSearchingOrgs(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [orgSearchQuery, showOrgSearchModal, supabase])

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleCreateOrg = async () => {
    if (!orgSearchQuery.trim()) return
    const { data, error } = await (supabase.from('organizations') as any).insert({ name: orgSearchQuery.trim() }).select().single()
    if (data) {
      setForm(prev => ({ ...prev, organization_id: data.id }))
      setSelectedOrgName(data.name)
      setShowOrgSearchModal(false)
      setOrgSearchQuery('')
    } else if (error) {
      alert(`שגיאה ביצירת ארגון: ${error.message}`)
    }
  }

  const handleSelectOrg = (id: string, name: string) => {
    setForm(prev => ({ ...prev, organization_id: id }))
    setSelectedOrgName(name)
    setShowOrgSearchModal(false)
    setOrgSearchQuery('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('שם איש קשר הוא שדה חובה')
      return
    }
    setLoading(true)
    setError('')

    const { error: sbError } = await (supabase.from('contacts') as any).insert({
      name: form.name.trim(),
      email: form.email.trim() || null,
      mobile: form.mobile.trim() || null,
      phone: form.phone.trim() || null,
      organization_id: form.organization_id || null,
      notes: form.notes || null,
    })

    if (sbError) {
      setError(sbError.message)
      setLoading(false)
      return
    }

    router.push('/contacts')
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
              <Link href="/contacts">אנשי קשר</Link>
              <span className="breadcrumb-sep">/</span>
              <span>איש קשר חדש</span>
            </div>
            <h1 className="page-title">הוספת איש קשר חדש</h1>
            <p className="page-subtitle">מלא את פרטי איש הקשר ושיוך לארגון אם קיים</p>
          </div>
        </div>

        <div className="card" style={{ maxWidth: 700 }}>
          <form onSubmit={handleSubmit}>
            {error && <div className="error-box">{error}</div>}

            <div className="form-group">
              <label>שם מלא <span style={{ color: 'var(--pink)' }}>*</span></label>
              <input
                className="form-input"
                type="text"
                placeholder="לדוגמה: דגנית כהן"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>דואר אלקטרוני</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  style={{ direction: 'ltr', textAlign: 'right' }}
                />
              </div>
              <div className="form-group">
                <label>טלפון נייד</label>
                <input
                  className="form-input"
                  type="tel"
                  placeholder="05X-XXXXXXX"
                  value={form.mobile}
                  onChange={e => set('mobile', e.target.value)}
                  style={{ direction: 'ltr', textAlign: 'right' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>שיוך לארגון (אופציונלי)</label>
                {form.organization_id ? (
                  <div style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                    padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <BuildingIcon />
                      <span style={{ fontWeight: 600 }}>{selectedOrgName}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => { setForm(prev => ({ ...prev, organization_id: '' })); setSelectedOrgName('') }}
                      style={{ background: 'none', border: 'none', color: 'var(--pink)', cursor: 'pointer', padding: 4 }}
                    >
                      ביטול שיוך
                    </button>
                  </div>
                ) : (
                  <button 
                    type="button"
                    onClick={() => setShowOrgSearchModal(true)}
                    style={{ 
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10, 
                      padding: '10px 14px', background: 'white', borderRadius: 8, border: '1px dashed var(--border-strong)',
                      color: 'var(--text-muted)', cursor: 'pointer', textAlign: 'right'
                    }}
                  >
                    <PlusIcon /> לחץ לחיפוש ושיוך ארגון
                  </button>
                )}
              </div>
              <div className="form-group">
                <label>טלפון קווי עבודה / אחר</label>
                <input
                  className="form-input"
                  type="tel"
                  placeholder="0X-XXXXXXX"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  style={{ direction: 'ltr', textAlign: 'right' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>הערות</label>
              <textarea
                className="form-textarea"
                placeholder="מידע נוסף על איש הקשר..."
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={3}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <Link href="/contacts" className="btn btn-secondary">
                ביטול
              </Link>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <span className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} />
                ) : 'שמור איש קשר'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showOrgSearchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: 24, minWidth: 400, maxWidth: '90%', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>חיפוש או שיוך לארגון</h3>
              <button className="btn-icon" onClick={() => setShowOrgSearchModal(false)}>
                <XIcon />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <input 
                autoFocus
                className="form-input" 
                value={orgSearchQuery} 
                onChange={e => setOrgSearchQuery(e.target.value)} 
                placeholder="הקלד שם ארגון לחיפוש..." 
              />

              {orgSearchQuery.trim() && !organizations.some(o => o.name === orgSearchQuery.trim()) && (
                <button 
                  onClick={handleCreateOrg}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: 'rgba(230,0,126,0.1)', 
                    border: '1px dashed var(--pink)', color: 'var(--pink)', borderRadius: 8, cursor: 'pointer', fontWeight: 600
                  }}
                >
                  <PlusIcon /> יצירת ארגון חדש בשם: &quot;{orgSearchQuery}&quot;
                </button>
              )}

              <div style={{ maxHeight: 250, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, minHeight: 100 }}>
                {isSearchingOrgs ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                    <span className="spinner" style={{ width: 24, height: 24, borderTopColor: 'var(--pink)' }} />
                  </div>
                ) : organizations.length > 0 ? organizations.map(org => (
                  <div 
                    key={org.id} 
                    onClick={() => handleSelectOrg(org.id, org.name)}
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
    </>
  )
}

function BuildingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
      <path d="M9 22v-4h6v4"></path>
    </svg>
  )
}

function PlusIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}

function XIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
}
