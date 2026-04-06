'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function DashboardPage() {
  const supabase = createClient()
  const [userName, setUserName] = useState('')
  const [greeting, setGreeting] = useState('שלום 👋')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const emailLocalPart = data.user.email?.split('@')[0] || ''
        const name = data.user.user_metadata?.full_name || emailLocalPart
        setUserName(name)
        
        const hour = new Date().getHours()
        if (hour < 12) setGreeting(`בוקר טוב, ${name} ☕`)
        else if (hour < 18) setGreeting(`צהריים טובים, ${name} ☀️`)
        else setGreeting(`ערב טוב, ${name} 🌙`)
      }
    })
  }, [])

  return (
    <>
      <div className="topbar">
        <div className="topbar-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="חיפוש קלפים, ארגונים, אנשי קשר..." />
        </div>
        
        <div className="topbar-actions">
          <button className="topbar-icon-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="page-header">
          <div>
            <h1 className="page-title">{greeting}</h1>
            <p className="page-subtitle">הנה הסיכום היומי שלך למערכת</p>
          </div>
          
          <div className="actions-row">
            <Link href="/opportunities/new" className="btn btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              הזדמנות חדשה
            </Link>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="kpi-icon" style={{ background: 'var(--status-new-bg)', color: 'var(--status-new-text)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div className="kpi-label">הזדמנויות פתוחות</div>
            </div>
            <div>
              <div className="kpi-value">24</div>
              <div className="kpi-change" style={{ color: '#1a8c40' }}>+4 מיום הקודם</div>
            </div>
          </div>

          <div className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="kpi-icon" style={{ background: 'var(--status-won-bg)', color: 'var(--status-won-text)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M16 12l-4-4-4 4M12 8v8" />
                </svg>
              </div>
              <div className="kpi-label">יחס המרה (חודשי)</div>
            </div>
            <div>
              <div className="kpi-value">68%</div>
              <div className="kpi-change" style={{ color: '#1a8c40' }}>+12% מחודש שעבר</div>
            </div>
          </div>

          <div className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="kpi-icon" style={{ background: 'var(--pink-light)', color: 'var(--pink)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
              </div>
              <div className="kpi-label">הכנסות החודש</div>
            </div>
            <div>
              <div className="kpi-value">₪124k</div>
              <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>יעד: ₪150k</div>
            </div>
          </div>

          <div className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="kpi-icon" style={{ background: 'var(--status-followup-bg)', color: 'var(--status-followup-text)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div className="kpi-label">פולו-אפ היום</div>
            </div>
            <div>
              <div className="kpi-value">7</div>
              <div className="kpi-change" style={{ color: '#cc1a1a' }}>2 באיחור</div>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="dashboard-grid">
          {/* Main Column */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">הזדמנויות אחרונות (דוגמה)</h2>
              <button className="btn-ghost" style={{ fontSize: 12 }}>ראה הכל</button>
            </div>
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
                  <tr>
                    <td>
                      <div className="font-bold" style={{ fontSize: 13 }}>מארזי שבועות VIP</div>
                      <div className="td-muted">גוגל ישראל</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>שירה כהן</div>
                    </td>
                    <td><span className="badge badge-new">חדש</span></td>
                    <td className="font-bold">₪45,000</td>
                    <td className="td-muted">היום, 09:30</td>
                  </tr>
                  <tr>
                    <td>
                      <div className="font-bold" style={{ fontSize: 13 }}>מתנות עובדים קיץ</div>
                      <div className="td-muted">Wix</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>דניאל לוי</div>
                    </td>
                    <td><span className="badge badge-followup">מו"מ</span></td>
                    <td className="font-bold">₪12,500</td>
                    <td className="td-muted">אתמול</td>
                  </tr>
                  <tr>
                    <td>
                      <div className="font-bold" style={{ fontSize: 13 }}>מארזי קליטה - New Hire</div>
                      <div className="td-muted">Fiverr</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>נועה אברהם</div>
                    </td>
                    <td><span className="badge badge-won">זכה</span></td>
                    <td className="font-bold">₪8,200</td>
                    <td className="td-muted">לפני יומיים</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="flex-col gap-4">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">פעולות מהירות</h2>
              </div>
              <div className="flex-col gap-2">
                <button className="btn btn-secondary w-full" style={{ justifyContent: 'center' }}>
                  ארגון חדש
                </button>
                <button className="btn btn-secondary w-full" style={{ justifyContent: 'center' }}>
                  איש קשר חדש
                </button>
                <button className="btn btn-secondary w-full" style={{ justifyContent: 'center' }}>
                  הפקת הצעת מחיר
                </button>
              </div>
            </div>

            <div className="card" style={{ flex: 1 }}>
              <div className="card-header">
                <h2 className="card-title">פעילות אחרונה</h2>
              </div>
              <div className="timeline">
                <div className="timeline-item">
                  <div className="timeline-dot" style={{ borderColor: 'var(--status-won-text)' }}></div>
                  <div className="timeline-content">
                    <div className="timeline-title">הזדמנות נסגרה!</div>
                    <div className="timeline-desc">Fiverr אישרו את מארזי הקליטה. שים לב להעביר לביצוע.</div>
                    <div className="timeline-time">לפני שעה</div>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-dot" style={{ borderColor: 'var(--pink)' }}></div>
                  <div className="timeline-content">
                    <div className="timeline-title">הצעת מחיר נשלחה</div>
                    <div className="timeline-desc">נשלחה הצעת מחיר למארזי שבועות עבור גוגל ישראל.</div>
                    <div className="timeline-time">אתמול, 14:30</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
