'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

/* ─── Types ─── */
interface KpiData {
  openOpportunities: number
  closedThisMonth: number    // won/pending_payment/paid this month
  invoicesTotalMonth: number
  invoicesTotal12m: number
  receiptsTotalMonth: number
  receiptsTotal12m: number
  conversionRate: number     // won/pending_payment/paid in 12m ÷ leads in 12m
}

interface RecentOpportunity {
  id: string
  subject: string
  status: string
  calculated_value: number | null
  created_at: string
  updated_at: string
  organizations?: { name: string } | null
  contacts?: { name: string } | null
}

const WIN_STATUSES = ['won', 'pending_payment', 'paid']
const OPEN_STATUSES = ['new', 'followup']

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  new:             { label: 'חדש',              color: 'var(--pink)', bg: 'rgba(230,0,126,0.1)' },
  followup:        { label: 'במעקב',            color: '#ff9800',     bg: 'rgba(255,152,0,0.1)' },
  won:             { label: 'זכייה',            color: '#4caf50',     bg: 'rgba(76,175,80,0.1)' },
  pending_payment: { label: 'ממתין לתשלום',     color: '#3f51b5',     bg: 'rgba(63,81,181,0.1)' },
  paid:            { label: 'סגור / שולם',      color: '#009688',     bg: 'rgba(0,150,136,0.1)' },
  lost:            { label: 'בוטל / סגור',      color: '#9e9e9e',     bg: 'rgba(158,158,158,0.1)' },
}

function formatILS(amount: number | null | undefined) {
  if (!amount) return '₪0'
  return '₪' + amount.toLocaleString('he-IL', { maximumFractionDigits: 0 })
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 1) return 'היום'
  if (diffDays < 2) return 'אתמול'
  if (diffDays < 7) return `לפני ${Math.floor(diffDays)} ימים`
  return date.toLocaleDateString('he-IL')
}

