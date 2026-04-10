'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function NewOrganizationPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    industry: '',
    employee_count: '',
    website: '',
    company_number: '',
    general_info: '',
  })

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('שם הארגון הוא שדה חובה')
      return
    }
    setLoading(true)
    setError('')

    const { error: sbError } = await supabase.from('organizations').insert({
      name: form.name.trim(),
      industry: form.industry || null,
      employee_count: form.employee_count ? parseInt(form.employee_count) : null,
      website: form.website || null,
      company_number: form.company_number || null,
      general_info: form.general_info || null,
    })

    if (sbError) {
      setError(sbError.message)
      setLoading(false)
      return
    }

    router.push('/organizations')
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="חיפוש..." disabled />
        </div>
      </div>

      <div className="page-body">
        <div className="page-header">
          <div>
            <div className="breadcrumb">
              <Link href="/dashboard">לוח בקרה</Link>
              <span className="breadcrumb-sep">/</span>
              <Link href="/organizations">ארגונים</Link>
              <span className="breadcrumb-sep">/</span>
              <span>ארגון חדש</span>
            </div>
            <h1 className="page-title">הוספת ארגון חדש</h1>
            <p className="page-subtitle">מלא את פרטי הארגון או החברה</p>
          </div>
        </div>

        <div className="card" style={{ maxWidth: 700 }}>
          {/* ── AI Auto-fill (Coming Soon) ── */}
          <div style={{
            background: 'var(--surface-2)',
            border: '1px dashed var(--border-strong)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexDirection: 'row-reverse',
          }}>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                ✨ מילוי אוטומטי באמצעות AI
              </div>
              <div className="text-muted" style={{ marginTop: 2 }}>
                הזן מייל עם דומיין של החברה — ה-AI ימצא את הפרטים אוטומטית
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="email"
                className="form-input"
                placeholder="name@company.com"
                style={{ width: 200, direction: 'ltr' }}
                disabled
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled
                title="בקרוב — חיפוש AI לפי דומיין"
                style={{ opacity: 0.5, cursor: 'not-allowed', whiteSpace: 'nowrap' }}
              >
                🔍 חפש
              </button>
            </div>
          </div>
          {/* TODO: AI Lookup Logic
            1. Extract domain from email (e.g. company.com)
            2. Call Gemini API / Clearbit / Hunter.io with the domain
            3. Auto-fill: name, industry, employee_count, city, website
            API route: /api/org-lookup?domain=company.com
          */}

          <form onSubmit={handleSubmit}>
            {error && <div className="error-box">{error}</div>}

            {/* ── שם ותעשיה ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>שם הארגון <span style={{ color: 'var(--pink)' }}>*</span></label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="לדוגמה: מאנדיי בע״מ"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>תעשייה</label>
                <select
                  className="form-select"
                  value={form.industry}
                  onChange={e => set('industry', e.target.value)}
                >
                  <option value="">— בחר תעשייה —</option>
                  <option value="הייטק ותוכנה">הייטק ותוכנה</option>
                  <option value="בנקאות ופיננסים">בנקאות ופיננסים</option>
                  <option value="תחבורה">תחבורה</option>
                  <option value="ביטוח">ביטוח</option>
                  <option value="נדלן">נדל&quot;ן</option>
                  <option value="בריאות">בריאות ופארמה</option>
                  <option value="קמעונאות">קמעונאות</option>
                  <option value="תקשורת ומדיה">תקשורת ומדיה</option>
                  <option value="תעשייה">תעשייה וייצור</option>
                  <option value="חינוך">חינוך</option>
                  <option value="ממשלה">ממשלה ומוניציפלי</option>
                  <option value="אחר">אחר</option>
                </select>
              </div>
            </div>

            {/* ── עובדים + ח.פ ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>מספר עובדים</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="לדוגמה: 250"
                  value={form.employee_count}
                  onChange={e => set('employee_count', e.target.value)}
                  style={{ direction: 'ltr', textAlign: 'right' }}
                />
              </div>
              <div className="form-group">
                <label>מספר ח.פ / ע.מ</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="לדוגמה: 514213926"
                  value={form.company_number}
                  onChange={e => set('company_number', e.target.value)}
                  style={{ direction: 'ltr', textAlign: 'right' }}
                />
              </div>
            </div>

            {/* ── אתר ── */}
            <div className="form-group">
              <label>אתר אינטרנט</label>
              <input
                className="form-input"
                type="url"
                placeholder="https://company.com"
                value={form.website}
                onChange={e => set('website', e.target.value)}
                style={{ direction: 'ltr', textAlign: 'right' }}
              />
            </div>

            {/* ── הערות ── */}
            <div className="form-group">
              <label>הערות</label>
              <textarea
                className="form-textarea"
                placeholder="מידע נוסף על הארגון, הקשר היסטורי, העדפות..."
                value={form.general_info}
                onChange={e => set('general_info', e.target.value)}
                rows={3}
              />
            </div>

            {/* ── כפתורים ── */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <Link href="/organizations" className="btn btn-secondary">
                ביטול
              </Link>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <span className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} />
                ) : 'שמור ארגון'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
