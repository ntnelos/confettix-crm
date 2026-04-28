'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

/* ─── Types ─── */
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
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  rejection_reason_id: string | null
  rejection_note: string | null
  raw_payload: any
  created_at: string
  lead_messages?: LeadMessage[]
}

interface LeadMessage {
  id: string
  lead_id: string
  source: string
  content: string | null
  created_at: string
}

interface MatchedContact {
  id: string
  name: string
  organizations?: { id: string; name: string } | null
}

interface RejectionReason {
  id: string
  label: string
  sort_order: number
}

/* ─── Component ─── */
export default function LeadsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [leads, setLeads] = useState<Lead[]>([])
  const [handledLeads, setHandledLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'new' | 'handled'>('new')

  // Lead detail modal
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [leadMessages, setLeadMessages] = useState<LeadMessage[]>([])
  const [matchedContact, setMatchedContact] = useState<MatchedContact | null>(null)
  const [loadingModal, setLoadingModal] = useState(false)

  // Rejection modal
  const [rejectingLead, setRejectingLead] = useState<Lead | null>(null)
  const [rejectionReasons, setRejectionReasons] = useState<RejectionReason[]>([])
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [rejectingLoader, setRejectingLoader] = useState(false)

  // Convert modal
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null)
  const [convertingLoader, setConvertingLoader] = useState(false)
  const [convertData, setConvertData] = useState({ name: '', phone: '', email: '', company: '' })
  // For converting existing-customer leads: assign to existing OR new contact
  // For converting existing-customer leads: assign to existing OR new contact
  const [convertMode, setConvertMode] = useState<'existing' | 'new'>('existing')

  // Notes state
  const [quickNoteLead, setQuickNoteLead] = useState<Lead | null>(null)
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editNoteText, setEditNoteText] = useState('')

  /* ─── Data fetching ─── */
  const fetchLeads = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('leads').select('*, lead_messages(id, content, created_at, source)').eq('status', 'new').order('created_at', { ascending: false })
    if (data) setLeads(data as Lead[])
    setLoading(false)
  }, [supabase])

  const fetchHandledLeads = useCallback(async () => {
    const { data } = await (supabase
      .from('leads')
      .select('*, contacts:matched_contact_id(id, name, organization_id, organizations(id, name)), rejection_reason:rejection_reason_id(label), lead_messages(id, content, created_at, source)')
      .in('status', ['converted', 'trash'])
      .order('created_at', { ascending: false })
      .limit(200) as any)
    if (data) setHandledLeads(data as any[])
  }, [supabase])

  const fetchRejectionReasons = useCallback(async () => {
    const { data } = await (supabase.from('lead_rejection_reasons').select('*').order('sort_order') as any)
    if (data) setRejectionReasons(data)
  }, [supabase])

  useEffect(() => {
    fetchLeads()
    fetchHandledLeads()
    fetchRejectionReasons()
  }, [fetchLeads, fetchHandledLeads, fetchRejectionReasons])

  /* ─── Open lead detail ─── */
  const openLeadDetail = async (lead: Lead) => {
    setSelectedLead(lead)
    setLeadMessages([])
    setMatchedContact(null)
    setLoadingModal(true)

    const [messagesRes, contactRes] = await Promise.all([
      // Fetch conversation thread
      (supabase.from('lead_messages').select('*').eq('lead_id', lead.id).order('created_at') as any),
      // Fetch matched contact (if any)
      lead.matched_contact_id
        ? (supabase.from('contacts').select('id, name, organizations(id, name)').eq('id', lead.matched_contact_id).single() as any)
        : Promise.resolve({ data: null }),
    ])

    if (messagesRes.data) setLeadMessages(messagesRes.data)
    if (contactRes.data) setMatchedContact(contactRes.data)
    setLoadingModal(false)
  }

  /* ─── Rejection flow ─── */
  const openRejectModal = (lead: Lead) => {
    setSelectedLead(null)
    setRejectingLead(lead)
    setSelectedReason('')
  }

  const handleConfirmReject = async () => {
    if (!rejectingLead || !selectedReason) return
    setRejectingLoader(true)

    await (supabase.from('leads') as any).update({
      status: 'trash',
      rejection_reason_id: selectedReason,
    }).eq('id', rejectingLead.id)

    setLeads(prev => prev.filter(l => l.id !== rejectingLead.id))
    await fetchHandledLeads()
    setRejectingLead(null)
    setRejectingLoader(false)
  }

  /* ─── Convert: new contact ─── */
  const openConvertModal = (lead: Lead) => {
    setSelectedLead(null)
    setConvertingLead(lead)
    setConvertMode(lead.matched_contact_id ? 'existing' : 'new')
    setConvertData({
      name: lead.sender_name || '',
      phone: lead.sender_phone || '',
      email: lead.sender_email || '',
      company: lead.company_name || '',
    })
  }

  const migrateLeadMessagesToInquiries = async (leadId: string, contactId: string, source: string) => {
    // Fetch all lead_messages for this lead
    const { data: msgs } = await (supabase.from('lead_messages').select('*').eq('lead_id', leadId).order('created_at') as any)
    if (!msgs || msgs.length === 0) return

    // Insert each as a contact_inquiry (preserving original timestamps)
    const inquiries = msgs.map((m: any) => ({
      contact_id: contactId,
      source: m.source,
      message: m.content,
      lead_id: leadId,
      created_at: m.created_at,
    }))
    await (supabase.from('contact_inquiries') as any).insert(inquiries)

    // Delete from lead_messages to avoid duplication
    await (supabase.from('lead_messages') as any).delete().eq('lead_id', leadId)
  }

  const handleConvertToExistingContact = async () => {
    if (!convertingLead?.matched_contact_id) return
    setConvertingLoader(true)
    const contactId = convertingLead.matched_contact_id

    await migrateLeadMessagesToInquiries(convertingLead.id, contactId, convertingLead.source)
    await (supabase.from('leads') as any).update({ status: 'converted' }).eq('id', convertingLead.id)

    setLeads(prev => prev.filter(l => l.id !== convertingLead.id))
    setConvertingLead(null)
    setConvertingLoader(false)
    router.push(`/contacts/${contactId}`)
  }

  const handleConvertToNewContact = async () => {
    if (!convertingLead) return
    setConvertingLoader(true)

    let orgId: string | null = null
    if (convertData.company) {
      const { data: orgData, error: orgErr } = await (supabase.from('organizations') as any)
        .insert({ name: convertData.company }).select().single()
      if (orgErr) { alert(`שגיאה ביצירת ארגון: ${orgErr.message}`); setConvertingLoader(false); return }
      if (orgData) orgId = orgData.id
    }

    const { data: contactData, error: contactErr } = await (supabase.from('contacts') as any)
      .insert({
        name: convertData.name || 'ללא שם',
        phone: convertData.phone || null,
        mobile: convertData.phone || null,
        email: convertData.email || null,
        organization_id: orgId,
      }).select().single()

    if (contactErr) { alert(`שגיאה ביצירת איש קשר: ${contactErr.message}`); setConvertingLoader(false); return }

    await migrateLeadMessagesToInquiries(convertingLead.id, contactData.id, convertingLead.source)
    await (supabase.from('leads') as any).update({
      status: 'converted',
      matched_contact_id: contactData.id,
    }).eq('id', convertingLead.id)

    setLeads(prev => prev.filter(l => l.id !== convertingLead.id))
    setConvertingLead(null)
    setConvertingLoader(false)
    router.push(`/contacts/${contactData.id}`)
  }

  /* ─── Existing-customer: add inquiry then go to contact ─── */
  const handleConfirmExistingLead = async (lead: Lead) => {
    if (!lead.matched_contact_id) return
    await migrateLeadMessagesToInquiries(lead.id, lead.matched_contact_id, lead.source)
    await (supabase.from('leads') as any).update({ status: 'converted' }).eq('id', lead.id)
    setLeads(prev => prev.filter(l => l.id !== lead.id))
    setSelectedLead(null)
    router.push(`/contacts/${lead.matched_contact_id}`)
  }

  /* ─── Filters ─── */
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

  /* ─── Helpers ─── */
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    const diffDays = diffHours / 24
    if (diffHours < 1) return 'לפני דקות'
    if (diffHours < 24) return `היום, ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
    if (diffDays < 2) return 'אתמול'
    if (diffDays < 7) return `לפני ${Math.floor(diffDays)} ימים`
    return date.toLocaleDateString('he-IL')
  }

  /* ─── Notes Implementation ─── */
  const handleSaveNote = async (leadId: string) => {
    if (!newNote.trim()) return
    setSavingNote(true)
    const payload = {
      lead_id: leadId,
      source: 'note',
      content: newNote.trim(),
    }
    const { data, error } = await (supabase.from('lead_messages') as any).insert(payload).select().single()
    if (data) {
       // Update modal messages if open
       if (selectedLead?.id === leadId) {
         setLeadMessages(prev => [...prev, data])
       }
       // Update table lead_messages
       const updateLeadMsgs = (list: Lead[]) => list.map(l => l.id === leadId ? { ...l, lead_messages: [...(l.lead_messages || []), data] } : l)
       setLeads(updateLeadMsgs)
       setHandledLeads(updateLeadMsgs)
       
       setNewNote('')
       setQuickNoteLead(null)
    } else if (error) {
       alert(`Error saving note: ${error.message}`)
    }
    setSavingNote(false)
  }

  const handleUpdateNote = async (msgId: string) => {
    if (!editNoteText.trim()) return
    const { error } = await (supabase.from('lead_messages') as any).update({ content: editNoteText.trim() }).eq('id', msgId)
    if (!error) {
       setLeadMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: editNoteText.trim() } : m))
       const updateLeadMsgs = (list: Lead[]) => list.map(l => ({ ...l, lead_messages: (l.lead_messages || []).map(m => m.id === msgId ? { ...m, content: editNoteText.trim() } : m) }))
       setLeads(updateLeadMsgs)
       setHandledLeads(updateLeadMsgs)
       setEditingNoteId(null)
    } else {
       alert(`Error updating: ${error.message}`)
    }
  }

  const sourceLabel = (s: string) => s === 'whatsapp' ? 'WhatsApp' : s === 'note' ? 'תיעוד' : 'אתר אינטרנט'

  /* ─── Render ─── */
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
              <span>לידים</span>
            </div>
            <h1 className="page-title">תיבת לידים נכנסים</h1>
            <p className="page-subtitle">פניות חדשות מהאתר ו-WhatsApp</p>
          </div>
          <div className="actions-row">
            {/* View Toggle */}
            <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 10, padding: 4, gap: 2 }}>
              {(['new', 'handled'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                  background: view === v ? 'white' : 'transparent',
                  color: view === v ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: view === v ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}>
                  {v === 'new' ? `🔴 ממתינים (${leads.length})` : `✅ טופלו (${handledLeads.length})`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <span className="spinner" style={{ width: 28, height: 28 }} />
          </div>

        ) : view === 'handled' ? (
          /* ─── HANDLED LEADS TABLE ─── */
          <div className="table-container">
            <div className="table-toolbar">
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>לידים שטופלו (הומרו / לא רלוונטיים)</div>
              <div className="text-muted">{handledLeads.length} לידים</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>מקור</th><th>שם</th><th>חברה</th><th>הודעה</th>
                  <th>תיעוד אחרון</th><th>סטטוס / סיבה</th><th>לקוח משוייך</th><th>תאריך</th>
                </tr>
              </thead>
              <tbody>
                {handledLeads.map((lead: any) => (
                  <tr key={lead.id} style={{ opacity: lead.status === 'trash' ? 0.65 : 1 }}>
                    <td>
                      {lead.source === 'whatsapp'
                        ? <span style={{ color: '#25D366' }}><WhatsAppIcon /></span>
                        : <span style={{ color: 'var(--text-muted)' }}><GlobeIcon /></span>}
                    </td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{lead.sender_name || '—'}</div>
                      {lead.sender_phone && <div style={{ fontSize: 11, color: 'var(--text-muted)', direction: 'ltr' }}>{lead.sender_phone}</div>}
                    </td>
                    <td style={{ fontSize: 13 }}>{lead.company_name || '—'}</td>
                    <td>
                      <div className="truncate" style={{ maxWidth: 200, fontSize: 12, color: 'var(--text-secondary)' }}>
                        {lead.message || '—'}
                      </div>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {(() => {
                        const notes = lead.lead_messages?.filter((m: any) => m.source === 'note').sort((a: any,b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || []
                        const lastNote = notes[0]?.content || '—'
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div className="truncate" style={{ maxWidth: 160, fontSize: 13, padding: notes[0] ? '4px 6px' : 0, background: notes[0] ? '#fef08a' : 'transparent', borderRadius: 4 }}>
                              {lastNote}
                            </div>
                            <button onClick={() => setQuickNoteLead(lead)} className="btn btn-sm" style={{ padding: '2px 8px', fontSize: 16, background: 'var(--surface)', border: '1px solid var(--border)' }} title="הוסף תיעוד">+</button>
                          </div>
                        )
                      })()}
                    </td>
                    <td>
                      {lead.status === 'converted'
                        ? <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>הומר</span>
                        : <div>
                          <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', display: 'block', marginBottom: 2 }}>לא רלוונטי</span>
                          {lead.rejection_reason?.label && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.rejection_reason.label}</span>
                          )}
                        </div>}
                    </td>
                    <td>
                      {lead.contacts
                        ? <Link href={`/contacts/${lead.contacts.id}`} style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          👤 {lead.contacts.name}
                          {lead.contacts.organizations && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {lead.contacts.organizations.name}</span>}
                        </Link>
                        : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td><span className="td-muted">{formatDate(lead.created_at)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        ) : filteredLeads.length === 0 && !search ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>☕</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>כל הלידים טופלו! זמן לקפה?</h2>
            <p className="text-muted" style={{ fontSize: 14 }}>אין פניות חדשות ממתינות</p>
          </div>

        ) : (
          /* ─── NEW LEADS TABLE ─── */
          <div className="table-container">
            <div className="table-toolbar">
              <div className="search-field">
                <SearchIcon />
                <input type="text" placeholder="חיפוש שם, חברה, הודעה..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="text-muted">
                {filteredLeads.length === 0 ? 'לא נמצאו תוצאות' : `סה"כ ${filteredLeads.length} לידים`}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>מקור</th><th>שם השולח</th><th>חברה</th>
                  <th>תקציר הודעה</th><th>תיעוד אחרון</th><th>סוג מתנה / כמות</th><th>תאריך</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => (
                  <tr
                    key={lead.id}
                    onClick={() => openLeadDetail(lead)}
                    style={{ cursor: 'pointer', background: lead.is_existing_customer ? 'var(--pink-lighter)' : undefined, transition: 'background 0.15s' }}
                    onMouseOver={e => (e.currentTarget.style.background = lead.is_existing_customer ? '#fce7f3' : '#f8fafc')}
                    onMouseOut={e => (e.currentTarget.style.background = lead.is_existing_customer ? 'var(--pink-lighter, #fdf2f8)' : '')}
                  >
                    <td>
                      {lead.source === 'whatsapp'
                        ? <span title="WhatsApp" style={{ color: '#25D366', fontSize: 20 }}><WhatsAppIcon /></span>
                        : <span title="אתר" style={{ color: 'var(--text-muted)', fontSize: 18 }}><GlobeIcon /></span>}
                    </td>
                    <td>
                      <div className="font-bold" style={{ fontSize: 13 }}>{lead.sender_name || '—'}</div>
                      {lead.sender_phone && <div className="td-muted" style={{ direction: 'ltr', textAlign: 'right' }}>{lead.sender_phone}</div>}
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{lead.company_name || '—'}</div>
                      {lead.is_existing_customer && <span className="badge badge-pink" style={{ marginTop: 4, display: 'inline-block' }}>לקוח קיים</span>}
                    </td>
                    <td>
                      <div className="truncate" style={{ maxWidth: 220, fontSize: 13, color: 'var(--text-secondary)' }}>
                        {lead.message || '—'}
                      </div>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {(() => {
                        const notes = lead.lead_messages?.filter((m: any) => m.source === 'note').sort((a: any,b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || []
                        const lastNote = notes[0]?.content || '—'
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div className="truncate" style={{ maxWidth: 160, fontSize: 13, padding: notes[0] ? '4px 6px' : 0, background: notes[0] ? '#fef08a' : 'transparent', borderRadius: 4 }}>
                              {lastNote}
                            </div>
                            <button onClick={() => setQuickNoteLead(lead)} className="btn btn-sm" style={{ padding: '2px 8px', fontSize: 16, background: 'var(--surface)', border: '1px solid var(--border)' }} title="הוסף תיעוד">+</button>
                          </div>
                        )
                      })()}
                    </td>
                    <td>
                      {lead.gift_type && <div style={{ fontSize: 13 }}>{lead.gift_type}</div>}
                      {lead.estimated_quantity && <span className="badge badge-pink" style={{ fontWeight: 700 }}>{lead.estimated_quantity}</span>}
                      {!lead.gift_type && !lead.estimated_quantity && '—'}
                    </td>
                    <td><span className="td-muted">{formatDate(lead.created_at)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="table-pagination">
              <div className="pagination-info">מציג {filteredLeads.length} מתוך {leads.length} לידים</div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════ LEAD DETAIL MODAL ═══════════ */}
      {selectedLead && (
        <div className="modal-overlay" onClick={() => setSelectedLead(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="modal" onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 22 }}>{selectedLead.source === 'whatsapp' ? '💬' : '🌐'}</span>
                  <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{selectedLead.sender_name || 'ליד ללא שם'}</h3>
                  {selectedLead.is_existing_customer && <span className="badge badge-pink">לקוח קיים</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {sourceLabel(selectedLead.source)} · {formatDate(selectedLead.created_at)}
                </div>
              </div>
              <button onClick={() => setSelectedLead(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', flex: 1 }}>

              {/* Existing customer block */}
              {selectedLead.is_existing_customer && (
                <div style={{ background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#7c3aed', marginBottom: 8 }}>👤 לקוח קיים במערכת</div>
                  {loadingModal ? (
                    <span className="spinner" style={{ width: 16, height: 16 }} />
                  ) : matchedContact ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{matchedContact.name}</div>
                        {matchedContact.organizations && (
                          <Link href={`/organizations/${matchedContact.organizations.id}`} style={{ fontSize: 12, color: '#3b82f6' }}>
                            🏢 {matchedContact.organizations.name}
                          </Link>
                        )}
                      </div>
                      <Link href={`/contacts/${matchedContact.id}`} style={{ fontSize: 12, padding: '6px 12px', background: '#7c3aed', color: 'white', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
                        צפה בכרטיס ←
                      </Link>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Contact details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {selectedLead.sender_phone && <DetailField label="טלפון" value={selectedLead.sender_phone} dir="ltr" />}
                {selectedLead.sender_email && <DetailField label="מייל" value={selectedLead.sender_email} dir="ltr" />}
                {selectedLead.company_name && <DetailField label="ארגון / חברה" value={selectedLead.company_name} />}
                {selectedLead.estimated_quantity && <DetailField label="כמות מארזים" value={String(selectedLead.estimated_quantity)} />}
                {selectedLead.gift_type && <DetailField label="מקור דף נחיתה" value={selectedLead.gift_type} />}
              </div>

              {/* Conversation Thread */}
              <div>
                {/* Note creation textarea */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <textarea 
                      placeholder="הוסף תיעוד פנימי (למשל: ביקש שאחזור אליו ביום חמישי)" 
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', minHeight: 60, fontFamily: 'inherit' }}
                    />
                    <button 
                      onClick={() => handleSaveNote(selectedLead.id)} 
                      disabled={savingNote || !newNote.trim()}
                      className="btn btn-primary"
                      style={{ padding: '0 16px', height: 42, alignSelf: 'flex-end', opacity: (!newNote.trim() || savingNote) ? 0.6 : 1 }}
                    >
                      {savingNote ? 'שומר...' : 'שמור'}
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  💬 תכתובות ותיעודים {leadMessages.length > 0 ? `(${leadMessages.length})` : ''}
                </div>
                {loadingModal ? (
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                ) : leadMessages.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>אין הודעות מתועדות</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {leadMessages.map((msg, i) => (
                      <div key={msg.id} style={{ display: 'flex', gap: 10, background: msg.source === 'note' ? '#fef08a' : 'transparent', padding: msg.source === 'note' ? '8px 12px' : 0, borderRadius: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: msg.source === 'whatsapp' ? '#dcfce7' : msg.source === 'note' ? '#fde047' : '#dbeafe',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, marginTop: 2
                        }}>
                          {msg.source === 'whatsapp' ? '💬' : msg.source === 'note' ? '📝' : '🌐'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>
                              {msg.source === 'whatsapp' ? 'ליד (לקוח)' : msg.source === 'note' ? 'תיעוד (אני)' : 'הודעת מערכת'}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              {new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })},{' '}
                              {new Date(msg.created_at).toLocaleDateString('he-IL')}
                            </span>
                            {msg.source === 'note' && editingNoteId !== msg.id && (
                              <button onClick={() => { setEditingNoteId(msg.id); setEditNoteText(msg.content || '') }} style={{ background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', opacity: 0.6 }}>✏️ ערוך</button>
                            )}
                          </div>
                          {editingNoteId === msg.id ? (
                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                              <textarea value={editNoteText} onChange={e => setEditNoteText(e.target.value)} style={{ flex: 1, padding: 6, fontSize: 13, borderRadius: 4, border: '1px solid var(--border)', fontFamily: 'inherit' }} />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <button onClick={() => handleUpdateNote(msg.id)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>V</button>
                                <button onClick={() => setEditingNoteId(null)} style={{ background: '#e5e7eb', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>X</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                              {msg.content?.split(/(https?:\/\/[^\s]+)/g).map((part: string, index: number) => {
                                if (part.match(/https?:\/\/[^\s]+/)) {
                                  return (
                                    <a key={index} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                                      {part}
                                    </a>
                                  )
                                }
                                return <span key={index}>{part}</span>
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* UTM Block */}
              {(selectedLead.utm_source || selectedLead.utm_medium || selectedLead.utm_campaign || selectedLead.utm_term || selectedLead.utm_content) && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>🎯 UTM Parameters</div>
                  <div style={{ background: '#f0f9ff', borderRadius: 8, padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, border: '1px solid #bae6fd' }}>
                    {selectedLead.utm_source && <UtmTag label="Source" value={selectedLead.utm_source} />}
                    {selectedLead.utm_medium && <UtmTag label="Medium" value={selectedLead.utm_medium} />}
                    {selectedLead.utm_campaign && <UtmTag label="Campaign" value={selectedLead.utm_campaign} />}
                    {selectedLead.utm_term && <UtmTag label="Keyword" value={selectedLead.utm_term} />}
                    {selectedLead.utm_content && <UtmTag label="Ad" value={selectedLead.utm_content} />}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ padding: '16px 24px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
              {selectedLead.is_existing_customer ? (
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleConfirmExistingLead(selectedLead)}>
                  📋 הוסף להיסטוריה ועבור ללקוח
                </button>
              ) : (
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => openConvertModal(selectedLead)}>
                  <UserPlusIcon /> המרה לאיש קשר
                </button>
              )}
              <button className="btn btn-ghost" style={{ color: '#dc2626', borderColor: '#fecaca', flex: 1 }} onClick={() => openRejectModal(selectedLead)}>
                <TrashIcon /> לא רלוונטי
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ REJECTION MODAL ═══════════ */}
      {rejectingLead && (
        <div className="modal-overlay" onClick={() => setRejectingLead(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal" onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="modal-header">
              <h3 className="modal-title">סיבת דחיית הליד</h3>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }} onClick={() => setRejectingLead(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                בחר סיבה לדחיית הליד מ<strong>{rejectingLead.sender_name || 'ליד ללא שם'}</strong>:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rejectionReasons.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    אין סיבות מוגדרות. <Link href="/settings" style={{ color: 'var(--pink)' }}>הוסף סיבות בהגדרות →</Link>
                  </p>
                ) : (
                  rejectionReasons.map(reason => (
                    <label key={reason.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      borderRadius: 10, border: '1px solid',
                      borderColor: selectedReason === reason.id ? 'var(--pink)' : 'var(--border)',
                      background: selectedReason === reason.id ? 'var(--pink-lighter, #fdf2f8)' : 'var(--surface-2)',
                      cursor: 'pointer', transition: 'all 0.15s', fontSize: 14,
                    }}>
                      <input
                        type="radio"
                        name="rejection_reason"
                        value={reason.id}
                        checked={selectedReason === reason.id}
                        onChange={() => setSelectedReason(reason.id)}
                        style={{ accentColor: 'var(--pink)' }}
                      />
                      {reason.label}
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="modal-footer" style={{ flexDirection: 'row-reverse' }}>
              <button
                className="btn btn-primary"
                style={{ background: '#dc2626', borderColor: '#dc2626' }}
                disabled={!selectedReason || rejectingLoader}
                onClick={handleConfirmReject}
              >
                {rejectingLoader ? <span className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> : 'דחה ליד'}
              </button>
              <button className="btn btn-ghost" onClick={() => setRejectingLead(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ CONVERT MODAL ═══════════ */}
      {convertingLead && (
        <div className="modal-overlay" onClick={() => setConvertingLead(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal" onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="modal-header">
              <h3 className="modal-title">המרה לאיש קשר</h3>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }} onClick={() => setConvertingLead(null)}>✕</button>
            </div>

            {/* Mode toggle for existing-customer leads */}
            {convertingLead.matched_contact_id && (
              <div style={{ padding: '0 24px 16px', display: 'flex', gap: 8 }}>
                {(['existing', 'new'] as const).map(m => (
                  <button key={m} onClick={() => setConvertMode(m)} style={{
                    flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid',
                    borderColor: convertMode === m ? 'var(--pink)' : 'var(--border)',
                    background: convertMode === m ? 'var(--pink)' : 'var(--surface-2)',
                    color: convertMode === m ? 'white' : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}>
                    {m === 'existing' ? '👤 שוך ללקוח קיים' : '➕ צור לקוח חדש'}
                  </button>
                ))}
              </div>
            )}

            <div className="modal-body">
              {convertMode === 'existing' && convertingLead.matched_contact_id ? (
                <div style={{ background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: 16, fontSize: 14 }}>
                  <div style={{ fontWeight: 700, color: '#7c3aed', marginBottom: 6 }}>היסטוריית ההתכתבות תועבר לכרטיס הלקוח הקיים:</div>
                  {matchedContact
                    ? <div style={{ fontWeight: 600 }}>{matchedContact.name} {matchedContact.organizations ? `· ${matchedContact.organizations.name}` : ''}</div>
                    : <span className="spinner" style={{ width: 14, height: 14 }} />}
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>שם איש קשר</label>
                    <input type="text" className="form-input" value={convertData.name} onChange={e => setConvertData({ ...convertData, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>מספר טלפון</label>
                    <input type="text" className="form-input" style={{ direction: 'ltr' }} value={convertData.phone} onChange={e => setConvertData({ ...convertData, phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>כתובת אימייל</label>
                    <input type="email" className="form-input" style={{ direction: 'ltr' }} value={convertData.email} onChange={e => setConvertData({ ...convertData, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>שם חברה / ארגון</label>
                    <input type="text" className="form-input" value={convertData.company} onChange={e => setConvertData({ ...convertData, company: e.target.value })} />
                    <small className="text-muted" style={{ display: 'block', marginTop: 4 }}>יווצר ארגון חדש שישויך לאיש הקשר.</small>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer" style={{ flexDirection: 'row-reverse' }}>
              <button
                className="btn btn-primary"
                disabled={convertingLoader}
                onClick={convertMode === 'existing' && convertingLead.matched_contact_id
                  ? handleConvertToExistingContact
                  : handleConvertToNewContact}
              >
                {convertingLoader
                  ? <span className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} />
                  : 'שמור ועבור ללקוח'}
              </button>
              <button className="btn btn-ghost" onClick={() => setConvertingLead(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
      {/* ═══════════ QUICK NOTE MODAL ═══════════ */}
      {quickNoteLead && (
         <div className="modal-overlay" onClick={() => setQuickNoteLead(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="modal" onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>הוסף תיעוד: {quickNoteLead.sender_name || 'ליד'}</h3>
            <textarea 
              autoFocus
              placeholder="הכנס תיעוד פנימי כאן..." 
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', minHeight: 80, fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => { setQuickNoteLead(null); setNewNote('') }} className="btn btn-secondary" style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8 }}>ביטול</button>
              <button 
                onClick={() => handleSaveNote(quickNoteLead.id)} 
                disabled={savingNote || !newNote.trim()}
                className="btn btn-primary"
                style={{ padding: '8px 16px', borderRadius: 8, opacity: (!newNote.trim() || savingNote) ? 0.6 : 1 }}
              >
                {savingNote ? 'שומר...' : 'שמור תיעוד'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── Sub-components ─── */
function DetailField({ label, value, dir }: { label: string; value: string; dir?: string }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', direction: dir as any }}>{value}</div>
    </div>
  )
}

function UtmTag({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: 11, background: 'white', border: '1px solid #bae6fd', borderRadius: 6, padding: '3px 8px' }}>
      <span style={{ color: '#0369a1', fontWeight: 700 }}>{label}: </span>
      <span style={{ color: '#0c4a6e' }}>{value}</span>
    </div>
  )
}

/* ─── Icons ─── */
function SearchIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> }
function WhatsAppIcon() { return <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg> }
function GlobeIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg> }
function TrashIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg> }
function UserPlusIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg> }
