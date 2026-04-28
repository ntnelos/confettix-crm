'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Database } from '@/types/supabase'
import { compressImage } from '@/lib/compress-image'

type Item = Database['public']['Tables']['items']['Row']
type InventoryLevel = Database['public']['Tables']['inventory_levels']['Row']
type InventoryLog = Database['public']['Tables']['inventory_logs']['Row'] & {
  user?: { full_name?: string; email?: string }
  inventory_level?: InventoryLevel
}

interface ItemWithDetails extends Item {
  inventory_levels: InventoryLevel[]
}

export default function InventoryItemPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [item, setItem] = useState<ItemWithDetails | null>(null)
  const [logs, setLogs] = useState<InventoryLog[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingImage, setDeletingImage] = useState(false)
  const [error, setError] = useState('')
  const [editingDetails, setEditingDetails] = useState(false)
  const [savingDetails, setSavingDetails] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  
  const [allTags, setAllTags] = useState<string[]>([])
  const [showAddLocationModal, setShowAddLocationModal] = useState(false)
  const [allLocations, setAllLocations] = useState<any[]>([])
  const [selectedNewLocation, setSelectedNewLocation] = useState('')
  const [isAddingLocation, setIsAddingLocation] = useState(false)
  
  // Modal states
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedLevelId, setSelectedLevelId] = useState<string>('')
  const [categories, setCategories] = useState<string[]>([])
  
  // Form states
  const [adjustAmount, setAdjustAmount] = useState<number>(1)
  const [adjustType, setAdjustType] = useState<'ADD' | 'REMOVE'>('ADD')
  const [adjustNotes, setAdjustNotes] = useState('')
  
  const [transferAmount, setTransferAmount] = useState<number>(1)
  const [transferFromId, setTransferFromId] = useState<string>('')
  const [transferToId, setTransferToId] = useState<string>('')
  const [transferNotes, setTransferNotes] = useState('')

  const [editFormData, setEditFormData] = useState({
    name: '', category: '', cost: '', description: '', image_url: '', tags: ''
  })
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false)

  const fetchItemData = async () => {
    setLoading(true)
    
    // Fetch Item & Levels
    const { data: itemData, error: itemError } = await supabase
      .from('items')
      .select('*, inventory_levels(*)')
      .eq('id', id as string)
      .single()
      
    if (itemError) {
      console.error(itemError)
      router.push('/inventory')
      return
    }
    
    const typedItemData = itemData as unknown as ItemWithDetails;
    setItem(typedItemData)
    setEditFormData({
      name: typedItemData.name || '',
      category: typedItemData.category || '',
      cost: typedItemData.cost ? typedItemData.cost.toString() : '',
      description: typedItemData.description || '',
      image_url: typedItemData.image_url || '',
      tags: typedItemData.tags ? typedItemData.tags.join(', ') : ''
    })

    const { data: catData } = await (supabase.from('item_categories') as any).select('name').order('name')
    if (catData) setCategories(catData.map((c: any) => c.name))
    
    // Fetch all unique tags for suggestions
    const { data: allItemsTags } = await supabase.from('items').select('tags')
    if (allItemsTags) {
      const uniqueTags = Array.from(new Set((allItemsTags as any[]).flatMap(i => i.tags || []))).sort()
      setAllTags(uniqueTags as string[])
    }
    
    // Fetch Logs
    if (typedItemData?.inventory_levels?.length > 0) {
      const levelIds = typedItemData.inventory_levels.map((l: any) => l.id)
      
      const { data: logsData, error: logsError } = await supabase
        .from('inventory_logs')
        .select(`
          *,
          inventory_level:inventory_levels(location),
          user:profiles!inventory_logs_user_id_fkey(full_name)
        `)
        .in('inventory_id', levelIds)
        .order('created_at', { ascending: false })
        .limit(50)
        
      if (logsError) {
        console.error('Error fetching inventory logs:', logsError)
      } else if (logsData) {
        setLogs(logsData as any[])
      }

      // Also fetch all defined locations for the "Add to location" feature
      const { data: locationsData } = await supabase.from('inventory_locations').select('*').order('sort_order')
      if (locationsData) {
        setAllLocations(locationsData)
      }
    }
    
    setLoading(false)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setUploading(true)
      setError('')
      try {
        const compressed = await compressImage(file, 100)
        const uploadFormData = new FormData()
        uploadFormData.append('file', compressed, 'image.jpg')
        const res = await fetch('/api/upload-image', { method: 'POST', body: uploadFormData })
        const data = await res.json()
        if (data.url) {
          setEditFormData(prev => ({ ...prev, image_url: data.url }))
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

  const handleDeleteImage = async () => {
    if (!item || !item.image_url) return
    if (!window.confirm('למחוק את התמונה לצמיתות?')) return
    setDeletingImage(true)
    try {
      // Extract filename from Supabase Storage URL
      const match = item.image_url.match(/inventory-images\/([^?]+)/)
      if (match) {
        await fetch(`/api/upload-image?filename=${encodeURIComponent(match[1])}`, { method: 'DELETE' })
      }
      await (supabase.from('items') as any).update({ image_url: null }).eq('id', item.id)
      fetchItemData()
    } catch (err: any) {
      alert(`שגיאה במחיקת התמונה: ${err.message}`)
    } finally {
      setDeletingImage(false)
    }
  }

  useEffect(() => {
    if (id) fetchItemData()
  }, [id])

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item || !selectedLevelId || isSavingAdjustment) return
    
    setIsSavingAdjustment(true)
    const level = item.inventory_levels.find(l => l.id === selectedLevelId)
    if (!level) {
      setIsSavingAdjustment(false)
      return
    }
    
    const qtyChange = adjustType === 'ADD' ? adjustAmount : -Math.abs(adjustAmount)
    const newQty = (level.quantity || 0) + qtyChange
    
    if (newQty < 0) {
      alert('פעולה זו תגרום לכמות שלילית במלאי!')
      setIsSavingAdjustment(false)
      return
    }
    
    try {
      // 1. Update level
      const { error: updateError } = await (supabase.from('inventory_levels') as any)
        .update({ quantity: newQty })
        .eq('id', level.id)
        
      if (updateError) {
        alert(`שגיאה בעדכון מלאי: ${updateError.message}`)
        setIsSavingAdjustment(false)
        return
      }
      
      // 2. Add log
      const { data: userData } = await supabase.auth.getUser()
      await (supabase.from('inventory_logs') as any).insert({
        inventory_id: level.id,
        user_id: userData?.user?.id || null,
        type: adjustType,
        quantity_changed: qtyChange,
        new_quantity: newQty,
        notes: adjustNotes || null
      })
      
      setShowAdjustModal(false)
      setAdjustAmount(1)
      setAdjustNotes('')
      fetchItemData()
    } catch (err: any) {
      alert(`שגיאה כללית: ${err.message}`)
    } finally {
      setIsSavingAdjustment(false)
    }
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item || !transferFromId || !transferToId || transferFromId === transferToId || isSavingAdjustment) return
    
    setIsSavingAdjustment(true)
    const fromLevel = item.inventory_levels.find(l => l.id === transferFromId)
    const toLevel = item.inventory_levels.find(l => l.id === transferToId)
    
    if (!fromLevel || !toLevel) {
      setIsSavingAdjustment(false)
      return
    }
    
    if ((fromLevel.quantity || 0) < transferAmount) {
      alert(`אין מספיק מלאי ב${fromLevel.location} להעברה זו.`)
      setIsSavingAdjustment(false)
      return
    }
    
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id || null
      
      // Update FROM
      const newFromQty = (fromLevel.quantity || 0) - transferAmount
      await (supabase.from('inventory_levels') as any).update({ quantity: newFromQty }).eq('id', fromLevel.id)
      await (supabase.from('inventory_logs') as any).insert({
        inventory_id: fromLevel.id,
        user_id: userId,
        type: 'TRANSFER',
        quantity_changed: -transferAmount,
        new_quantity: newFromQty,
        notes: transferNotes ? `העברה אל ${toLevel.location}: ${transferNotes}` : `העברה אל ${toLevel.location}`
      })
      
      // Update TO
      const newToQty = (toLevel.quantity || 0) + transferAmount
      await (supabase.from('inventory_levels') as any).update({ quantity: newToQty }).eq('id', toLevel.id)
      await (supabase.from('inventory_logs') as any).insert({
        inventory_id: toLevel.id,
        user_id: userId,
        type: 'TRANSFER',
        quantity_changed: transferAmount,
        new_quantity: newToQty,
        notes: transferNotes ? `קבלה מ${fromLevel.location}: ${transferNotes}` : `קבלה מ${fromLevel.location}`
      })
      
      setShowTransferModal(false)
      setTransferAmount(1)
      setTransferNotes('')
      fetchItemData()
    } catch (err: any) {
      alert(`שגיאה בהעברה: ${err.message}`)
    } finally {
      setIsSavingAdjustment(false)
    }
  }

  const handleSaveDetails = async () => {
    if (!item) return
    setSavingDetails(true)
    const categoryName = editFormData.category.trim() || null
    if (categoryName && !categories.includes(categoryName)) {
      await (supabase.from('item_categories') as any).insert({ name: categoryName })
    }
    const tagsArray = editFormData.tags.split(',').map(t => t.trim()).filter(Boolean)
    const { error } = await (supabase.from('items') as any).update({
      name: editFormData.name.trim(),
      category: categoryName,
      cost: editFormData.cost ? parseFloat(editFormData.cost) : null,
      description: editFormData.description.trim() || null,
      image_url: editFormData.image_url.trim() || null,
      tags: tagsArray.length > 0 ? tagsArray : null,
    }).eq('id', item.id)
    if (error) { alert(`שגיאה: ${error.message}`); setSavingDetails(false); return }
    setEditingDetails(false)
    setSavingDetails(false)
    fetchItemData()
  }

  const handleSaveLocationNote = async (levelId: string) => {
    await (supabase.from('inventory_levels') as any).update({ location_note: noteText.trim() || null }).eq('id', levelId)
    setEditingNoteId(null)
    fetchItemData()
  }

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item) return
    setLoading(true)
    const categoryName = editFormData.category.trim() || null
    if (categoryName && !categories.includes(categoryName)) {
      await (supabase.from('item_categories') as any).insert({ name: categoryName })
    }
    const tagsArray = editFormData.tags.split(',').map(t => t.trim()).filter(Boolean)
    const { error } = await (supabase.from('items') as any).update({
      name: editFormData.name.trim(), category: categoryName,
      cost: editFormData.cost ? parseFloat(editFormData.cost) : null,
      description: editFormData.description.trim() || null,
      image_url: editFormData.image_url.trim() || null,
      tags: tagsArray.length > 0 ? tagsArray : null,
    }).eq('id', item.id)
    if (error) { alert(`שגיאה בעדכון: ${error.message}`); setLoading(false); return }
    setShowEditModal(false)
    fetchItemData()
  }

  const toggleTag = (tag: string) => {
    const currentTags = editFormData.tags.split(',').map(t => t.trim()).filter(Boolean)
    if (currentTags.includes(tag)) {
      setEditFormData(p => ({
        ...p,
        tags: currentTags.filter(t => t !== tag).join(', ')
      }))
    } else {
      setEditFormData(p => ({
        ...p,
        tags: [...currentTags, tag].join(', ')
      }))
    }
  }

  const handleAddNewLocation = async () => {
    if (!item || !selectedNewLocation) return
    setIsAddingLocation(true)
    
    const { error } = await (supabase.from('inventory_levels') as any).insert({
      item_id: item.id,
      location: selectedNewLocation,
      quantity: 0
    })
    
    if (error) {
      alert(`שגיאה בהוספת מיקום: ${error.message}`)
    } else {
      setShowAddLocationModal(false)
      setSelectedNewLocation('')
      fetchItemData()
    }
    setIsAddingLocation(false)
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  if (!item) return <div>פריט לא נמצא</div>

  const totalQty = item.inventory_levels.reduce((acc, l) => acc + (l.quantity || 0), 0)

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
              <Link href="/inventory">ניהול מלאי</Link>
              <span className="breadcrumb-sep">/</span>
              <span>{item.name}</span>
            </div>
            <h1 className="page-title">{item.name}</h1>
            <p className="page-subtitle text-pink font-semibold mt-1">סה"כ במלאי: {totalQty} יח'</p>
          </div>
          <div className="actions-row w-full md:w-auto">
            <Link 
              href="/inventory/new" 
              className="btn btn-secondary w-full md:w-auto justify-center"
              style={{ padding: '7px 14px', fontSize: 13, background: '#fff', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <PlusIcon />
              פריט חדש
            </Link>
            <button 
              style={{ padding: '7px 14px', fontSize: 13 }}
              className="btn btn-primary w-full md:w-auto justify-center"
              onClick={() => {
                setEditingDetails(true)
                // scroll to card smoothly
                setTimeout(() => document.getElementById('item-detail-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
              }}
            >
              <EditIcon />
              עריכה
            </button>
            <button 
              style={{ padding: '7px 14px', fontSize: 13 }}
              className="btn btn-primary w-full md:w-auto justify-center"
              onClick={() => {
                if(item.inventory_levels.length >= 2) {
                  setTransferFromId(item.inventory_levels[0].id)
                  setTransferToId(item.inventory_levels[1].id)
                }
                setShowTransferModal(true)
              }}
            >
              <ArrowRightLeftIcon />
              העברת מלאי
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {/* Item Details - Inline Editable */}
          {/* Item Details - Inline Editable */}
          <div className="col-span-1 md:col-span-3">
            <div id="item-detail-card" className="card p-6 h-full">
              <div style={{ display: 'flex', flexDirection: 'row', gap: '32px', flexWrap: 'wrap' }}>
                
                {/* Right Side: Image (Approx 1/3) */}
                <div style={{ flex: '1 1 300px', maxWidth: '350px' }}>
                  <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {editingDetails ? (
                      <div style={{ width: '100%', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>העלאת תמונה</div>
                        <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} className="form-input" style={{ fontSize: 12, padding: '6px 8px' }} />
                        {uploading && <div style={{ textAlign: 'center' }}><span className="spinner" style={{ width: 16, height: 16, borderTopColor: 'var(--pink)' }} /></div>}
                        <input type="text" className="form-input" placeholder="או הדבק URL..." style={{ fontSize: 12, padding: '6px 8px' }} value={editFormData.image_url} onChange={e => setEditFormData(p => ({ ...p, image_url: e.target.value }))} />
                        {editFormData.image_url && <img src={editFormData.image_url} alt="" style={{ width: '100%', height: 80, objectFit: 'contain', borderRadius: 8, background: 'var(--surface-2)' }} />}
                      </div>
                    ) : (
                      item.image_url
                        ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
                        : <span style={{ fontSize: 48, opacity: 0.3 }}>📦</span>
                    )}
                    {/* Delete image button */}
                    {!editingDetails && item.image_url && (
                      <button
                        onClick={handleDeleteImage}
                        disabled={deletingImage}
                        style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(239,68,68,0.85)', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 7px', fontSize: 11, cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                        title="מחק תמונה"
                      >
                        {deletingImage ? '...' : '🗑'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Left Side: Details (Remaining space) */}
                <div style={{ flex: '2 1 400px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>פרטי פריט</h3>
                    {editingDetails && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setEditingDetails(false)} style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>ביטול</button>
                        <button onClick={handleSaveDetails} disabled={savingDetails} style={{ fontSize: 12, background: 'var(--pink)', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>
                          {savingDetails ? '...' : 'שמור'}
                        </button>
                      </div>
                    )}
                  </div>

                  {error && <div className="error-box" style={{ marginBottom: 12, fontSize: 12 }}>{error}</div>}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                    {editingDetails ? (
                      <>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: 11 }}>שם הפריט</label>
                          <input className="form-input" style={{ padding: '7px 10px' }} value={editFormData.name} onChange={e => setEditFormData(p => ({ ...p, name: e.target.value }))} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: 11 }}>קטגוריה</label>
                            <input className="form-input" style={{ padding: '7px 10px' }} list="inline-cats" placeholder="קטגוריה..." value={editFormData.category} onChange={e => setEditFormData(p => ({ ...p, category: e.target.value }))} />
                            <datalist id="inline-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: 11 }}>עלות (₪)</label>
                            <input type="number" step="0.01" min="0" className="form-input" style={{ padding: '7px 10px' }} placeholder="0.00" value={editFormData.cost} onChange={e => setEditFormData(p => ({ ...p, cost: e.target.value }))} />
                          </div>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: 11 }}>תגיות (בפסיק)</label>
                          <input className="form-input" style={{ padding: '7px 10px' }} placeholder="תגית1, תגית2" value={editFormData.tags} onChange={e => setEditFormData(p => ({ ...p, tags: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: 11 }}>תיאור</label>
                          <textarea className="form-input" rows={2} style={{ padding: '7px 10px' }} value={editFormData.description} onChange={e => setEditFormData(p => ({ ...p, description: e.target.value }))} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                          <span style={{ color: 'var(--text-muted)' }}>שם הפריט</span>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{item.name}</span>
                        </div>
                        {item.category && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                            <span style={{ color: 'var(--text-muted)' }}>קטגוריה</span>
                            <span style={{ fontWeight: 600 }}>{item.category}</span>
                          </div>
                        )}
                        {item.cost != null && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                            <span style={{ color: 'var(--text-muted)' }}>עלות יחידה</span>
                            <span style={{ fontWeight: 600, color: 'var(--pink)' }}>₪{item.cost.toFixed(2)}</span>
                          </div>
                        )}
                        {item.tags && item.tags.length > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8, gap: 8 }}>
                            <span style={{ color: 'var(--text-muted)' }}>תגיות</span>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {item.tags.map(t => <span key={t} className="badge badge-gray">{t}</span>)}
                            </div>
                          </div>
                        )}
                        {item.description && (
                          <div style={{ paddingTop: 4 }}>
                            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>תיאור</span>
                            <p style={{ color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>{item.description}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Inventory Levels & Actions */}
          <div className="col-span-1 md:col-span-2 space-y-6">
            <div className="card p-6">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100" style={{ margin: 0 }}>מלאי לפי מיקום</h3>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '5px 12px', fontSize: 12, borderRadius: 10 }}
                  onClick={() => setShowAddLocationModal(true)}
                >
                  📍 הוסף מיקום
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {item.inventory_levels.map(level => {
                  const lvl = level as any
                  return (
                    <div key={level.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>מיקום</div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{level.location}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>כמות</div>
                            <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--pink)', lineHeight: 1 }}>{level.quantity || 0}</div>
                          </div>
                          <button
                            style={{ padding: '7px 13px', fontSize: 12, borderRadius: 10 }}
                            className="btn btn-primary"
                            onClick={() => { setSelectedLevelId(level.id); setShowAdjustModal(true) }}
                          >עדכן</button>
                        </div>
                      </div>
                      {/* Location note */}
                      {editingNoteId === level.id ? (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          <input
                            autoFocus
                            className="form-input"
                            style={{ flex: 1, padding: '5px 8px', fontSize: 12 }}
                            placeholder="מיקום מדויק, למשל: מדף עליון..."
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveLocationNote(level.id); if (e.key === 'Escape') setEditingNoteId(null) }}
                          />
                          <button onClick={() => handleSaveLocationNote(level.id)} style={{ background: 'var(--pink)', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>שמור</button>
                          <button onClick={() => setEditingNoteId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>ביטול</button>
                        </div>
                      ) : (
                        <div
                          style={{ marginTop: 8, fontSize: 12, color: lvl.location_note ? 'var(--text-secondary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => { setEditingNoteId(level.id); setNoteText(lvl.location_note || '') }}
                        >
                          <span>📝</span>
                          <span style={{ fontStyle: lvl.location_note ? 'normal' : 'italic' }}>{lvl.location_note || 'הוסף הערת מיקום...'}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* History Logs */}
            <div className="card p-0 overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">היסטוריית פעולות</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                    <tr>
                      <th className="py-3 px-6 font-medium">תאריך</th>
                      <th className="py-3 px-6 font-medium">פעולה</th>
                      <th className="py-3 px-6 font-medium">מיקום</th>
                      <th className="py-3 px-6 font-medium">שינוי</th>
                      <th className="py-3 px-6 font-medium">יתרה חדשה</th>
                      <th className="py-3 px-6 font-medium">הערות / משתמש</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-500">אין היסטוריית פעולות לפריט זה</td>
                      </tr>
                    ) : (
                      logs.map(log => (
                        <tr key={log.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50">
                          <td className="py-3 px-6 text-gray-500">
                            {new Date(log.created_at || '').toLocaleDateString('he-IL')} {new Date(log.created_at || '').toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}
                          </td>
                          <td className="py-3 px-6">
                            {log.type === 'ADD' && <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs">הכנסה</span>}
                            {log.type === 'REMOVE' && <span className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs">הוצאה</span>}
                            {log.type === 'TRANSFER' && <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs">העברה</span>}
                            {log.type === 'SET' && <span className="text-gray-600 bg-gray-100 px-2 py-1 rounded text-xs">עדכון כמות</span>}
                          </td>
                          <td className="py-3 px-6 font-medium">{log.inventory_level?.location}</td>
                          <td className="py-3 px-6 font-bold" dir="ltr">
                            <span className={log.quantity_changed > 0 ? 'text-green-600' : 'text-red-500'}>
                              {log.quantity_changed > 0 ? `+${log.quantity_changed}` : log.quantity_changed}
                            </span>
                          </td>
                          <td className="py-3 px-6">{log.new_quantity}</td>
                          <td className="py-3 px-6 text-gray-500">
                            <div className="truncate max-w-[200px]" title={log.notes || ''}>{log.notes || '-'}</div>
                            <div className="text-xs opacity-70">{log.user?.full_name || 'מערכת'}</div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Adjustment Modal */}
      {showAdjustModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', borderRadius: '20px' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>עדכון מלאי</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}>
              מיקום: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.inventory_levels.find(l => l.id === selectedLevelId)?.location}</span>
            </p>
            
            <form onSubmit={handleAdjustment}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', gap: 8, padding: '5px', background: 'var(--surface-2)', borderRadius: 14 }}>
                  <button 
                    type="button" 
                    style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: adjustType === 'ADD' ? 'var(--pink)' : 'transparent', color: adjustType === 'ADD' ? '#fff' : 'var(--text-muted)' }}
                    onClick={() => setAdjustType('ADD')}
                  >
                    + הכנסה
                  </button>
                  <button 
                    type="button"
                    style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: adjustType === 'REMOVE' ? '#fee2e2' : 'transparent', color: adjustType === 'REMOVE' ? '#dc2626' : 'var(--text-muted)' }}
                    onClick={() => setAdjustType('REMOVE')}
                  >
                    − הוצאה
                  </button>
                </div>
                
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 13, marginBottom: 6 }}>כמות לעדכון</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button 
                      type="button" 
                      onClick={() => setAdjustAmount(prev => Math.max(1, prev - 1))}
                      style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      −
                    </button>
                    <input 
                      type="number" 
                      min="1" 
                      required
                      className="form-input"
                      style={{ flex: 1, fontSize: 24, fontWeight: 800, padding: '12px 16px', textAlign: 'center' }}
                      value={adjustAmount}
                      onChange={e => setAdjustAmount(parseInt(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                    />
                    <button 
                      type="button" 
                      onClick={() => setAdjustAmount(prev => prev + 1)}
                      style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      +
                    </button>
                  </div>
                </div>
                
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 13, marginBottom: 6 }}>הערות / סיבת התנועה</label>
                  <textarea 
                    className="form-input"
                    rows={3}
                    placeholder="למשל: סחורה חדשה, נזק, העברה לאירוע..."
                    style={{ padding: '12px 16px', resize: 'none' }}
                    value={adjustNotes}
                    onChange={e => setAdjustNotes(e.target.value)}
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32 }}>
                <button type="button" style={{ padding: '10px 20px' }} className="btn btn-secondary" onClick={() => setShowAdjustModal(false)} disabled={isSavingAdjustment}>ביטול</button>
                <button type="submit" style={{ padding: '10px 24px' }} className="btn btn-primary" disabled={isSavingAdjustment}>
                  {isSavingAdjustment ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff', marginRight: 0 }} /> : 'שמור עדכון'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', borderRadius: '20px' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 28 }}>העברת מלאי בין מיקומים</h2>
            
            <form onSubmit={handleTransfer}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: 13 }}>ממיקום</label>
                    <select 
                      className="form-input"
                      style={{ padding: '10px' }}
                      value={transferFromId}
                      onChange={e => setTransferFromId(e.target.value)}
                      required
                    >
                      <option value="" disabled>בחר מקור...</option>
                      {item.inventory_levels.map(l => (
                        <option key={l.id} value={l.id}>{l.location} ({l.quantity || 0})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: 13 }}>למיקום</label>
                    <select 
                      className="form-input"
                      style={{ padding: '10px' }}
                      value={transferToId}
                      onChange={e => setTransferToId(e.target.value)}
                      required
                    >
                      <option value="" disabled>בחר יעד...</option>
                      {item.inventory_levels.filter(l => l.id !== transferFromId).map(l => (
                        <option key={l.id} value={l.id}>{l.location}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 13 }}>כמות להעברה</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button 
                      type="button" 
                      onClick={() => setTransferAmount(prev => Math.max(1, prev - 1))}
                      style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      −
                    </button>
                    <input 
                      type="number" 
                      min="1" 
                      required
                      className="form-input"
                      style={{ flex: 1, fontSize: 22, fontWeight: 700, padding: '12px', textAlign: 'center' }}
                      value={transferAmount}
                      onChange={e => setTransferAmount(parseInt(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                    />
                    <button 
                      type="button" 
                      onClick={() => setTransferAmount(prev => prev + 1)}
                      style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 13 }}>הערות (לא חובה)</label>
                  <input 
                    type="text" 
                    className="form-input"
                    placeholder="סיבת ההעברה..."
                    style={{ padding: '10px 14px' }}
                    value={transferNotes}
                    onChange={e => setTransferNotes(e.target.value)}
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 36 }}>
                <button type="button" style={{ padding: '10px 20px' }} className="btn btn-secondary" onClick={() => setShowTransferModal(false)} disabled={isSavingAdjustment}>ביטול</button>
                <button type="submit" style={{ padding: '10px 24px' }} className="btn btn-primary" disabled={!transferFromId || !transferToId || transferFromId === transferToId || isSavingAdjustment}>
                  {isSavingAdjustment ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff', marginRight: 0 }} /> : 'בצע העברה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1c1c] rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">עריכת פריט</h2>
            
            <form onSubmit={handleEditItem}>
              {error && <div className="error-box" style={{ marginBottom: 20 }}>{error}</div>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">שם הפריט</label>
                  <input 
                    type="text" 
                    required
                    className="w-full input"
                    value={editFormData.name}
                    onChange={e => setEditFormData(p => ({ ...p, name: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">קטגוריה</label>
                    <input 
                      type="text" 
                      list="edit-categories-list"
                      className="w-full input"
                      placeholder="בחר או הקלד חדשה..."
                      value={editFormData.category}
                      onChange={e => setEditFormData(p => ({ ...p, category: e.target.value }))}
                    />
                    <datalist id="edit-categories-list">
                      {categories.map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">עלות פריט (₪)</label>
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full input"
                      placeholder="עלות קנייה"
                      value={editFormData.cost}
                      onChange={e => setEditFormData(p => ({ ...p, cost: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">תגיות (מופרדות בפסיק)</label>
                  <input 
                    type="text" 
                    className="w-full input"
                    value={editFormData.tags}
                    onChange={e => setEditFormData(p => ({ ...p, tags: e.target.value }))}
                    placeholder="למשל: חשמלי, שביר, מסיבה"
                  />
                  
                  {allTags.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: '100%', marginBottom: 2 }}>תגיות קיימות (לחץ להוספה):</span>
                      {allTags.map(tag => {
                        const isSelected = editFormData.tags.split(',').map(t => t.trim()).includes(tag)
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

                <div>
                  <label className="block text-sm font-medium mb-1">החלפת תמונה (העלאה לדרייב)</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="w-full input"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={uploading}
                    />
                    {uploading && (
                      <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="spinner" style={{ width: 16, height: 16, borderTopColor: 'var(--pink)' }} />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">קישור לתמונה (URL)</label>
                  <input 
                    type="text" 
                    className="w-full input"
                    value={editFormData.image_url}
                    onChange={e => setEditFormData(p => ({ ...p, image_url: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">תיאור</label>
                  <textarea 
                    className="w-full input"
                    rows={3}
                    value={editFormData.description}
                    onChange={e => setEditFormData(p => ({ ...p, description: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-8">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)} disabled={uploading}>ביטול</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'מעלה...' : 'שמור שינויים'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Location to Item Modal */}
      {showAddLocationModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', borderRadius: '20px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>הוספת מיקום מלאי לפריט</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>בחר מיקום להוספה לרשימת המלאי של פריט זה.</p>
            
            <div className="form-group">
              <label style={{ fontSize: 12 }}>בחר מיקום</label>
              <select 
                className="form-input" 
                value={selectedNewLocation} 
                onChange={e => setSelectedNewLocation(e.target.value)}
                style={{ padding: '10px' }}
              >
                <option value="">בחר מיקום...</option>
                {allLocations
                  .filter(loc => !item.inventory_levels.some(l => l.location === loc.name))
                  .map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))
                }
              </select>
              {allLocations.filter(loc => !item.inventory_levels.some(l => l.location === loc.name)).length === 0 && (
                <p style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>כל המיקומים המוגדרים כבר קיימים עבור פריט זה.</p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 32 }}>
              <button className="btn btn-secondary" onClick={() => setShowAddLocationModal(false)}>ביטול</button>
              <button 
                className="btn btn-primary" 
                disabled={!selectedNewLocation || isAddingLocation} 
                onClick={handleAddNewLocation}
              >
                {isAddingLocation ? 'מוסיף...' : 'הוסף פריט למיקום'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  )
}

function BellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
}
function ArrowRightLeftIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
}
function EditIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
}
