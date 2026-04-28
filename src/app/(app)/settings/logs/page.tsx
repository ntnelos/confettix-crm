'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LogsPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (data) setLogs(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  return (
    <>
      <div className="topbar">
        <div />
      </div>
      <div className="page-body">
        <div style={{ padding: '0 20px', maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Link href="/settings" style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>→</span>
              <span>חזרה להגדרות</span>
            </Link>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>ניהול לוגים</h1>
          </div>

          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>לוגי מערכת אחרונים (100)</h2>
              <button className="btn btn-secondary" onClick={fetchLogs}>רענן</button>
            </div>
            <div style={{ padding: 20 }}>
              {loading ? (
                 <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" style={{ width: 30, height: 30, borderTopColor: 'var(--pink)' }} /></div>
              ) : logs.length === 0 ? (
                 <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>אין לוגים במערכת</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: 13 }}>
                        <th style={{ padding: '12px 8px' }}>תאריך ושעה</th>
                        <th style={{ padding: '12px 8px' }}>רמה</th>
                        <th style={{ padding: '12px 8px' }}>שירות</th>
                        <th style={{ padding: '12px 8px' }}>הודעה</th>
                        <th style={{ padding: '12px 8px' }}>פרטים נוספים</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(log => (
                        <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)', fontSize: 14 }}>
                          <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                            <div dir="ltr" style={{ display: 'inline-block', textAlign: 'right' }}>
                              {new Date(log.created_at).toLocaleString('he-IL')}
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <span style={{ 
                              padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                              background: log.level === 'error' ? '#fee2e2' : log.level === 'warn' ? '#fef3c7' : '#e0e7ff',
                              color: log.level === 'error' ? '#ef4444' : log.level === 'warn' ? '#d97706' : '#4f46e5'
                            }}>
                              {log.level.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{log.service}</td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ fontWeight: 600 }}>{log.message}</div>
                            {log.details?.errorCode && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                קוד שגיאה: <span dir="ltr">{log.details.errorCode}</span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            {log.details && (
                              <details>
                                <summary style={{ cursor: 'pointer', color: 'var(--blue)', fontSize: 13, userSelect: 'none' }}>הצג JSON</summary>
                                <pre dir="ltr" style={{ 
                                  background: 'var(--surface-2)', padding: 12, borderRadius: 8, fontSize: 12, 
                                  marginTop: 8, overflowX: 'auto', maxWidth: 500 
                                }}>
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </details>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
