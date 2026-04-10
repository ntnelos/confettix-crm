'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Organization {
  id: string
  name: string
  industry: string | null
  employee_count: number | null
  website: string | null
  company_number: string | null
  general_info: string | null
  created_at: string
  contact_count?: number
}

export default function OrganizationsPage() {
  const supabase = createClient()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchOrgs = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('organizations')
      .select('*, contacts(count)')
      .order('created_at', { ascending: false })

    if (!error && data) {
      const mapped = data.map((o: Organization & { contacts: { count: number }[] }) => ({
        ...o,
        contact_count: o.contacts?.[0]?.count ?? 0,
      }))
      setOrgs(mapped)
    }
    setLoading(false)
  }

  useEffect(() => { fetchOrgs() }, [])

  const filtered = orgs.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      o.name?.toLowerCase().includes(q) ||
      o.industry?.toLowerCase().includes(q) ||
      o.company_number?.includes(q)
    )
  })

  const handleDeleteOrg = async (id: string, name: string) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את הארגון "${name}" לצמיתות?`)) return
    
    const { error } = await supabase.from('organizations').delete().eq('id', id)
    if (!error) {
      setOrgs(prev => prev.filter(o => o.id !== id))
    } else {
      alert(`שגיאה במחיקת הארגון: ${error.message}`)
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-search">
          <SearchIcon />
          <input type="text" placeholder="חיפוש בארגונים..." />
        </div>
        <div className="topbar-actions">
          <button className="topbar-icon-btn"><BellIcon /></button>
        </div>
      </div>

      <div className="page-body">
        <div className="page-header">
          <div>
            <div className="breadcrumb">
              <Link href="/dashboard">לוח בקרה</Link>
              <span className="breadcrumb-sep">/</span>
              <span>ארגונים</span>
            </div>
            <h1 className="page-title">ארגונים וחברות</h1>
            <p className="page-subtitle">ניהול כל תיקי הלקוחות והחברות במערכת</p>
          </div>
          <div className="actions-row">
            <Link href="/organizations/new" className="btn btn-primary">
              <PlusIcon />
              הוסף ארגון
            </Link>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <span className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : orgs.length === 0 && !search ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.4 }}>🏢</div>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
              אין ארגונים עדיין
            </h2>
            <p className="text-muted" style={{ marginBottom: 20 }}>הוסף את הארגון הראשון כדי להתחיל</p>
            <Link href="/organizations/new" className="btn btn-primary">הוסף ארגון</Link>
          </div>
        ) : (
          <div className="table-container">
            <div className="table-toolbar">
              <div className="search-field">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="חיפוש שם ארגון, תעשייה, עיר..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="text-muted">
                {filtered.length === 0 ? 'לא נמצאו תוצאות' : `סה"כ ${filtered.length} ארגונים`}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>שם ארגון</th>
                  <th>תעשייה</th>
                  <th>עובדים</th>
                  <th>ח.פ / ע.מ</th>
                  <th>אנשי קשר</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                      לא נמצאו תוצאות עבור &quot;{search}&quot;
                    </td>
                  </tr>
                ) : (
                  filtered.map(org => (
                    <tr key={org.id}>
                      <td>
                        <Link
                          href={`/organizations/${org.id}`}
                          className="font-bold text-pink"
                          style={{ fontSize: 13, textDecoration: 'none' }}
                        >
                          {org.name}
                        </Link>
                        {org.general_info && (
                          <div className="td-muted truncate" style={{ maxWidth: 200 }}>{org.general_info}</div>
                        )}
                      </td>
                      <td>
                        {org.industry
                          ? <span className="badge badge-gray">{org.industry}</span>
                          : <span className="td-muted">—</span>}
                      </td>
                      <td>
                        {org.employee_count
                          ? <span className="badge badge-gray">{org.employee_count.toLocaleString()}+</span>
                          : <span className="td-muted">—</span>}
                      </td>
                      <td>
                        <span style={{ fontSize: 13, direction: 'ltr', display: 'inline-block' }}>
                          {org.company_number || '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 13 }}>{org.contact_count ?? 0}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <Link href={`/organizations/${org.id}`} className="btn-icon" title="צפה בפרטים">
                            <EyeIcon />
                          </Link>
                          <button onClick={() => handleDeleteOrg(org.id, org.name)} className="btn-icon" title="מחק" style={{ color: 'var(--pink)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="table-pagination">
              <div className="pagination-info">
                מציג {filtered.length} מתוך {orgs.length} ארגונים
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/* ──────────── Icons ──────────── */
function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
}
function BellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
}
function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}
function EyeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
}
function EditIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
}
