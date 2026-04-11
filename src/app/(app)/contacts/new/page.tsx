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
  
  const [showOrgModal, setShowOrgModal] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')

  useEffect(() => {
    async function loadOrgs() {
      const { data } = await supabase.from('organizations').select('id, name').order('name')
      if (data) setOrganizations(data)
    }
    loadOrgs()
  }, [supabase])

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return
    const { data, error } = await (supabase.from('organizations') as any).insert({ name: newOrgName.trim() }).select().single()
    if (data) {
      setOrganizations(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(prev => ({ ...prev, organization_id: data.id }))
      setShowOrgModal(false)
      setNewOrgName('')
    } else if (error) {
      alert(`שגיאה ביצירת ארגון: ${error.message}`)
    }
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
        <div className="topbar-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="חיפוש..." disabled />
        </div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ margin: 0 }}>שיוך לארגון (אופציונלי)</label>
                  <button 
                    type="button" 
                    onClick={() => setShowOrgModal(true)}
                    style={{ background: 'none', border: 'none', color: 'var(--pink)', fontSize: 12, cursor: 'pointer', fontWeight: 600, padding: 0 }}
                  >
                    + הוסף ארגון חדש
                  </button>
                </div>
                <select
                  className="form-select"
                  value={form.organization_id}
                  onChange={e => set('organization_id', e.target.value)}
                >
                  <option value="">— ללא שיוך —</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
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

      {showOrgModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: 24, minWidth: 400, maxWidth: '90%', background: 'var(--surface)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>יצירת ארגון חדש</h3>
            <div className="form-group">
              <label>שם מלא של הארגון/חברה <span style={{ color: 'var(--pink)' }}>*</span></label>
              <input 
                autoFocus
                className="form-input" 
                value={newOrgName} 
                onChange={e => setNewOrgName(e.target.value)} 
                placeholder="למשל: סיילספורס ישראל" 
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreateOrg()
                  }
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
    </>
  )
}
