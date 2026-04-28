'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { compressImage } from '@/lib/compress-image'

export default function NewInventoryItemPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    cost: '',
    description: '',
    image_url: '',
    tags: '',
  })

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: catData } = await (supabase.from('item_categories') as any).select('name').order('name')
      if (catData) {
        setCategories(catData.map((c: any) => c.name))
      }

      const { data: tagData } = await supabase.from('items').select('tags')
      if (tagData) {
        const uniqueTags = Array.from(new Set((tagData as any[]).flatMap(i => i.tags || []))).sort()
        setAllTags(uniqueTags as string[])
      }
    }
    fetchInitialData()
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setUploading(true)
      setError('')
      try {
        // Compress to max 100KB client-side
        const compressed = await compressImage(file, 100)
        const uploadFormData = new FormData()
        uploadFormData.append('file', compressed, 'image.jpg')
        const res = await fetch('/api/upload-image', { method: 'POST', body: uploadFormData })
        const data = await res.json()
        if (data.url) {
          setFormData(prev => ({ ...prev, image_url: data.url }))
        } else {
          setError(`העלאת התמונה נכשלה: ${data.error || 'שגיאה לא ידועה'}`)
        }
      } catch (err: any) {
        setError(`שגיאה בהעלאת התמונה: ${err.message}`)
      } finally {
        setUploading(false)
      }
    }
  }

  const set = (field: string, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }))

  const toggleTag = (tag: string) => {
    const currentTags = formData.tags.split(',').map(t => t.trim()).filter(Boolean)
    if (currentTags.includes(tag)) {
      setFormData(p => ({
        ...p,
        tags: currentTags.filter(t => t !== tag).join(', ')
      }))
    } else {
      setFormData(p => ({
        ...p,
        tags: [...currentTags, tag].join(', ')
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('שם פריט הוא שדה חובה')
      return
    }

    setLoading(true)
    setError('')

    const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(Boolean)

    const categoryName = formData.category.trim() || null

    if (categoryName && !categories.includes(categoryName)) {
      await (supabase.from('item_categories') as any).insert({ name: categoryName })
    }

    const { data, error: sbError } = await (supabase.from('items') as any)
      .insert({
        name: formData.name.trim(),
        category: categoryName,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        description: formData.description.trim() || null,
        image_url: formData.image_url.trim() || null,
        tags: tagsArray.length > 0 ? tagsArray : null,
      })
      .select()
      .single()

    if (sbError) {
      setError(`שגיאה ביצירת פריט: ${sbError.message}`)
      setLoading(false)
      return
    }

    if (data) {
      await (supabase.from('inventory_levels') as any).insert([
        { item_id: data.id, location: 'סטודיו', quantity: 0 },
        { item_id: data.id, location: 'מחסן', quantity: 0 }
      ])

      router.push(`/inventory/${data.id}`)
    }
  }

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
              <Link href="/inventory">ניהול מלאי</Link>
              <span className="breadcrumb-sep">/</span>
              <span>פריט חדש</span>
            </div>
            <h1 className="page-title">הוספת פריט למלאי</h1>
            <p className="page-subtitle">יצירת פריט חדש במערכת</p>
          </div>
        </div>

        <div className="card" style={{ maxWidth: 700 }}>
          <form onSubmit={handleSubmit}>
            {error && <div className="error-box" style={{ marginBottom: 20 }}>{error}</div>}

            <div className="form-group">
              <label>שם הפריט <span style={{ color: 'var(--pink)' }}>*</span></label>
              <input
                className="form-input"
                type="text"
                placeholder="למשל: עששית זכוכית שקופה"
                value={formData.name}
                onChange={e => set('name', e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>קטגוריה</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="בחר או הקלד חדשה..."
                  list="categories-list"
                  value={formData.category}
                  onChange={e => set('category', e.target.value)}
                />
                <datalist id="categories-list">
                  {categories.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <label>תגיות</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="מופרדות בפסיק (חנוכה, שביר...)"
                  value={formData.tags}
                  onChange={e => set('tags', e.target.value)}
                />
                {allTags.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: '100%', marginBottom: 2 }}>תגיות קיימות:</span>
                    {allTags.map(tag => {
                      const isSelected = formData.tags.split(',').map(t => t.trim()).includes(tag)
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            border: '1px solid',
                            background: isSelected ? 'var(--pink)' : 'var(--surface-2)',
                            color: isSelected ? '#fff' : 'var(--text-secondary)',
                            borderColor: isSelected ? 'var(--pink)' : 'var(--border)'
                          }}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>עלות פריט (₪)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="עלות הקנייה (לא חובה)"
                  value={formData.cost}
                  onChange={e => set('cost', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>העלאת תמונה (מהמחשב או צילום בנייד)</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ padding: '8px', cursor: 'pointer' }}
                  disabled={uploading}
                />
                {uploading && (
                  <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="spinner" style={{ width: 16, height: 16, borderTopColor: 'var(--pink)' }} />
                    <span style={{ fontSize: 12, color: 'var(--pink)' }}>מעלה לאחסון...</span>
                  </div>
                )}
              </div>

              {formData.image_url && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, padding: 10, background: 'var(--surface-2)', borderRadius: 8 }}>
                  <img src={formData.image_url} alt="Preview" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
                  <div style={{ fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: 'green' }}>✓ התמונה הועלתה לאחסון</div>
                    <div className="truncate" style={{ maxWidth: 250, opacity: 0.7 }}>{formData.image_url}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>תיאור</label>
              <textarea
                className="form-textarea"
                placeholder="פרטים נוספים על הפריט..."
                value={formData.description}
                onChange={e => set('description', e.target.value)}
                rows={4}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <Link href="/inventory" className="btn btn-secondary">
                ביטול
              </Link>
              <button type="submit" className="btn btn-primary" disabled={loading || uploading}>
                {loading ? (
                  <span className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} />
                ) : 'שמור פריט'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
