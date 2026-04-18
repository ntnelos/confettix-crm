'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Contact {
  id: string
  name: string
  email: string | null
  mobile: string | null
  phone: string | null
  unsubscribed: boolean
  morning_id: string | null
  fireberry_account_number: string | null
  notes: string | null
  created_at: string
  organization_id: string | null
  organizations?: { name: string } | null
}

export default function ContactsPage() {
  const supabase = createClient()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchContacts = async () => {
    setLoading(true)
    let allData: Contact[] = []
    let total = 0
    let from = 0
    const step = 1000

    while (true) {
      const { data, error, count } = await supabase
        .from('contacts')
        .select('*, organizations(name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + step - 1)

      if (error) {
        console.error('Error fetching contacts:', error)
        break
      }

      if (count !== null && total === 0) {
        total = count
        setTotalCount(count)
      }

      if (data && data.length > 0) {
        allData = [...allData, ...(data as Contact[])]
        from += data.length
        if (data.length < step) break // Reached the end
      } else {
        break
      }
    }

    // Deduplicate by ID just to be absolutely safe against React warnings
    const uniqueMap = new Map<string, Contact>()
    allData.forEach(c => {
      if (!uniqueMap.has(c.id)) {
        uniqueMap.set(c.id, c)
      }
    })
    
    setContacts(Array.from(uniqueMap.values()))
    setLoading(false)
  }

  useEffect(() => { fetchContacts() }, [])

  const filtered = contacts.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    const name = (c.name || '').toLowerCase()
    const email = (c.email || '').toLowerCase()
    const mobile = (c.mobile || '').toLowerCase()
    const phone = (c.phone || '').toLowerCase()
    const orgName = ((c.organizations as any)?.name || '').toLowerCase()
    const notes = (c.notes || '').toLowerCase()

    return (
      name.includes(q) ||
      email.includes(q) ||
      mobile.includes(q) ||
      phone.includes(q) ||
      orgName.includes(q) ||
      notes.includes(q)
    )
  })

  const handleDeleteContact = async (id: string, name: string) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את איש הקשר "${name}" לצמיתות?`)) return

    const { error } = await (supabase.from('contacts') as any).delete().eq('id', id)
    if (!error) {
      setContacts(prev => prev.filter(c => c.id !== id))
    } else {
      alert(`שגיאה במחיקת איש קשר: ${error.message}`)
    }
  }

  return (
    <>
      <div className="topbar">
        <div style={{ flex: 1 }} />
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
              <span>אנשי קשר</span>
            </div>
            <h1 className="page-title">אנשי קשר</h1>
            <p className="page-subtitle">ניהול כל אנשי הקשר של הארגונים במערכת </p>
          </div>
          <div className="actions-row">
            <Link href="/contacts/new" className="btn btn-primary">
              <PlusIcon />
              איש קשר חדש
            </Link>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <span className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : contacts.length === 0 && !search ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.4 }}>👥</div>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
              אין אנשי קשר עדיין
            </h2>
            <p className="text-muted" style={{ marginBottom: 20 }}>הוסף את איש הקשר הראשון כדי להתחיל</p>
            <Link href="/contacts/new" className="btn btn-primary">הוסף איש קשר</Link>
          </div>
        ) : (
          <div className="table-container">
            <div className="table-toolbar">
              <div className="search-field">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="חיפוש שם, מייל, טלפון, ארגון..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="text-muted">
                {search
                  ? `${filtered.length} תוצאות מתוך ${totalCount} אנשי קשר`
                  : `סה"כ ${totalCount} אנשי קשר`
                }
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>שם</th>
                  <th>ארגון</th>
                  <th>אימייל</th>
                  <th>נייד</th>
                  <th>טלפון</th>
                  <th>דיוור</th>
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
                  filtered.map(contact => (
                    <tr key={contact.id}>
                      <td>
                        <Link
                          href={`/contacts/${contact.id}`}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', justifyContent: 'flex-end', flexDirection: 'row-reverse' }}
                        >
                          <div>
                            <div className="font-bold text-pink" style={{ fontSize: 13, textAlign: 'right' }}>{contact.name}</div>
                          </div>
                          <div className="contact-avatar">
                            {(contact.name || '?').charAt(0)}
                          </div>
                        </Link>
                      </td>
                      <td>
                        {contact.organization_id && (contact.organizations as any)?.name ? (
                          <Link 
                            href={`/organizations/${contact.organization_id}`} 
                            className="badge badge-gray" 
                            style={{ 
                              cursor: 'pointer', 
                              transition: 'all 0.2s',
                              textDecoration: 'none'
                            }}
                            onMouseOver={e => e.currentTarget.style.background = 'var(--surface-3)'}
                            onMouseOut={e => e.currentTarget.style.background = 'var(--surface-2)'}
                          >
                            {(contact.organizations as any).name}
                          </Link>
                        ) : (
                          <span className="td-muted">—</span>
                        )}
                      </td>
                      <td>
                        {contact.email ? (
                          <a href={`mailto:${contact.email}`} className="td-link" style={{ direction: 'ltr', display: 'inline-block' }}>
                            {contact.email}
                          </a>
                        ) : <span className="td-muted">—</span>}
                      </td>
                      <td>
                        {contact.mobile ? (
                          <span style={{ direction: 'ltr', display: 'inline-block', fontSize: 13 }}>{contact.mobile}</span>
                        ) : <span className="td-muted">—</span>}
                      </td>
                      <td>
                        {contact.phone ? (
                          <span style={{ direction: 'ltr', display: 'inline-block', fontSize: 13 }}>{contact.phone}</span>
                        ) : <span className="td-muted">—</span>}
                      </td>
                      <td>
                        {contact.unsubscribed ? (
                          <span className="badge badge-lost" style={{ fontSize: 11 }}>ביטל דיוור</span>
                        ) : (
                          <span className="badge badge-won" style={{ fontSize: 11 }}>פעיל</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-start' }}>
                          <Link href={`/contacts/${contact.id}`} className="btn-icon" title="צפה בפרטים">
                            <EyeIcon />
                          </Link>
                          <button onClick={() => handleDeleteContact(contact.id, contact.name)} className="btn-icon" title="מחק" style={{ color: 'var(--pink)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="table-pagination">
              <div className="text-muted" style={{ fontSize: 13 }}>
                {search
                  ? `${filtered.length} תוצאות מתוך ${totalCount} אנשי קשר`
                  : `סה"כ ${totalCount} אנשי קשר`
                }
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
