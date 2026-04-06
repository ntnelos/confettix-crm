'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [successMsg, setSuccessMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('אימייל או סיסמה שגויים')
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
    } else {
      setSuccessMsg('בקשת הרשמה נשלחה. המתן לאישור מנהל המערכת.')
    }
    setLoading(false)
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setError(error.message)
    } else {
      setSuccessMsg('אם האימייל קיים במערכת, ישלח אליך קישור לאיפוס סיסמה.')
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <img
            src="https://cdn.confettix.co.il/wp-content/uploads/logo-confettix-1.webp?strip=all&lossy=1&ssl=1"
            alt="קונפטיקס"
            style={{ height: 44 }}
            onError={(e) => {
              const el = e.currentTarget
              el.style.display = 'none'
              const span = document.createElement('span')
              span.textContent = 'קונפטיקס'
              span.style.cssText = 'color:var(--pink);font-weight:800;font-size:22px;'
              el.parentElement?.appendChild(span)
            }}
          />
        </div>

        {mode === 'login' && (
          <>
            <h1 className="auth-title">ברוכים הבאים 👋</h1>
            <p className="auth-subtitle">הזן את פרטי ההתחברות שלך כדי להמשיך</p>
            {error && <div className="error-box">{error}</div>}
            {successMsg && <div className="success-box">{successMsg}</div>}
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="email">דואר אלקטרוני</label>
                <input
                  id="email" type="email" className="form-input"
                  placeholder="you@example.com" value={email}
                  onChange={e => setEmail(e.target.value)} required
                />
              </div>
              <div className="form-group">
                <div>

                  <label htmlFor="password">סיסמה</label>
                </div>
                <input
                  id="password" type="password" className="form-input"
                  placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} required
                />
                <button type="button" className="btn-ghost btn-sm"
                  style={{ color: 'var(--pink)', padding: '0', fontSize: 12 }}
                  onClick={() => setMode('forgot')}>
                  שכחת סיסמה?
                </button>
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={loading}
                style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'התחברות'}
              </button>
            </form>
            <div className="auth-footer">
              <div style={{ marginBottom: 8, color: 'var(--text-muted)', fontSize: 12 }}>— או —</div>
              <button className="btn btn-secondary w-full"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => { setMode('register'); setError(''); setSuccessMsg('') }}>
                הרשמה
              </button>
            </div>
          </>
        )}

        {mode === 'register' && (
          <>
            <h1 className="auth-title">הרשמה למערכת</h1>
            <p className="auth-subtitle">לאחר ההרשמה, המנהל יאשר את גישתך</p>
            {error && <div className="error-box">{error}</div>}
            {successMsg && <div className="success-box">{successMsg}</div>}
            {!successMsg && (
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label htmlFor="reg-email">דואר אלקטרוני</label>
                  <input id="reg-email" type="email" className="form-input"
                    placeholder="you@example.com" value={email}
                    onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="reg-password">סיסמה</label>
                  <input id="reg-password" type="password" className="form-input"
                    placeholder="לפחות 8 תווים" value={password}
                    onChange={e => setPassword(e.target.value)} required minLength={8} />
                </div>
                <button type="submit" className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
                  {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'שלח בקשת הרשמה'}
                </button>
              </form>
            )}
            <div className="auth-footer">
              <button className="btn-ghost" style={{ color: 'var(--pink)', fontSize: 13 }}
                onClick={() => { setMode('login'); setError(''); setSuccessMsg('') }}>
                ← חזרה להתחברות
              </button>
            </div>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <h1 className="auth-title">איפוס סיסמה</h1>
            <p className="auth-subtitle">הזן את האימייל שלך ונשלח לך קישור לאיפוס</p>
            {error && <div className="error-box">{error}</div>}
            {successMsg && <div className="success-box">{successMsg}</div>}
            {!successMsg && (
              <form onSubmit={handleForgot}>
                <div className="form-group">
                  <label htmlFor="forgot-email">דואר אלקטרוני</label>
                  <input id="forgot-email" type="email" className="form-input"
                    placeholder="you@example.com" value={email}
                    onChange={e => setEmail(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
                  {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'שלח קישור'}
                </button>
              </form>
            )}
            <div className="auth-footer">
              <button className="btn-ghost" style={{ color: 'var(--pink)', fontSize: 13 }}
                onClick={() => { setMode('login'); setError(''); setSuccessMsg('') }}>
                ← חזרה להתחברות
              </button>
            </div>
          </>
        )}

        <p style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 20 }}>
          Confettix CRM
        </p>
      </div>
    </div>
  )
}
