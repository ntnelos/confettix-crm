'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Lead {
  id: string
  source: 'whatsapp' | 'website'
  sender_name: string | null
  sender_phone: string | null
  sender_email: string | null
  company_name: string | null
  message: string | null
  gift_type: string | null
  estimated_quantity: number | null
  status: 'new' | 'converted' | 'trash'
  is_existing_customer: boolean
  matched_contact_id: string | null
  created_at: string
}

export default function LeadsPage() {
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  
  // Convert Modal State
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null)
  const [convertingLoader, setConvertingLoader] = useState(false)
  const [convertData, setConvertData] = useState({ name: '', phone: '', email: '', company: '' })

  const openConvertModal = (lead: Lead) => {
    setConvertingLead(lead)
    setConvertData({
      name: lead.sender_name || '',
      phone: lead.sender_phone || '',
      email: lead.sender_email || '',
      company: lead.company_name || ''
    })
  }

  const handleConvertSubmit = async () => {
    if (!convertingLead) return
    setConvertingLoader(true)

    // 1. Create Organization (if provided)
    let orgId = null
    if (convertData.company) {
      const { data: orgData, error: orgError } = await (supabase.from('organizations') as any)
        .insert({ name: convertData.company })
        .select()
        .single()
      if (orgError) {
        alert(`שגיאה ביצירת ארגון: ${orgError.message}`)
        setConvertingLoader(false)
        return
      }
      if (orgData) orgId = orgData.id
    }

    // 2. Create Contact
    const { data: contactData, error: contactError } = await (supabase.from('contacts') as any)
      .insert({
        name: convertData.name || 'ללא שם',
        phone: convertData.phone || null,
        mobile: convertData.phone || null,
        email: convertData.email || null,
        organization_id: orgId
      })
      .select()
      .single()

    if (contactError) {
      alert(`שגיאה ביצירת איש קשר: ${contactError.message}`)
      setConvertingLoader(false)
      return
    }

    // 3. Update Lead status
    const { error: leadError } = await (supabase.from('leads') as any)
      .update({ status: 'converted', matched_contact_id: contactData.id })
      .eq('id', convertingLead.id)

    if (leadError) {
      alert(`שגיאה בעדכון ליד: ${leadError.message}`)
    } else {
      setLeads(prev => prev.filter(l => l.id !== convertingLead.id))
      setConvertingLead(null)
    }

    setConvertingLoader(false)
  }

  const fetchLeads = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'new')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setLeads(data as Lead[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchLeads()
  }, [])

  const handleDelete = async (id: string) => {
    const { error } = await (supabase.from('leads') as any).delete().eq('id', id)
    if (error) {
      console.error('Delete error:', error)
      alert(`שגיאה במחיקה: ${error.message}`)
    } else {
      setLeads(prev => prev.filter(l => l.id !== id))
      setDeleteConfirm(null)
    }
  }

  const handleCreateOpportunity = async (id: string) => {
    // מסמנים את הליד כ-converted ומסירים מהרשימה
    // (בשלב הבא יחובר ליצירת הזדמנות אמיתית)
    const { error } = await (supabase.from('leads') as any)
      .update({ status: 'converted' })
      .eq('id', id)
    if (!error) {
      setLeads(prev => prev.filter(l => l.id !== id))
    }
  }

  const filteredLeads = leads.filter(lead => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      lead.sender_name?.toLowerCase().includes(q) ||
      lead.company_name?.toLowerCase().includes(q) ||
      lead.message?.toLowerCase().includes(q) ||
      lead.sender_phone?.includes(q) ||
      lead.sender_email?.toLowerCase().includes(q)
    )
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    if (diffHours < 1) return 'לפני דקות'
    if (diffHours < 24) {
      return `היום, ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
    }
    if (diffDays < 2) return 'אתמול'
    if (diffDays < 7) return `לפני ${Math.floor(diffDays)} ימים`
    return date.toLocaleDateString('he-IL')
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-search">
          <SearchIcon />
          <input type="text" placeholder="חיפוש לידים, ארגונים, אנשי קשר..." />
        </div>
        <div className="topbar-actions">
          <button className="topbar-icon-btn">
            <BellIcon />
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="page-header">
          <div>
            <div className="breadcrumb">
              <Link href="/dashboard">לוח בקרה</Link>
              <span className="breadcrumb-sep">/</span>
              <span>לידים</span>
            </div>
            <h1 className="page-title">תיבת לידים נכנסים</h1>
            <p className="page-subtitle">פניות חדשות מהאתר ו-WhatsApp</p>
          </div>

          <div className="actions-row">
            <Link href="/leads/new" className="btn btn-primary">
              <PlusIcon />
              ליד חדש
            </Link>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <span className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : filteredLeads.length === 0 && !search ? (
          /* Empty State */
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>☕</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>כל הלידים טופלו! זמן לקפה?</h2>
            <p className="text-muted" style={{ fontSize: 14 }}>אין פניות חדשות ממתינות</p>
          </div>
        ) : (
          <div className="table-container">
            <div className="table-toolbar">
              <div className="search-field">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="חיפוש שם, חברה, הודעה..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="text-muted">
                {filteredLeads.length === 0
                  ? 'לא נמצאו תוצאות'
                  : `סה"כ ${filteredLeads.length} לידים`}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>מקור</th>
                  <th>שם השולח</th>
                  <th>חברה</th>
                  <th>תקציר הודעה</th>
                  <th>סוג מתנה / כמות</th>
                  <th>תאריך</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => (
                  <tr
                    key={lead.id}
                    style={lead.is_existing_customer ? { background: 'var(--pink-lighter)' } : undefined}
                  >
                    <td>
                      {lead.source === 'whatsapp' ? (
                        <span title="WhatsApp" style={{ color: '#25D366', fontSize: 20 }}>
                          <WhatsAppIcon />
                        </span>
                      ) : (
                        <span title="אתר" style={{ color: 'var(--text-muted)', fontSize: 18 }}>
                          <GlobeIcon />
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="font-bold" style={{ fontSize: 13 }}>{lead.sender_name || '—'}</div>
                      {lead.sender_phone && (
                        <div className="td-muted" style={{ direction: 'ltr', textAlign: 'right' }}>
                          {lead.sender_phone}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{lead.company_name || '—'}</div>
                      {lead.is_existing_customer && (
                        <span className="badge badge-pink" style={{ marginTop: 4, display: 'inline-block' }}>
                          לקוח קיים
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="truncate" style={{ maxWidth: 220, fontSize: 13, color: 'var(--text-secondary)' }}>
                        {lead.message || '—'}
                      </div>
                    </td>
                    <td>
                      {lead.gift_type && (
                        <div style={{ fontSize: 13 }}>{lead.gift_type}</div>
                      )}
                      {lead.estimated_quantity && (
                        <span className="badge badge-pink" style={{ fontWeight: 700 }}>
                          {lead.estimated_quantity}
                        </span>
                      )}
                      {!lead.gift_type && !lead.estimated_quantity && '—'}
                    </td>
                    <td>
                      <span className="td-muted">{formatDate(lead.created_at)}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

                        {/* ── תמיד: פח מחיקה ── */}
                        {deleteConfirm === lead.id ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(lead.id)}
                              style={{ fontSize: 11, padding: '3px 8px' }}
                            >
                              אישור
                            </button>
                            <button
                              className="btn-icon"
                              onClick={() => setDeleteConfirm(null)}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn-icon"
                            title="לא רלוונטי — מחיקה"
                            style={{ color: '#cc1a1a' }}
                            onClick={() => setDeleteConfirm(lead.id)}
                          >
                            <TrashIcon />
                          </button>
                        )}

                        {/* ── לקוח חדש בלבד: המרה לאיש קשר ── */}
                        {!lead.is_existing_customer && (
                          <button
                            className="btn-icon"
                            title="המרה לאיש קשר"
                            style={{ color: '#1a6fcc' }}
                            onClick={() => openConvertModal(lead)}
                          >
                            <UserPlusIcon />
                          </button>
                        )}

                        {/* ── תמיד: יצירת הזדמנות ── */}
                        <button
                          className="btn-icon"
                          title="יצירת הזדמנות"
                          style={{ color: 'var(--pink)' }}
                          onClick={() => handleCreateOpportunity(lead.id)}
                        >
                          <PlusCircleIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="table-pagination">
              <div className="pagination-info">
                מציג {filteredLeads.length} מתוך {leads.length} לידים
              </div>
            </div>
          </div>
        )}

        {/* ===================== Convert Modal ===================== */}
        {convertingLead && (
          <div className="modal-overlay" onClick={() => setConvertingLead(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">המרה לאיש קשר וארגון</h3>
                <button className="btn-ghost" onClick={() => setConvertingLead(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>שם איש קשר</label>
                  <input
                    type="text"
                    className="form-input"
                    value={convertData.name}
                    onChange={e => setConvertData({ ...convertData, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>מספר טלפון</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ direction: 'ltr' }}
                    value={convertData.phone}
                    onChange={e => setConvertData({ ...convertData, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>כתובת אימייל</label>
                  <input
                    type="email"
                    className="form-input"
                    style={{ direction: 'ltr' }}
                    value={convertData.email}
                    onChange={e => setConvertData({ ...convertData, email: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label>שם חברה / ארגון חדש</label>
                  <input
                    type="text"
                    className="form-input"
                    value={convertData.company}
                    onChange={e => setConvertData({ ...convertData, company: e.target.value })}
                  />
                  <small className="text-muted" style={{ display: 'block', marginTop: 4 }}>
                    יווצר ארגון חדש במערכת שישויך לאיש הקשר.
                  </small>
                </div>
              </div>
              <div className="modal-footer" style={{ flexDirection: 'row-reverse' }}>
                <button 
                  className="btn btn-primary" 
                  disabled={convertingLoader}
                  onClick={handleConvertSubmit}
                >
                  {convertingLoader ? <span className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> : 'שמור והמר'}
                </button>
                <button 
                  className="btn btn-ghost" 
                  onClick={() => setConvertingLead(null)}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/* ──────────── SVG Icons ──────────── */
function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}
function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  )
}
function UserPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  )
}
function PlusCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}
