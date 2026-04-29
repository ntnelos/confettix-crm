'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import GlobalSearchModal from '../GlobalSearchModal'

const navItems = [
  { href: '/dashboard', label: 'לוח בקרה', icon: GridIcon },
  { href: '/leads', label: 'לידים', icon: InboxIcon },
  { href: '/organizations', label: 'ארגונים', icon: BuildingIcon },
  { href: '/contacts', label: 'אנשי קשר', icon: UsersIcon },
  { href: '/opportunities', label: 'הזדמנויות', icon: TrendingIcon },
  { href: '/quotes', label: 'הצעות מחיר', icon: FileTextIcon },
  { href: '/orders', label: 'הזמנות', icon: ShoppingBagIcon },
  { href: '/invoices', label: 'חשבוניות', icon: ReceiptIcon },
  { href: '/inventory', label: 'ניהול מלאי', icon: PackageIcon },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [userName, setUserName] = useState('')
  const [userInitial, setUserInitial] = useState('?')
  const [searchOpen, setSearchOpen] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const name = data.user.user_metadata?.full_name || data.user.email || 'משתמש'
        setUserName(name)
        setUserInitial(name.charAt(0).toUpperCase())
      }
    })
  }, [])

  // Close sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <button className="hamburger-btn" onClick={() => setIsMobileOpen(true)} aria-label="Open menu">
          <MenuIcon />
        </button>
        <div className="mobile-header-logo">
          <img
            src="https://cdn.confettix.co.il/wp-content/uploads/logo-confettix-1.webp?strip=all&lossy=1&ssl=1"
            alt="קונפטיקס"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>
      </div>

      {/* Overlay */}
      <div
        className={`sidebar-overlay ${isMobileOpen ? 'show' : ''}`}
        onClick={() => setIsMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${isMobileOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            {/* Close button for mobile */}
            <button className="hamburger-btn" onClick={() => setIsMobileOpen(false)} style={{ display: 'var(--mobile-close-display, none)' }}>
              <XIcon />
            </button>
            <img
              src="https://cdn.confettix.co.il/wp-content/uploads/logo-confettix-1.webp?strip=all&lossy=1&ssl=1"
              alt="קונפטיקס"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextElementSibling?.setAttribute('style', 'display:flex')
              }}
            />
          </div>
          <span style={{ display: 'none', color: 'var(--pink)', fontWeight: 800, fontSize: 20 }}>
            קונפטיקס
          </span>
          <span className="sidebar-logo-sub">Confettix CRM</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <button
            onClick={() => setSearchOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
              background: 'var(--body-bg)', border: '1px solid var(--border)', borderRadius: '8px',
              color: 'var(--text-secondary)', fontWeight: 500, fontSize: '14px', cursor: 'pointer',
              marginBottom: '16px', width: '100%', outline: 'none', transition: 'box-shadow 0.2s',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
            }}
            className="search-btn-hover"
          >
            <SearchIcon />
            <span>חיפוש מהיר...</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <span style={{ fontSize: 10, background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-muted)' }}>⌘</span>
              <span style={{ fontSize: 10, background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-muted)' }}>K</span>
            </div>
          </button>

          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={pathname.startsWith(href) ? 'active' : ''}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          ))}

          <div className="divider" style={{ margin: '12px 0' }} />
          <span className="sidebar-section-label">הגדרות</span>

          <Link href="/settings" className={pathname.startsWith('/settings') ? 'active' : ''}>
            <SettingsIcon />
            <span>הגדרות</span>
          </Link>
        </nav>

        {/* User */}
        <div className="sidebar-bottom">
          <div className="sidebar-user" onClick={handleLogout} title="התנתק">
            <div className="sidebar-avatar">{userInitial}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{userName || 'משתמש'}</div>
              <div className="sidebar-user-role">לחץ לצאת</div>
            </div>
          </div>
        </div>
        <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        <style dangerouslySetInnerHTML={{
          __html: `
        .search-btn-hover:hover {
          border-color: var(--pink) !important;
          color: var(--pink) !important;
        }
        @media (max-width: 900px) {
          .sidebar-logo .hamburger-btn {
            display: flex !important;
          }
        }
      `}} />
      </aside>
    </>
  )
}

/* ──────────── SVG Icons ──────────── */

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18M6 21V5a2 2 0 012-2h8a2 2 0 012 2v16" />
      <path d="M9 9h1m4 0h1M9 13h1m4 0h1M9 17h1m4 0h1" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function TrendingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}

function FileTextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function ShoppingBagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  )
}

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
    </svg>
  )
}

function InboxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

function PackageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  )
}