/* ─── Component ─── */
export default function DashboardPage() {
  const supabase = createClient()
  const [greeting, setGreeting] = useState('שלום 👋')
  const [loading, setLoading] = useState(true)
  const [kpi, setKpi] = useState<KpiData>({
    openOpportunities: 0,
    closedThisMonth: 0,
    invoicesTotalMonth: 0,
    invoicesTotal12m: 0,
    receiptsTotalMonth: 0,
    receiptsTotal12m: 0,
    conversionRate: 0,
  })
  const [recentOpps, setRecentOpps] = useState<RecentOpportunity[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const name = data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || ''
        const hour = new Date().getHours()
        if (hour < 12)       setGreeting(`בוקר טוב, ${name} ☕`)
        else if (hour < 18)  setGreeting(`צהריים טובים, ${name} ☀️`)
        else                 setGreeting(`ערב טוב, ${name} 🌙`)
      }
    })
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)

    const now       = new Date()
    const startOf12m = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1).toISOString()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    // ── Run all queries in parallel ──
    const [
      openOppsRes,
      closedMonthRes,
      invoices12mRes,
      receipts12mRes,
      leads12mRes,
      wins12mRes,
      recentOppsRes,
    ] = await Promise.all([
      // 1. Open opportunities count
      (supabase.from('opportunities') as any)
        .select('id', { count: 'exact', head: true })
        .in('status', OPEN_STATUSES),

      // 2. Won/pending/paid this month
      (supabase.from('opportunities') as any)
        .select('id', { count: 'exact', head: true })
        .in('status', WIN_STATUSES)
        .gte('updated_at', startOfMonth),

      // 3. Invoices last 12m (type = invoice/305)
      (supabase.from('invoices') as any)
        .select('amount, issued_at, type')
        .gte('issued_at', startOf12m),

      // 4. Receipts last 12m (type = receipt/400)
      (supabase.from('invoices') as any)
        .select('amount, issued_at, type')
        .gte('issued_at', startOf12m),

      // 5. Leads count in 12m (for conversion rate denominator)
      (supabase.from('leads') as any)
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOf12m),

      // 6. Wins in 12m (numerator)
      (supabase.from('opportunities') as any)
        .select('id', { count: 'exact', head: true })
        .in('status', WIN_STATUSES)
        .gte('updated_at', startOf12m),

      // 7. Recent 5 opportunities
      (supabase.from('opportunities') as any)
        .select('id, subject, status, calculated_value, created_at, updated_at, organizations(name), contacts(name)')
        .order('updated_at', { ascending: false })
        .limit(5),
    ])

    // ── Process invoices and receipts ──
    const allDocs: any[] = invoices12mRes.data || []

    const isInvoice = (doc: any) =>
      doc.type === 'invoice' || doc.type === '305' || (!doc.type)
    const isReceipt = (doc: any) =>
      doc.type === 'receipt' || doc.type === '400'

    const invoices12m = allDocs.filter(isInvoice)
    const receipts12m = allDocs.filter(isReceipt)

    const invoicesTotalMonth = invoices12m
      .filter(d => d.issued_at >= startOfMonth)
      .reduce((s, d) => s + (d.amount || 0), 0)

    const invoicesTotal12m = invoices12m
      .reduce((s, d) => s + (d.amount || 0), 0)

    const receiptsTotalMonth = receipts12m
      .filter(d => d.issued_at >= startOfMonth)
      .reduce((s, d) => s + (d.amount || 0), 0)

    const receiptsTotal12m = receipts12m
      .reduce((s, d) => s + (d.amount || 0), 0)

    const leadsCount  = leads12mRes.count  || 0
    const winsCount   = wins12mRes.count   || 0
    const conversionRate = leadsCount > 0 ? Math.round((winsCount / leadsCount) * 100) : 0

    setKpi({
      openOpportunities: openOppsRes.count || 0,
      closedThisMonth:   closedMonthRes.count || 0,
      invoicesTotalMonth,
      invoicesTotal12m,
      receiptsTotalMonth,
      receiptsTotal12m,
      conversionRate,
    })

    if (recentOppsRes.data) setRecentOpps(recentOppsRes.data)
    setLoading(false)
  }

  /* ─── Render ─── */
  return (
    <>
      <div className="topbar">
        <div />
        <div className="topbar-actions">
          <button className="topbar-icon-btn">
            <BellIcon />
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="page-header">
          <div>
            <h1 className="page-title">{greeting}</h1>
            <p className="page-subtitle">הנה הסיכום העסקי שלך</p>
          </div>
          <div className="actions-row">
            <Link href="/opportunities/new" className="btn btn-primary">
              <PlusIcon />
              הזדמנות חדשה
            </Link>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <span className="spinner" style={{ width: 32, height: 32, borderTopColor: 'var(--pink)' }} />
          </div>
        ) : (
          <>
            {/* ═══ KPI Grid ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>

              {/* הזדמנויות פתוחות */}
              <KpiCard
                icon={<ActivityIcon />}
                iconBg="rgba(230,0,126,0.12)"
                iconColor="var(--pink)"
                label="הזדמנויות פתוחות"
                value={String(kpi.openOpportunities)}
                sub="בסטטוס חדש / מעקב"
                href="/opportunities"
              />

              {/* נסגרו החודש */}
              <KpiCard
                icon={<CheckCircleIcon />}
                iconBg="rgba(76,175,80,0.12)"
                iconColor="#4caf50"
                label="נסגרו בהצלחה החודש"
                value={String(kpi.closedThisMonth)}
                sub="זכייה / ממתין לתשלום / שולם"
              />

              {/* יחס המרה */}
              <KpiCard
                icon={<TrendingIcon />}
                iconBg="rgba(63,81,181,0.12)"
                iconColor="#3f51b5"
                label="יחס המרה (12 חודשים)"
                value={`${kpi.conversionRate}%`}
                sub="זכיות ÷ לידים"
                bigNumber
              />

              {/* חשבוניות החודש */}
              <KpiCard
                icon={<FileTextIcon />}
                iconBg="rgba(0,150,136,0.1)"
                iconColor="#009688"
                label="חשבוניות שהופקו"
                value={formatILS(kpi.invoicesTotalMonth)}
                sub={`12 חודשים: ${formatILS(kpi.invoicesTotal12m)}`}
              />

              {/* קבלות החודש */}
              <KpiCard
                icon={<DollarIcon />}
                iconBg="rgba(255,152,0,0.1)"
                iconColor="#ff9800"
                label="קבלות (כסף שנכנס)"
                value={formatILS(kpi.receiptsTotalMonth)}
                sub={`12 חודשים: ${formatILS(kpi.receiptsTotal12m)}`}
              />

            </div>

            {/* ═══ Main Content Grid ═══ */}
            <div className="dashboard-grid">
              {/* Recent Opportunities */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">הזדמנויות אחרונות</h2>
                  <Link href="/opportunities" className="btn-ghost" style={{ fontSize: 12 }}>
                    כל ההזדמנויות →
                  </Link>
                </div>

                {recentOpps.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                    אין הזדמנויות עדיין
                  </div>
                ) : (
                  <div className="table-container" style={{ boxShadow: 'none', border: 'none' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>פריט / חברה</th>
                          <th>איש קשר</th>
                          <th>סטטוס</th>
                          <th>סכום</th>
                          <th>עודכן</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentOpps.map(opp => {
                          const s = STATUS_LABELS[opp.status] || { label: opp.status, color: '#999', bg: '#eee' }
                          return (
                            <tr
                              key={opp.id}
                              onClick={() => window.location.href = `/opportunities/${opp.id}`}
                              style={{ cursor: 'pointer' }}
                              onMouseOver={e => (e.currentTarget.style.background = '#f8fafc')}
                              onMouseOut={e => (e.currentTarget.style.background = '')}
                            >
                              <td>
                                <div className="font-bold" style={{ fontSize: 13 }}>{opp.subject}</div>
                                {opp.organizations && (
                                  <div className="td-muted">{opp.organizations.name}</div>
                                )}
                              </td>
                              <td>
                                <div style={{ fontSize: 13 }}>{opp.contacts?.name || '—'}</div>
                              </td>
                              <td>
                                <span className="badge" style={{ background: s.bg, color: s.color, fontWeight: 600, fontSize: 11 }}>
                                  {s.label}
                                </span>
                              </td>
                              <td className="font-bold" style={{ fontSize: 13 }}>
                                {formatILS(opp.calculated_value)}
                              </td>
                              <td className="td-muted">{formatDate(opp.updated_at)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex-col gap-4">
                <div className="card">
                  <div className="card-header">
                    <h2 className="card-title">פעולות מהירות</h2>
                  </div>
                  <div className="flex-col gap-2" style={{ padding: '0 20px 20px' }}>
                    <Link href="/opportunities/new" className="btn btn-secondary w-full" style={{ justifyContent: 'center' }}>
                      ➕ הזדמנות חדשה
                    </Link>
                    <Link href="/contacts/new" className="btn btn-secondary w-full" style={{ justifyContent: 'center' }}>
                      👤 איש קשר חדש
                    </Link>
                    <Link href="/organizations/new" className="btn btn-secondary w-full" style={{ justifyContent: 'center' }}>
                      🏢 ארגון חדש
                    </Link>
                    <Link href="/leads" className="btn btn-secondary w-full" style={{ justifyContent: 'center', position: 'relative' }}>
                      📥 לידים נכנסים
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

/* ─── KPI Card Component ─── */
function KpiCard({
  icon, iconBg, iconColor, label, value, sub, href, bigNumber
}: {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  label: string
  value: string
  sub?: string
  href?: string
  bigNumber?: boolean
}) {
  const inner = (
    <div className="kpi-card" style={{ cursor: href ? 'pointer' : 'default', transition: 'box-shadow 0.2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div className="kpi-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </div>
        <div className="kpi-label" style={{ textAlign: 'right', flex: 1, marginRight: 8 }}>{label}</div>
      </div>
      <div>
        <div className="kpi-value" style={{ fontSize: bigNumber ? 36 : 28 }}>{value}</div>
        {sub && <div className="kpi-change" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{sub}</div>}
      </div>
    </div>
  )

  if (href) return <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link>
  return inner
}

/* ─── Icons ─── */
function BellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
}
function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}
function ActivityIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
}
function CheckCircleIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
}
function TrendingIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
}
function FileTextIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
}
function DollarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
}
