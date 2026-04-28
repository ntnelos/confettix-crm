'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Opportunity {
  id: string
  subject: string
  status: 'new' | 'followup' | 'won' | 'lost' | 'pending_payment' | 'paid' | string
  calculated_value: number
  lead_source: string | null
  created_at: string
  updated_at: string
  organizations?: { name: string } | null
  contacts?: { name: string } | null
}

const STATUSES = [
  { id: 'new', label: 'חדש', color: 'var(--pink)', bg: 'rgba(230,0,126,0.1)' },
  { id: 'followup', label: 'במעקב', color: '#ff9800', bg: 'rgba(255,152,0,0.1)' },
  { id: 'won', label: 'זכייה', color: '#4caf50', bg: 'rgba(76,175,80,0.1)' },
  { id: 'pending_payment', label: 'ממתין לתשלום', color: '#3f51b5', bg: 'rgba(63,81,181,0.1)' },
  { id: 'paid', label: 'סגור/שולם', color: '#009688', bg: 'rgba(0,150,136,0.1)' },
  { id: 'lost', label: 'בוטל / סגור', color: '#9e9e9e', bg: 'rgba(158,158,158,0.1)' }
]

function OpportunitiesContent() {
  const supabase = createClient()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'kanban' | 'list'>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<keyof Opportunity>('updated_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Filter state
  const [filterStatuses, setFilterStatuses] = useState<string[]>([])
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterUpdatedFrom, setFilterUpdatedFrom] = useState('')
  const [filterUpdatedTo, setFilterUpdatedTo] = useState('')
  const [filterAmountMin, setFilterAmountMin] = useState('')
  const [filterAmountMax, setFilterAmountMax] = useState('')

  const fetchOpps = async (query = '') => {
    setLoading(true)
    let dbQuery = supabase
      .from('opportunities')
      .select('*, organizations(name), contacts(name)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (query) {
      dbQuery = dbQuery.or(`subject.ilike.%${query}%,lead_source.ilike.%${query}%`)
    }

    const { data, error } = await dbQuery

    if (!error && data) {
      // Deduplicate by ID
      const uniqueMap = new Map<string, Opportunity>()
      ;(data as Opportunity[]).forEach(opp => {
        if (!uniqueMap.has(opp.id)) {
          uniqueMap.set(opp.id, opp)
        }
      })
      setOpportunities(Array.from(uniqueMap.values()))
    }
    setLoading(false)
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchOpps(searchQuery)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  const updateOppStatus = async (id: string, newStatus: string) => {
    // Optimistic UI Update
    setOpportunities(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o))
    
    const { error } = await (supabase.from('opportunities') as any).update({ status: newStatus }).eq('id', id)
    if (error) {
      alert(`שגיאה בעדכון הסטטוס: ${error.message}`)
      fetchOpps() // revert on fail
    }
  }

  // Native HTML5 Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('opp_id', id)
    // Optional: make it look slightly transparent while dragging
    setTimeout(() => {
      ;(e.target as HTMLElement).style.opacity = '0.5'
    }, 0)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    ;(e.target as HTMLElement).style.opacity = '1'
  }

  const handleDrop = (e: React.DragEvent, statusId: string) => {
    e.preventDefault()
    const oppId = e.dataTransfer.getData('opp_id')
    if (oppId) {
      updateOppStatus(oppId, statusId)
    }
  }

  const hasActiveFilters = filterStatuses.length > 0 || filterDateFrom || filterDateTo || filterUpdatedFrom || filterUpdatedTo || filterAmountMin || filterAmountMax

  const clearFilters = () => {
    setFilterStatuses([])
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterUpdatedFrom('')
    setFilterUpdatedTo('')
    setFilterAmountMin('')
    setFilterAmountMax('')
  }

  const toggleStatus = (statusId: string) => {
    setFilterStatuses(prev =>
      prev.includes(statusId) ? prev.filter(s => s !== statusId) : [...prev, statusId]
    )
  }

  const filteredOpps = opportunities.filter(o => {
    // Text search
    const matchSearch =
      o.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.organizations?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.contacts?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchSearch) return false

    // Status filter
    if (filterStatuses.length > 0 && !filterStatuses.includes(o.status)) return false

    // Date created range
    if (filterDateFrom && new Date(o.created_at) < new Date(filterDateFrom)) return false
    if (filterDateTo && new Date(o.created_at) > new Date(filterDateTo + 'T23:59:59')) return false

    // Date updated range
    if (filterUpdatedFrom && new Date(o.updated_at) < new Date(filterUpdatedFrom)) return false
    if (filterUpdatedTo && new Date(o.updated_at) > new Date(filterUpdatedTo + 'T23:59:59')) return false

    // Amount range
    const val = o.calculated_value || 0
    if (filterAmountMin && val < parseFloat(filterAmountMin)) return false
    if (filterAmountMax && val > parseFloat(filterAmountMax)) return false

    return true
  }).sort((a, b) => {
    let aVal = a[sortField] || ''
    let bVal = b[sortField] || ''
    if (sortField === 'calculated_value' || sortField === 'status') {
       aVal = String(aVal); bVal = String(bVal);
       if (sortField === 'calculated_value') { aVal = Number(aVal) || 0; bVal = Number(bVal) || 0; }
    }
    if (aVal < bVal) return sortAsc ? -1 : 1
    if (aVal > bVal) return sortAsc ? 1 : -1
    return 0
  })

  const grouped = STATUSES.map(s => ({
    ...s,
    items: filteredOpps.filter(o => o.status === s.id)
  }))

  const handleSort = (field: keyof Opportunity) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(false) }
  }

  const totalValue = opportunities.filter(o => o.status !== 'lost').reduce((sum, o) => sum + (o.calculated_value || 0), 0)

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>הזדמנויות עסקיות</h1>
          <span className="badge" style={{ fontSize: 13, background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
             סה״כ ערך פתוח: ₪{totalValue.toLocaleString()}
          </span>
        </div>
        
        <div className="topbar-actions">
          <div style={{ display: 'flex', background: 'var(--body-bg)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
            <button 
              onClick={() => setView('kanban')}
              style={{
                background: view === 'kanban' ? 'var(--surface)' : 'transparent',
                color: view === 'kanban' ? 'var(--pink)' : 'var(--text-muted)',
                border: 'none', padding: '6px 16px', borderRadius: 6, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: view === 'kanban' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              קאנבן
            </button>
            <button 
              onClick={() => setView('list')}
              style={{
                background: view === 'list' ? 'var(--surface)' : 'transparent',
                color: view === 'list' ? 'var(--pink)' : 'var(--text-muted)',
                border: 'none', padding: '6px 16px', borderRadius: 6, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: view === 'list' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              רשימה
            </button>
          </div>
          <Link href="/opportunities/new" className="btn btn-primary">
            <PlusIcon /> הזדמנות חדשה
          </Link>
        </div>
      </div>

      <div className="page-body">
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="חיפוש לפי סטטוס, נושא הזדמנות, שם ארגון או מזהה..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 240, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}
            />
            <button
              onClick={() => setShowFilters(f => !f)}
              style={{
                padding: '10px 18px', borderRadius: 8, border: '1px solid var(--border)',
                background: showFilters || hasActiveFilters ? 'var(--pink)' : 'var(--surface)',
                color: showFilters || hasActiveFilters ? 'white' : 'var(--text-primary)',
                fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              סינון
              {hasActiveFilters && <span style={{ background: 'white', color: 'var(--pink)', borderRadius: '50%', width: 18, height: 18, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{filterStatuses.length + (filterDateFrom||filterDateTo ? 1:0) + (filterUpdatedFrom||filterUpdatedTo ? 1:0) + (filterAmountMin||filterAmountMax ? 1:0)}</span>}
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                נקה סינון ✕
              </button>
            )}
          </div>

          {showFilters && (
            <div style={{ marginTop: 12, padding: '20px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Status Filter */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>סטטוס הזדמנות</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {STATUSES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => toggleStatus(s.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        border: `1.5px solid ${filterStatuses.includes(s.id) ? s.color : 'var(--border)'}`,
                        background: filterStatuses.includes(s.id) ? s.bg : 'transparent',
                        color: filterStatuses.includes(s.id) ? s.color : 'var(--text-secondary)',
                        transition: 'all 0.15s'
                      }}
                    >
                      {filterStatuses.includes(s.id) && '✓ '}{s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>

                {/* Created Date Range */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>תאריך יצירה</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                    <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                  </div>
                </div>

                {/* Updated Date Range */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>תאריך עדכון אחרון</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="date" value={filterUpdatedFrom} onChange={e => setFilterUpdatedFrom(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                    <input type="date" value={filterUpdatedTo} onChange={e => setFilterUpdatedTo(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                  </div>
                </div>

                {/* Amount Range */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>ערך עסקה (₪)</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="number" placeholder="מינימום" value={filterAmountMin} onChange={e => setFilterAmountMin(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                    <input type="number" placeholder="מקסימום" value={filterAmountMax} onChange={e => setFilterAmountMax(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                  </div>
                </div>

              </div>

              {filteredOpps.length >= 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  מציג <strong>{filteredOpps.length}</strong> מתוך <strong>{opportunities.length}</strong> הזדמנויות
                </div>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 100 }}>
            <span className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--pink)' }} />
          </div>
        ) : view === 'kanban' ? (
          /* KANBAN VIEW */
          <div className="kanban-scroll-wrapper" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', paddingBottom: 20 }}>
            <div style={{ display: 'flex', gap: 20, width: 'max-content', padding: '0 20px 20px 20px', minHeight: 'calc(100vh - 160px)', alignItems: 'flex-start' }}>
              {grouped.map(col => (
              <div 
                key={col.id} 
                style={{ 
                  flex: '0 0 300px', 
                  background: 'var(--surface-2)', 
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: '100%',
                  border: '1px solid var(--border)'
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {/* Column Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{col.label}</h3>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, background: 'var(--body-bg)', padding: '2px 8px', borderRadius: 12 }}>
                    {col.items.length}
                  </span>
                </div>
                
                {/* Cards Container */}
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
                  {col.items.map(opp => (
                    <div 
                      key={opp.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, opp.id)}
                      onDragEnd={handleDragEnd}
                      className="card"
                      style={{ 
                        padding: 16, 
                        cursor: 'grab', 
                        borderLeft: `4px solid ${col.color}`,
                        transition: 'transform 0.1s, box-shadow 0.2s',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                      }}
                      onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <Link href={`/opportunities/${opp.id}`} style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', textDecoration: 'none' }}>
                          {opp.subject}
                        </Link>
                      </div>
                      
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {opp.organizations?.name || opp.contacts?.name || 'ללא שיוך'}
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(opp.created_at).toLocaleDateString('he-IL')}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                          ₪{opp.calculated_value?.toLocaleString() || 0}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {col.items.length === 0 && (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 8 }}>
                      גרור עסקאות לכאן
                    </div>
                  )}
                </div>
              </div>
            ))}
            </div>
          </div>
        ) : (
          /* LIST VIEW */
          <div className="card">
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '16px 24px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>נושא ההזדמנות</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>שיוך</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>איש קשר</th>
                  <th onClick={() => handleSort('status')} style={{ padding: '16px 24px', textAlign: 'right', borderBottom: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap' }}>סטטוס {sortField === 'status' ? (sortAsc ? ' 🔼' : ' 🔽') : ''}</th>
                  <th onClick={() => handleSort('calculated_value')} style={{ padding: '16px 24px', textAlign: 'right', borderBottom: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap' }}>ערך העסקה {sortField === 'calculated_value' ? (sortAsc ? ' 🔼' : ' 🔽') : ''}</th>
                  <th onClick={() => handleSort('created_at')} style={{ padding: '16px 24px', textAlign: 'right', borderBottom: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap' }}>תאריך יצירה {sortField === 'created_at' ? (sortAsc ? ' 🔼' : ' 🔽') : ''}</th>
                  <th onClick={() => handleSort('updated_at')} style={{ padding: '16px 24px', textAlign: 'right', borderBottom: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap' }}>תאריך עדכון {sortField === 'updated_at' ? (sortAsc ? ' 🔼' : ' 🔽') : ''}</th>
                </tr>
              </thead>
              <tbody>
                {filteredOpps.map(opp => (
                  <tr key={opp.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <Link href={`/opportunities/${opp.id}`} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {opp.subject}
                      </Link>
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: 13 }}>
                      {opp.organizations?.name || opp.contacts?.name || '—'}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: 13 }}>
                      {opp.contacts?.name || '—'}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span className="badge" style={{ 
                        background: STATUSES.find(s => s.id === opp.status)?.bg || 'transparent',
                        color: STATUSES.find(s => s.id === opp.status)?.color || 'inherit'
                      }}>
                        {STATUSES.find(s => s.id === opp.status)?.label || opp.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', fontWeight: 500, fontSize: 14 }}>
                      ₪{opp.calculated_value?.toLocaleString() || 0}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: 13 }}>
                      {new Date(opp.created_at).toLocaleDateString('he-IL')}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: 13 }}>
                      {new Date(opp.updated_at || opp.created_at).toLocaleDateString('he-IL')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

const OpportunitiesPage = dynamic(() => Promise.resolve(OpportunitiesContent), {
  ssr: false,
  loading: () => (
    <div style={{ textAlign: 'center', padding: 100 }}>
       <span className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--pink)' }} />
    </div>
  )
})

export default OpportunitiesPage

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  )
}
