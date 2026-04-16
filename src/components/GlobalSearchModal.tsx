'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface GlobalSearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('')
  const [module, setModule] = useState('all')
  const [results, setResults] = useState({ contacts: [], organizations: [], opportunities: [] })
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setQuery('')
      setResults({ contacts: [], organizations: [], opportunities: [] })
    }
  }, [isOpen])

  // Handle ESC key listener globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!query || query.trim().length === 0) {
      setResults({ contacts: [], organizations: [], opportunities: [] })
      setLoading(false)
      return
    }

    const searchStr = `%${query.trim()}%`
    let isMounted = true

    const fetchResults = async () => {
      setLoading(true)
      const fetches = []

      if (module === 'all' || module === 'contacts') {
        fetches.push(
          supabase.from('contacts').select('id, name, email').ilike('name', searchStr).limit(5).then(({ data }) => ({ type: 'contacts', data: data || [] }))
        )
      }
      if (module === 'all' || module === 'organizations') {
        fetches.push(
          supabase.from('organizations').select('id, name').ilike('name', searchStr).limit(5).then(({ data }) => ({ type: 'organizations', data: data || [] }))
        )
      }
      if (module === 'all' || module === 'opportunities') {
        fetches.push(
          supabase.from('opportunities').select('id, subject').ilike('subject', searchStr).limit(5).then(({ data }) => ({ type: 'opportunities', data: data || [] }))
        )
      }

      const res = await Promise.all(fetches)

      if (!isMounted) return

      const newResults = { contacts: [], organizations: [], opportunities: [] }
      res.forEach(r => {
        (newResults as any)[r.type] = r.data
      })

      setResults(newResults)
      setLoading(false)
    }

    const timer = setTimeout(() => {
      fetchResults()
    }, 400)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [query, module])

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(11, 21, 54, 0.4)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '10vh'
    }} onClick={onClose}>
      <div
        style={{
          width: '90%', maxWidth: 700, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'white'
        }}>
          <div style={{ position: 'relative', borderLeft: '1px solid var(--border-light)', display: 'flex', alignItems: 'center' }}>
            <select
              value={module}
              onChange={e => setModule(e.target.value)}
              style={{
                padding: '18px 36px 18px 20px', border: 'none', background: 'transparent', outline: 'none',
                fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)',
                appearance: 'none', cursor: 'pointer', minWidth: 140
              }}
            >
              <option value="all">כל המודולים</option>
              <option value="contacts">אנשי קשר</option>
              <option value="organizations">ארגונים</option>
              <option value="opportunities">הזדמנויות</option>
            </select>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, position: 'absolute', left: 16, pointerEvents: 'none', color: 'var(--text-muted)' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: 20 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18, color: 'var(--text-muted)', marginLeft: 12 }}>
              <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="חפש במערכת..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                flex: 1, padding: '18px 0', border: 'none', background: 'transparent', outline: 'none',
                fontSize: 16, color: 'var(--text-primary)'
              }}
            />
            {loading && <div className="spinner" style={{ width: 18, height: 18, borderTopColor: 'var(--pink)', marginLeft: 20 }}></div>}
          </div>
        </div>

        <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          {!query && (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ width: 48, height: 48, margin: '0 auto 16px', opacity: 0.3 }}>
                <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-secondary)' }}>חיפוש מהיר</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>הקלד לחיפוש אנשי קשר, ארגונים והזדמנויות.</div>
            </div>
          )}

          {query && !loading && Object.values(results).every(arr => arr.length === 0) && (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              לא מצאנו תוצאות עבור הצרוף "<strong>{query}</strong>" {(module !== 'all') ? 'במודול הנבחר' : ''}.
            </div>
          )}

          {results.contacts.length > 0 && (
            <div>
              <div style={{ padding: '8px 20px', background: 'var(--surface-2)', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' }}>
                אנשי קשר
              </div>
              {results.contacts.map((c: any) => (
                <Link key={c.id} href={`/contacts/${c.id}`} onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', textDecoration: 'none', background: 'white', borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }} className="search-result-item">
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(230,0,126,0.1)', color: 'var(--pink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{c.name}</div>
                    {c.email && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.email}</div>}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {results.organizations.length > 0 && (
            <div>
              <div style={{ padding: '8px 20px', background: 'var(--surface-2)', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', borderTop: (results.contacts.length > 0) ? '1px solid var(--border)' : 'none', borderBottom: '1px solid var(--border-light)' }}>
                ארגונים
              </div>
              {results.organizations.map((o: any) => (
                <Link key={o.id} href={`/organizations/${o.id}`} onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', textDecoration: 'none', background: 'white', borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }} className="search-result-item">
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f8fafc', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                      <path d="M3 21h18M6 21V5a2 2 0 012-2h8a2 2 0 012 2v16" />
                    </svg>
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{o.name}</div>
                </Link>
              ))}
            </div>
          )}

          {results.opportunities.length > 0 && (
            <div>
              <div style={{ padding: '8px 20px', background: 'var(--surface-2)', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', borderTop: (results.contacts.length > 0 || results.organizations.length > 0) ? '1px solid var(--border)' : 'none', borderBottom: '1px solid var(--border-light)' }}>
                הזדמנויות
              </div>
              {results.opportunities.map((opp: any) => (
                <Link key={opp.id} href={`/opportunities/${opp.id}`} onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', textDecoration: 'none', background: 'white', borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }} className="search-result-item">
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    </svg>
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{opp.subject}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{
        __html: `
        .search-result-item:hover {
          background: #f8fafc !important;
        }
      `}} />
    </div>
  )
}
