'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Quote {
  id: string
  name: string
  quote_number: string | null
  status: string
  total_with_vat: number
  created_at: string
  updated_at: string
  opportunity_id: string
  opportunities?: {
    subject: string
    organizations?: { name: string } | null
    contacts?: { name: string } | null
  } | null
}

const STATUSES = [
  { id: 'draft', label: 'טיוטה', color: '#9e9e9e', bg: 'rgba(158,158,158,0.1)' },
  { id: 'sent', label: 'נשלח', color: '#3f51b5', bg: 'rgba(63,81,181,0.1)' },
  { id: 'approved', label: 'אושר', color: '#4caf50', bg: 'rgba(76,175,80,0.1)' },
  { id: 'rejected', label: 'נדחה', color: '#f44336', bg: 'rgba(244,67,54,0.1)' }
]

function QuotesContent() {
  const supabase = createClient()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<keyof Quote>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Filter state
  const [filterStatuses, setFilterStatuses] = useState<string[]>([])
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterAmountMin, setFilterAmountMin] = useState('')
  const [filterAmountMax, setFilterAmountMax] = useState('')

  const fetchQuotes = async (query = '') => {
    setLoading(true)
    let dbQuery = supabase
      .from('quotes')
      .select('*, opportunities(subject, organizations(name), contacts(name))')
      .order('created_at', { ascending: false })
      .limit(200)

    // Note: Postgrest ilike on joined tables can be tricky via standard string filter, 
    // so we handle deep search in JS if it's too complex, or we filter on direct fields.
    if (query) {
      dbQuery = dbQuery.or(`name.ilike.%${query}%,quote_number.ilike.%${query}%`)
    }

    const { data, error } = await dbQuery

    if (!error && data) {
      setQuotes(data as any as Quote[])
    }
    setLoading(false)
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchQuotes(searchQuery)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  const hasActiveFilters = filterStatuses.length > 0 || filterDateFrom || filterDateTo || filterAmountMin || filterAmountMax

  const clearFilters = () => {
    setFilterStatuses([])
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterAmountMin('')
    setFilterAmountMax('')
  }

  const toggleStatus = (statusId: string) => {
    setFilterStatuses(prev =>
      prev.includes(statusId) ? prev.filter(s => s !== statusId) : [...prev, statusId]
    )
  }

  const filteredQuotes = quotes.filter(q => {
    // Advanced text search (including nested relations)
    if (searchQuery) {
      const qStr = searchQuery.toLowerCase()
      const match = 
        (q.name || '').toLowerCase().includes(qStr) ||
        (q.quote_number || '').toLowerCase().includes(qStr) ||
        (q.opportunities?.subject || '').toLowerCase().includes(qStr) ||
        (q.opportunities?.organizations?.name || '').toLowerCase().includes(qStr) ||
        (q.opportunities?.contacts?.name || '').toLowerCase().includes(qStr)
      
      if (!match) return false
    }

    // Status filter
    if (filterStatuses.length > 0 && !filterStatuses.includes(q.status)) return false

    // Date created range
    if (filterDateFrom && new Date(q.created_at) < new Date(filterDateFrom)) return false
    if (filterDateTo && new Date(q.created_at) > new Date(filterDateTo + 'T23:59:59')) return false

    // Amount range
    const val = q.total_with_vat || 0
    if (filterAmountMin && val < parseFloat(filterAmountMin)) return false
    if (filterAmountMax && val > parseFloat(filterAmountMax)) return false

    return true
  }).sort((a, b) => {
    let aVal = a[sortField] || ''
    let bVal = b[sortField] || ''
    if (sortField === 'total_with_vat' || sortField === 'status') {
       aVal = String(aVal); bVal = String(bVal);
       if (sortField === 'total_with_vat') { aVal = Number(aVal) || 0; bVal = Number(bVal) || 0; }
    }
    if (aVal < bVal) return sortAsc ? -1 : 1
    if (aVal > bVal) return sortAsc ? 1 : -1
    return 0
  })

  const handleSort = (field: keyof Quote) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(false) }
  }

  const totalValue = filteredQuotes.reduce((sum, q) => sum + (q.total_with_vat || 0), 0)

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>הצעות מחיר</h1>
          <span className="badge" style={{ fontSize: 13, background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
             סה״כ מוצג: ₪{totalValue.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="page-body">
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="חיפוש לפי שם הצעה, מספר, נושא הזדמנות, איש קשר..." 
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
              {hasActiveFilters && <span style={{ background: 'white', color: 'var(--pink)', borderRadius: '50%', width: 18, height: 18, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{filterStatuses.length + (filterDateFrom||filterDateTo ? 1:0) + (filterAmountMin||filterAmountMax ? 1:0)}</span>}
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
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>סטטוס הצעה</div>
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

                {/* Amount Range */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>סה״כ (כולל מע״מ)</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="number" placeholder="מינימום" value={filterAmountMin} onChange={e => setFilterAmountMin(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                    <input type="number" placeholder="מקסימום" value={filterAmountMax} onChange={e => setFilterAmountMax(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                  </div>
                </div>
              </div>

              {filteredQuotes.length >= 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  מציג <strong>{filteredQuotes.length}</strong> מתוך <strong>{quotes.length}</strong> הצעות מחיר
                </div>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 100 }}>
            <span className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--pink)' }} />
          </div>
        ) : (
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 800 }}>
              <thead>
                <tr>
                  <th onClick={() => handleSort('quote_number')} style={{ padding: '16px 24px', textAlign: 'right', borderBottom: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap' }}>מספר {sortField === 'quote_number' ? (sortAsc ? ' 🔼' : ' 🔽') : ''}</th>
                  <th onClick={() => handleSort('name')} style={{ padding: '16px 24px', textAlign: 'right', borderBottom: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap' }}>שם ההצעה {sortField === 'name' ? (sortAsc ? ' 🔼' : ' 🔽') : ''}</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>הזדמנות מקושרת</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>לקוח / ארגון</th>
                  <th onClick={() => handleSort('status')} style={{ padding: '16px 24px', textAlign: 'right', borderBottom: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap' }}>סטטוס {sortField === 'status' ? (sortAsc ? ' 🔼' : ' 🔽') : ''}</th>
                  <th onClick={() => handleSort('total_with_vat')} style={{ padding: '16px 24px', textAlign: 'right', borderBottom: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap' }}>סה״כ לתשלום {sortField === 'total_with_vat' ? (sortAsc ? ' 🔼' : ' 🔽') : ''}</th>
                  <th onClick={() => handleSort('created_at')} style={{ padding: '16px 24px', textAlign: 'right', borderBottom: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap' }}>תאריך יצירה {sortField === 'created_at' ? (sortAsc ? ' 🔼' : ' 🔽') : ''}</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map(q => (
                  <tr key={q.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <Link href={`/opportunities/${q.opportunity_id}?quote=${q.id}`} style={{ fontWeight: 600, color: 'var(--pink)', fontFamily: 'monospace' }}>
                        {q.quote_number || '---'}
                      </Link>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <Link href={`/opportunities/${q.opportunity_id}?quote=${q.id}`} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {q.name || 'ללא שם'}
                      </Link>
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: 13 }}>
                      {q.opportunities?.subject || '—'}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: 13 }}>
                      {q.opportunities?.organizations?.name || q.opportunities?.contacts?.name || '—'}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span className="badge" style={{ 
                        background: STATUSES.find(s => s.id === q.status)?.bg || 'transparent',
                        color: STATUSES.find(s => s.id === q.status)?.color || 'inherit'
                      }}>
                        {STATUSES.find(s => s.id === q.status)?.label || q.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', fontWeight: 600, fontSize: 14 }}>
                      ₪{q.total_with_vat?.toLocaleString() || 0}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: 13 }}>
                      {new Date(q.created_at).toLocaleDateString('he-IL')}
                    </td>
                  </tr>
                ))}
                {filteredQuotes.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                      לא נמצאו הצעות מחיר
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

const QuotesPage = dynamic(() => Promise.resolve(QuotesContent), {
  ssr: false,
  loading: () => (
    <div style={{ textAlign: 'center', padding: 100 }}>
       <span className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--pink)' }} />
    </div>
  )
})

export default QuotesPage
