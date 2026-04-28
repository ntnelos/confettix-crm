'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Database } from '@/types/supabase'

type Item = Database['public']['Tables']['items']['Row']
type InventoryLevel = Database['public']['Tables']['inventory_levels']['Row']

interface ItemWithLevels extends Item {
  inventory_levels: InventoryLevel[]
  total_quantity: number
}

export default function InventoryPage() {
  const supabase = createClient()
  const [items, setItems] = useState<ItemWithLevels[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Advanced Filters
  const [showFilters, setShowFilters] = useState(false)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minQty, setMinQty] = useState('')
  const [maxQty, setMaxQty] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  // Options for filters
  const [allCategories, setAllCategories] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])

  useEffect(() => {
    const fetchOptions = async () => {
      const { data: catData } = await supabase.from('item_categories').select('name')
      if (catData) setAllCategories((catData as any[]).map(c => c.name))

      const { data: tagData } = await supabase.from('items').select('tags')
      if (tagData) {
        const uniqueTags = Array.from(new Set((tagData as any[]).flatMap(i => i.tags || []))).sort()
        setAllTags(uniqueTags as string[])
      }
    }
    fetchOptions()
  }, [])

  const fetchItems = async () => {
    setLoading(true)
    let dbQuery = supabase
      .from('items')
      .select('*, inventory_levels(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(100)

    if (search) {
      dbQuery = dbQuery.or(`name.ilike.%${search}%,category.ilike.%${search}%`)
    }
    if (categoryFilter) {
      dbQuery = dbQuery.eq('category', categoryFilter)
    }
    if (tagFilter) {
      dbQuery = dbQuery.contains('tags', [tagFilter])
    }
    if (minPrice) {
      dbQuery = dbQuery.gte('cost', parseFloat(minPrice))
    }
    if (maxPrice) {
      dbQuery = dbQuery.lte('cost', parseFloat(maxPrice))
    }

    const { data, error, count } = await dbQuery

    if (count !== null) setTotalCount(count)

    if (!error && data) {
      let mapped = data.map((item: any) => ({
        ...item,
        total_quantity: item.inventory_levels.reduce((acc: number, level: any) => acc + (level.quantity || 0), 0)
      }))

      // Local filtering for computed quantity
      if (minQty) mapped = mapped.filter(item => item.total_quantity >= parseInt(minQty))
      if (maxQty) mapped = mapped.filter(item => item.total_quantity <= parseInt(maxQty))

      setItems(mapped)
    }
    setLoading(false)
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchItems()
    }, 300)
    return () => clearTimeout(handler)
  }, [search, categoryFilter, tagFilter, minPrice, maxPrice, minQty, maxQty])

  const filtered = items

  const handleDeleteItem = async (id: string, name: string) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את הפריט "${name}" לצמיתות?`)) return

    const { error } = await supabase.from('items').delete().eq('id', id)
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== id))
    } else {
      alert(`שגיאה במחיקת הפריט: ${error.message}`)
    }
  }

  // Inline Editing State
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: '',
    category: '',
    tags: '',
    cost: ''
  })
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const startInlineEdit = (item: ItemWithLevels) => {
    setEditingItemId(item.id)
    setEditFormData({
      name: item.name || '',
      category: item.category || '',
      tags: item.tags ? item.tags.join(', ') : '',
      cost: item.cost != null ? item.cost.toString() : ''
    })
  }

  const cancelInlineEdit = () => {
    setEditingItemId(null)
  }

  const handleSaveInlineEdit = async (id: string) => {
    setIsSavingEdit(true)
    const categoryName = editFormData.category.trim() || null
    if (categoryName && !allCategories.includes(categoryName)) {
      await (supabase.from('item_categories') as any).insert({ name: categoryName })
      setAllCategories(prev => [...prev, categoryName])
    }
    const tagsArray = editFormData.tags.split(',').map(t => t.trim()).filter(Boolean)
    
    const { error } = await (supabase.from('items') as any).update({
      name: editFormData.name.trim(),
      category: categoryName,
      cost: editFormData.cost ? parseFloat(editFormData.cost) : null,
      tags: tagsArray.length > 0 ? tagsArray : null,
    }).eq('id', id)

    if (error) {
      alert(`שגיאה בעדכון הפריט: ${error.message}`)
    } else {
      // Update local state
      setItems(prev => prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            name: editFormData.name.trim(),
            category: categoryName,
            cost: editFormData.cost ? parseFloat(editFormData.cost) : null,
            tags: tagsArray.length > 0 ? tagsArray : null,
          }
        }
        return item
      }))
      setEditingItemId(null)
    }
    setIsSavingEdit(false)
  }

  const handlePrintCatalog = () => {
    const printWindow = window.open('', '', 'width=900,height=800')
    if (!printWindow) return

    // Build items HTML using safe string concatenation (no nested template literals)
    const itemsHtml = filtered.map(item => {
      const imgHtml = item.image_url
        ? '<img src="' + item.image_url + '" alt="' + item.name + '" />'
        : '<div class="placeholder">&#128230;</div>'
      return (
        '<div class="item">' +
          '<div class="img-wrapper">' + imgHtml + '</div>' +
          '<div class="details">' +
            '<h2 class="name">' + item.name + '</h2>' +
            '<div class="stat-row"><span>\u05db\u05de\u05d5\u05ea \u05d1\u05de\u05dc\u05d0\u05d9:</span><strong>' + item.total_quantity + '</strong></div>' +
            '<div class="stat-row"><span>\u05e2\u05dc\u05d5\u05ea \u05d9\u05d7\u05d9\u05d3\u05d4:</span><strong>&#8362;' + (item.cost || 0) + '</strong></div>' +
          '</div>' +
        '</div>'
      )
    }).join('')

    const date = new Date().toLocaleDateString('he-IL')
    const count = filtered.length

    const css = (
      'body{font-family:system-ui,-apple-system,sans-serif;padding:40px;margin:0;color:#111;}' +
      '.header{text-align:center;margin-bottom:40px;border-bottom:2px solid #f0f0f0;padding-bottom:20px;}' +
      '.header h1{margin:0 0 10px;font-size:28px;font-weight:700;}' +
      '.header p{margin:0;color:#666;font-size:15px;}' +
      '.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;}' +
      '.item{display:flex;gap:20px;border:1px solid #e5e7eb;padding:20px;border-radius:12px;page-break-inside:avoid;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.06);}' +
      '.img-wrapper{width:110px;height:110px;border-radius:10px;overflow:hidden;background:#f9fafb;flex-shrink:0;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;}' +
      '.img-wrapper img{width:100%;height:100%;object-fit:cover;}' +
      '.placeholder{font-size:36px;opacity:0.2;}' +
      '.details{flex:1;display:flex;flex-direction:column;justify-content:center;gap:8px;}' +
      '.name{font-size:20px;font-weight:700;margin:0 0 8px;line-height:1.3;color:#111;}' +
      '.stat-row{display:flex;justify-content:space-between;align-items:center;font-size:15px;color:#555;background:#f9fafb;padding:7px 12px;border-radius:7px;}' +
      '.stat-row strong{color:#111;font-size:17px;font-weight:600;}' +
      '@media print{body{padding:20px;}@page{margin:15mm;}.grid{gap:16px;}.item{box-shadow:none;border:1px solid #ccc;}}'
    )

    const html = (
      '<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">' +
      '<title>\u05e7\u05d8\u05dc\u05d5\u05d2 \u05e4\u05e8\u05d9\u05d8\u05d9\u05dd</title>' +
      '<style>' + css + '</style></head><body>' +
      '<div class="header">' +
        '<h1>\u05e7\u05d8\u05dc\u05d5\u05d2 \u05e4\u05e8\u05d9\u05d8\u05d9\u05dd</h1>' +
        '<p>\u05d4\u05d5\u05e4\u05e7 \u05d1\u05ea\u05d0\u05e8\u05d9\u05da: ' + date + ' &bull; \u05de\u05e6\u05d9\u05d2 ' + count + ' \u05e4\u05e8\u05d9\u05d8\u05d9\u05dd</p>' +
      '</div>' +
      '<div class="grid">' + itemsHtml + '</div>' +
      '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print();},600);};</' + 'script>' +
      '</body></html>'
    )

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <>
      <div className="topbar">
        <div />
        <div className="topbar-actions">
          <button className="topbar-icon-btn"><BellIcon /></button>
        </div>
      </div>

      <div className="page-body">
        <div className="page-header flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="breadcrumb">
              <Link href="/dashboard">לוח בקרה</Link>
              <span className="breadcrumb-sep">/</span>
              <span>ניהול מלאי</span>
            </div>
            <h1 className="page-title">ניהול מלאי</h1>
            <p className="page-subtitle">מעקב אחר פריטים, כמויות ומיקומים</p>
          </div>
          <div className="actions-row">
            <Link href="/inventory/new" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 13, gap: 6 }}>
              <PlusIcon />
              הוסף פריט
            </Link>
          </div>
        </div>

        <div className="table-container">
          <div className="table-toolbar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div className="search-field" style={{ flex: 1, minWidth: 280 }}>
                <SearchIcon />
                <input
                  type="text"
                  placeholder="חיפוש מהיר לפי שם או קטגוריה..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px 10px 40px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="text-muted" style={{ fontSize: 13 }}>
                  {(search || showFilters)
                    ? `${filtered.length} תוצאות מתוך ${totalCount} פריטים`
                    : `סה"כ ${totalCount} פריטים`
                  }
                </div>
                <button
                  className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setShowFilters(!showFilters)}
                  style={{ fontSize: 13, padding: '8px 12px' }}
                >
                  <FilterIcon /> {showFilters ? 'הסתר סינון' : 'סינון מתקדם'}
                </button>
              </div>
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
              <div style={{ marginTop: 16, padding: 16, background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                  {/* Category Filter */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 500 }}>קטגוריה</label>
                    <select className="form-input" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ padding: '8px' }}>
                      <option value="">כל הקטגוריות</option>
                      {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {/* Tags Filter */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 500 }}>תגית</label>
                    <select className="form-input" value={tagFilter} onChange={e => setTagFilter(e.target.value)} style={{ padding: '8px' }}>
                      <option value="">כל התגיות</option>
                      {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  {/* Price Range */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 500 }}>טווח עלות (₪)</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="number" className="form-input" placeholder="מ-" value={minPrice} onChange={e => setMinPrice(e.target.value)} style={{ padding: '8px' }} />
                      <input type="number" className="form-input" placeholder="עד" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} style={{ padding: '8px' }} />
                    </div>
                  </div>
                  {/* Quantity Range */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 500 }}>כמות במלאי</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="number" className="form-input" placeholder="מ-" value={minQty} onChange={e => setMinQty(e.target.value)} style={{ padding: '8px' }} />
                      <input type="number" className="form-input" placeholder="עד" value={maxQty} onChange={e => setMaxQty(e.target.value)} style={{ padding: '8px' }} />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                  <button
                    onClick={handlePrintCatalog}
                    style={{ fontSize: 13, padding: '8px 18px', background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600 }}
                  >
                    <DownloadIcon /> ייצוא קטלוג PDF ({filtered.length} פריטים)
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => { setCategoryFilter(''); setTagFilter(''); setMinPrice(''); setMaxPrice(''); setMinQty(''); setMaxQty(''); }}
                    style={{ fontSize: 12, padding: '4px 12px' }}
                  >
                    נקה סינונים
                  </button>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <span className="spinner" style={{ width: 28, height: 28 }} />
            </div>
          ) : items.length === 0 && !search ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px', boxShadow: 'none', border: 'none', background: 'transparent' }}>
              <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.4 }}>📦</div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
                אין פריטים עדיין
              </h2>
              <p className="text-muted" style={{ marginBottom: 20 }}>הוסף את הפריט הראשון למלאי כדי להתחיל</p>
              <Link href="/inventory/new" className="btn btn-primary">הוסף פריט</Link>
            </div>
          ) : (
            <>
              {/* ── Mobile card list ── */}
              <div className="mobile-card-list">
                {filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    לא נמצאו תוצאות עבור &quot;{search}&quot;
                  </div>
                ) : filtered.map(item => (
                  <div key={item.id} className="mobile-item-card">
                    {/* Left: action buttons */}
                    <div className="mobile-card-actions">
                      <Link href={`/inventory/${item.id}`} className="btn-icon" title="צפה בפרטים">
                        <EyeIcon />
                      </Link>
                      <button onClick={() => handleDeleteItem(item.id, item.name)} className="btn-icon" title="מחק" style={{ color: 'var(--pink)' }}>
                        <TrashIcon />
                      </button>
                    </div>
                    {/* Center: details */}
                    <div className="mobile-card-details">
                      <Link href={`/inventory/${item.id}`} className="mobile-card-name">
                        {item.name}
                      </Link>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        {item.category && (
                          <span className="badge badge-gray">{item.category}</span>
                        )}
                        {item.cost != null && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--pink)' }}>₪{item.cost.toFixed(2)}</span>
                        )}
                      </div>
                      {item.tags && item.tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                          {item.tags.map((t: string) => (
                            <span key={t} style={{ fontSize: 10, padding: '1px 6px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)' }}>{t}</span>
                          ))}
                        </div>
                      )}
                      <div className="mobile-card-qty">
                        במלאי: <strong style={{ color: item.total_quantity > 0 ? 'var(--green, #16a34a)' : 'var(--pink)' }}>{item.total_quantity}</strong>
                      </div>
                    </div>
                    {/* Right: image */}
                    <div className="mobile-card-img">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 26, opacity: 0.3 }}>📦</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Desktop table ── */}
              <div className="desktop-table overflow-x-auto">
              <table className="w-full text-right border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="py-3 px-4 text-sm font-medium text-gray-500">תמונה</th>
                    <th className="py-3 px-4 text-sm font-medium text-gray-500">שם פריט</th>
                    <th className="py-3 px-4 text-sm font-medium text-gray-500">קטגוריה</th>
                    <th className="py-3 px-4 text-sm font-medium text-gray-500">תגיות</th>
                    <th className="py-3 px-4 text-sm font-medium text-gray-500">עלות</th>
                    <th className="py-3 px-4 text-sm font-medium text-gray-500">כמות במלאי</th>
                    <th className="py-3 px-4 text-sm font-medium text-gray-500">מיקומים</th>
                    <th className="py-3 px-4 text-sm font-medium text-gray-500">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                        לא נמצאו תוצאות עבור &quot;{search}&quot;
                      </td>
                    </tr>
                  ) : (
                    filtered.map(item => (
                      <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                        <td className="py-3 px-4">
                          <div style={{ width: 44, height: 44, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: 18, opacity: 0.4 }}>📦</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {editingItemId === item.id ? (
                            <input
                              className="form-input text-sm"
                              style={{ width: '100%', minWidth: 120, padding: '4px 8px' }}
                              value={editFormData.name}
                              onChange={e => setEditFormData(p => ({ ...p, name: e.target.value }))}
                            />
                          ) : (
                            <>
                              <Link
                                href={`/inventory/${item.id}`}
                                className="font-bold text-pink hover:underline"
                                style={{ fontSize: 14 }}
                              >
                                {item.name}
                              </Link>
                              {item.description && (
                                <div className="text-muted text-xs truncate max-w-[200px] mt-1">{item.description}</div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {editingItemId === item.id ? (
                            <input
                              className="form-input text-sm"
                              list="inline-cats"
                              style={{ width: '100%', minWidth: 100, padding: '4px 8px' }}
                              value={editFormData.category}
                              onChange={e => setEditFormData(p => ({ ...p, category: e.target.value }))}
                            />
                          ) : (
                            item.category
                              ? <span className="badge badge-gray">{item.category}</span>
                              : <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {editingItemId === item.id ? (
                            <div className="flex flex-col gap-2" style={{ minWidth: 150 }}>
                              <input
                                className="form-input text-sm"
                                placeholder="מופרד בפסיקים"
                                style={{ width: '100%', padding: '4px 8px' }}
                                value={editFormData.tags}
                                onChange={e => setEditFormData(p => ({ ...p, tags: e.target.value }))}
                              />
                              {allTags.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 80, overflowY: 'auto' }}>
                                  {allTags.map(t => {
                                    const currentTags = editFormData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
                                    const isActive = currentTags.includes(t)
                                    return (
                                      <button
                                        key={t}
                                        type="button"
                                        onClick={() => {
                                          if (isActive) {
                                            setEditFormData(p => ({ ...p, tags: currentTags.filter(tag => tag !== t).join(', ') }))
                                          } else {
                                            setEditFormData(p => ({ ...p, tags: currentTags.length > 0 ? `${currentTags.join(', ')}, ${t}` : t }))
                                          }
                                        }}
                                        style={{
                                          fontSize: 10,
                                          padding: '2px 6px',
                                          borderRadius: 12,
                                          cursor: 'pointer',
                                          border: isActive ? '1px solid var(--pink)' : '1px solid var(--border)',
                                          background: isActive ? 'var(--pink)' : 'var(--surface-2)',
                                          color: isActive ? '#fff' : 'var(--text-secondary)'
                                        }}
                                      >
                                        {t}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 150 }}>
                              {item.tags && item.tags.length > 0 ? (
                                item.tags.map((t: string) => (
                                  <span key={t} style={{ fontSize: 10, padding: '2px 6px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-secondary)' }}>
                                    {t}
                                  </span>
                                ))
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {editingItemId === item.id ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="form-input text-sm"
                              style={{ width: '100%', minWidth: 60, padding: '4px 8px' }}
                              value={editFormData.cost}
                              onChange={e => setEditFormData(p => ({ ...p, cost: e.target.value }))}
                            />
                          ) : (
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                              {item.cost != null ? `₪${item.cost.toFixed(2)}` : '—'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`font-medium ${item.total_quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {item.total_quantity}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1">
                            {item.inventory_levels.length > 0 ? (
                              item.inventory_levels.map(l => (
                                <span key={l.id} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full inline-block w-max">
                                  {l.location}: <b>{l.quantity}</b>
                                </span>
                              ))
                            ) : (
                              <span className="text-muted text-xs">—</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {editingItemId === item.id ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSaveInlineEdit(item.id)}
                                disabled={isSavingEdit}
                                className="btn btn-primary"
                                style={{ padding: '4px 10px', fontSize: 12 }}
                              >
                                {isSavingEdit ? '...' : 'שמור'}
                              </button>
                              <button
                                onClick={cancelInlineEdit}
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: 12 }}
                              >
                                ביטול
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button onClick={() => startInlineEdit(item)} className="btn-icon" title="ערוך">
                                <EditIcon />
                              </button>
                              <Link href={`/inventory/${item.id}`} className="btn-icon" title="צפה בפרטים">
                                <EyeIcon />
                              </Link>
                              <button onClick={() => handleDeleteItem(item.id, item.name)} className="btn-icon" title="מחק" style={{ color: 'var(--pink)' }}>
                                <TrashIcon />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile grid view overrides for table */}
      <style dangerouslySetInnerHTML={{__html: `
        /* ── Mobile card list ── */
        .mobile-card-list { display: none; flex-direction: column; gap: 10px; padding: 8px 0; }
        .desktop-table { display: block; }

        .mobile-item-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px 12px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .mobile-card-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .mobile-card-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          text-align: right;
        }
        .mobile-card-name {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          text-decoration: none;
          line-height: 1.3;
        }
        .mobile-card-name:hover { color: var(--pink); }
        .mobile-card-qty {
          font-size: 14px;
          color: var(--text-secondary);
          margin-top: 4px;
        }
        .mobile-card-img {
          width: 80px;
          height: 80px;
          border-radius: 10px;
          overflow: hidden;
          background: var(--surface-2);
          border: 1px solid var(--border);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media (max-width: 768px) {
          .mobile-card-list { display: flex; }
          .desktop-table { display: none; }
          .table-toolbar { flex-direction: column; align-items: stretch; }
        }
      `}} />

      <datalist id="inline-cats">
        {allCategories.map(c => <option key={c} value={c} />)}
      </datalist>
    </>
  )
}

/* ──────────── Icons ──────────── */
function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
}
function BellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
}
function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}
function EyeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
}
function TrashIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
}
function EditIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
}
function FilterIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
}
function DownloadIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
}
