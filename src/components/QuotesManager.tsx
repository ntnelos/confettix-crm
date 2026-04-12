'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'
import { useRouter } from 'next/navigation'

type Quote = Database['public']['Tables']['quotes']['Row']
type QuoteItem = Database['public']['Tables']['quote_items']['Row']

export default function QuotesManager({ opportunityId }: { opportunityId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [itemsMap, setItemsMap] = useState<Record<string, QuoteItem[]>>({})
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null)

  // Duplication modal state
  const [showDupModal, setShowDupModal] = useState(false)
  const [dupSourceQuoteId, setDupSourceQuoteId] = useState<string | null>(null)
  const [recentOpps, setRecentOpps] = useState<any[]>([])
  const [isDuplicating, setIsDuplicating] = useState(false)

  useEffect(() => {
    fetchQuotes()
  }, [opportunityId])

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(() => {
      searchWooCommerce(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchQuotes = async () => {
    setLoading(true)
    const { data: qData, error: qErr } = await (supabase.from('quotes') as any)
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      
    if (qData) {
      setQuotes(qData)
      if (qData.length > 0 && !activeQuoteId) {
        setActiveQuoteId(qData[0].id)
      }
      // Fetch items for all quotes
      const { data: iData } = await (supabase.from('quote_items') as any)
        .select('*')
        .in('quote_id', qData.map((q: any) => q.id))
        .order('sort_order', { ascending: true })
        
      if (iData) {
        const iMap: Record<string, QuoteItem[]> = {}
        for (const item of iData) {
          if (!iMap[item.quote_id]) iMap[item.quote_id] = []
          iMap[item.quote_id].push(item)
        }
        setItemsMap(iMap)
      }
    }
    setLoading(false)
  }

  const createQuote = async () => {
    const { data, error } = await (supabase.from('quotes') as any)
      .insert({
        opportunity_id: opportunityId,
        name: `הצעת מחיר ${new Date().toLocaleDateString('he-IL')}`,
        status: 'draft',
        subtotal: 0,
        vat_rate: 18,
        shipping_cost: 0,
        total_with_vat: 0,
        version: 1
      })
      .select()
      .single()

    if (data) {
      setQuotes([data, ...quotes])
      setActiveQuoteId(data.id)
      setItemsMap({ ...itemsMap, [data.id]: [] })
    } else {
      console.error(error)
      alert("שגיאה ביצירת הצעה (וודא שהעמודה shipping_cost נוספה למסד הנתונים!)")
    }
  }

  const searchWooCommerce = async (q: string) => {
    setIsSearching(true)
    try {
      const res = await fetch(`/api/woocommerce/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.products) {
        setSearchResults(data.products)
      }
    } catch (e) {
      console.error(e)
    }
    setIsSearching(false)
  }

  const addItemToQuote = async (quoteId: string, wcProduct: any = null) => {
    const quote = quotes.find(q => q.id === quoteId)
    if (!quote) return

    const items = itemsMap[quoteId] || []
    const sort_order = items.length
    
    // Determine defaults
    let product_name = wcProduct ? wcProduct.name : 'פריט בהתאמה אישית'
    let unit_price = wcProduct ? wcProduct.price : 0
    let woo_product_id = wcProduct ? wcProduct.id : null
    let woo_product_url = wcProduct ? wcProduct.permalink : null
    let image_url = wcProduct ? wcProduct.image_url : null
    let quantity = 1
    
    const { data, error } = await (supabase.from('quote_items') as any)
      .insert({
        quote_id: quoteId,
        product_name,
        quantity,
        unit_price,
        discount_percent: 0,
        line_total: unit_price * quantity,
        woo_product_id,
        woo_product_url,
        image_url,
        sort_order
      })
      .select()
      .single()
      
    if (data) {
      const newItems = [...items, data]
      setItemsMap({ ...itemsMap, [quoteId]: newItems })
      recalculateQuote(quote, newItems)
      setSearchQuery('')
      setSearchResults([])
    } else {
       console.error("שגיאה בהכנסת פריט:", error)
       alert("שגיאה בהכנסת פריט (כנראה בעיית הרשאות RLS או טבלה חסרה במסד הנתונים): \n" + (error?.message || JSON.stringify(error)))
    }
  }
  
  const updateItem = async (quoteId: string, itemId: string, field: string, value: any) => {
    const items = itemsMap[quoteId] || []
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        const updated = { ...item, [field]: value }
        // recalc line total
        if (field === 'quantity' || field === 'unit_price' || field === 'discount_percent') {
          const rawTotal = updated.quantity * updated.unit_price
          const disPrice = rawTotal - (rawTotal * (updated.discount_percent / 100))
          updated.line_total = disPrice
        }
        return updated
      }
      return item
    })
    
    setItemsMap({ ...itemsMap, [quoteId]: updatedItems })
    
    // Save to DB
    const itemToSave = updatedItems.find(i => i.id === itemId)
    if (itemToSave) {
      await (supabase.from('quote_items') as any).update(itemToSave).eq('id', itemId)
      const quote = quotes.find(q => q.id === quoteId)
      if (quote) recalculateQuote(quote, updatedItems)
    }
  }
  
  const deleteItem = async (quoteId: string, itemId: string) => {
     await (supabase.from('quote_items') as any).delete().eq('id', itemId)
     const items = itemsMap[quoteId] || []
     const updatedItems = items.filter(i => i.id !== itemId)
     setItemsMap({ ...itemsMap, [quoteId]: updatedItems })
     
     const quote = quotes.find(q => q.id === quoteId)
     if (quote) recalculateQuote(quote, updatedItems)
  }
  
  const recalculateQuote = async (quote: Quote, items: QuoteItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0)
    const shipping = quote.shipping_cost || 0
    const totalWithoutVat = subtotal + shipping
    const totalWithVat = totalWithoutVat * (1 + (quote.vat_rate / 100))
    
    const { data } = await (supabase.from('quotes') as any).update({
       subtotal,
       total_with_vat: totalWithVat
    }).eq('id', quote.id).select().single()
    
    if (data) {
       setQuotes(quotes.map(q => q.id === data.id ? data : q))
    }
  }
  
  const updateQuoteShipping = async (quoteId: string, shippingCost: number) => {
     const quote = quotes.find(q => q.id === quoteId)
     if (!quote) return
     const updatedQuote = { ...quote, shipping_cost: shippingCost }
     setQuotes(quotes.map(q => q.id === quoteId ? updatedQuote : q))
     
     // Save and recalc
     const items = itemsMap[quoteId] || []
     recalculateQuote(updatedQuote, items)
  }

  const updateQuoteName = async (quoteId: string, newName: string) => {
    if (!newName.trim()) return
    await (supabase.from('quotes') as any).update({ name: newName.trim() }).eq('id', quoteId)
    setQuotes(quotes.map(q => q.id === quoteId ? { ...q, name: newName.trim() } : q))
  }

  // ---- Duplication functions ----
  const openDupModal = async (quoteId: string) => {
    setDupSourceQuoteId(quoteId)
    setShowDupModal(true)
    // Fetch recent opportunities
    const { data } = await (supabase.from('opportunities') as any)
      .select('id, subject, created_at')
      .neq('id', opportunityId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setRecentOpps(data)
  }

  const duplicateQuoteSameOpp = async () => {
    if (!dupSourceQuoteId) return
    setIsDuplicating(true)
    const sourceQuote = quotes.find(q => q.id === dupSourceQuoteId)
    const sourceItems = itemsMap[dupSourceQuoteId] || []
    if (!sourceQuote) { setIsDuplicating(false); return }

    const { data: newQuote } = await (supabase.from('quotes') as any).insert({
      opportunity_id: opportunityId,
      name: `${sourceQuote.name} (העתק)`,
      status: 'draft',
      subtotal: sourceQuote.subtotal,
      vat_rate: sourceQuote.vat_rate,
      shipping_cost: sourceQuote.shipping_cost,
      total_with_vat: sourceQuote.total_with_vat,
      version: (sourceQuote.version || 1) + 1
    }).select().single()

    if (newQuote) {
      for (const item of sourceItems) {
        await (supabase.from('quote_items') as any).insert({
          quote_id: newQuote.id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          line_total: item.line_total,
          woo_product_id: item.woo_product_id,
          woo_product_url: item.woo_product_url,
          image_url: item.image_url,
          sort_order: item.sort_order
        })
      }
      setShowDupModal(false)
      fetchQuotes()
    }
    setIsDuplicating(false)
  }

  const duplicateToExistingOpp = async (targetOppId: string) => {
    if (!dupSourceQuoteId) return
    setIsDuplicating(true)
    const sourceQuote = quotes.find(q => q.id === dupSourceQuoteId)
    const sourceItems = itemsMap[dupSourceQuoteId] || []
    if (!sourceQuote) { setIsDuplicating(false); return }

    const { data: newQuote } = await (supabase.from('quotes') as any).insert({
      opportunity_id: targetOppId,
      name: `${sourceQuote.name} (מועתק)`,
      status: 'draft',
      subtotal: sourceQuote.subtotal,
      vat_rate: sourceQuote.vat_rate,
      shipping_cost: sourceQuote.shipping_cost,
      total_with_vat: sourceQuote.total_with_vat,
      version: 1
    }).select().single()

    if (newQuote) {
      for (const item of sourceItems) {
        await (supabase.from('quote_items') as any).insert({
          quote_id: newQuote.id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          line_total: item.line_total,
          woo_product_id: item.woo_product_id,
          woo_product_url: item.woo_product_url,
          image_url: item.image_url,
          sort_order: item.sort_order
        })
      }
      setShowDupModal(false)
      router.push(`/opportunities/${targetOppId}`)
    }
    setIsDuplicating(false)
  }

  if (loading) return <div style={{ padding: 20 }}>טוען הצעות מחיר...</div>

  return (
    <div style={{ padding: '20px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>הצעות מחיר ומוצרים עיקריים</h2>
        <button onClick={createQuote} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
          + יצירת הצעת מחיר
        </button>
      </div>

      {quotes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: 'var(--surface-2)', borderRadius: 12, color: 'var(--text-muted)' }}>
          טרם נוצרו הצעות מחיר (Order Items) להזדמנות זו. ליצירת הצעת מחיר בסיסית, לחץ על הכפתור.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20, flexDirection: 'column' }}>
          {/* Quote Tabs Context */}
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 10 }}>
            {quotes.map(q => (
              <div 
                key={q.id} 
                onClick={() => setActiveQuoteId(q.id)}
                style={{ 
                  padding: '8px 16px', 
                  background: activeQuoteId === q.id ? 'var(--pink)' : 'var(--surface-2)',
                  color: activeQuoteId === q.id ? 'white' : 'var(--text-secondary)',
                  borderRadius: 20,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
              >
                {q.name}
              </div>
            ))}
          </div>

           {/* Active Quote Content */}
          {activeQuoteId && (() => {
            const activeQuote = quotes.find(q => q.id === activeQuoteId)
            return (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
               {/* Editable Quote Name Header */}
               <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #0b1536, #1a1b41)', display: 'flex', alignItems: 'center', gap: 10 }}>
                 <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>שם הצעה:</span>
                 <input
                   key={activeQuoteId}
                   defaultValue={activeQuote?.name || ''}
                   onBlur={e => updateQuoteName(activeQuoteId, e.target.value)}
                   onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                   style={{
                     background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.3)',
                     color: 'white', fontSize: 15, fontWeight: 600, outline: 'none',
                     flex: 1, padding: '2px 4px'
                   }}
                 />
               </div>
               <div style={{ padding: '24px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  
                  {/* Smart Search Bar & Buttons */}
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                     <div style={{ position: 'relative', flex: 1 }}>
                       <input 
                         type="text" 
                         placeholder="🔎 הקלד לחיפוש ושליפת מוצר מקטלוג ווקומרס (WooCommerce)..." 
                         value={searchQuery}
                         onChange={e => setSearchQuery(e.target.value)}
                         style={{ 
                           width: '100%', padding: '14px 20px', borderRadius: 8, 
                           border: '2px solid var(--border)', fontSize: 16,
                           boxShadow: '0 4px 6px rgba(0,0,0,0.02)'
                         }}
                       />
                       {isSearching && <div style={{ position: 'absolute', left: 20, top: 16, fontSize: 13, color: 'var(--text-muted)' }}>מחפש...</div>}
                       
                       {searchQuery.length >= 2 && searchResults.length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, zIndex: 10, boxShadow: '0 8px 16px rgba(0,0,0,0.1)', maxHeight: 300, overflowY: 'auto' }}>
                            {searchResults.map(prod => (
                              <div 
                                 key={prod.id} 
                                 onClick={() => addItemToQuote(activeQuoteId, prod)}
                                 style={{ padding: 12, borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'background 0.2s' }}
                                 onMouseOver={e => e.currentTarget.style.background = 'var(--surface-2)'}
                                 onMouseOut={e => e.currentTarget.style.background = 'white'}
                              >
                                 {prod.image_url ? (
                                   <img src={prod.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                                 ) : (
                                   <div style={{ width: 40, height: 40, background: '#eee', borderRadius: 6 }}></div>
                                 )}
                                 <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{prod.name}</div>
                                 <div style={{ color: 'var(--pink)', fontWeight: 700, fontSize: 14 }}>₪{prod.price}</div>
                              </div>
                            ))}
                          </div>
                       )}
                     </div>

                     {/* Add empty generic row */}
                     <button onClick={() => addItemToQuote(activeQuoteId)} className="btn btn-secondary" style={{ padding: '14px 24px', fontSize: 15, background: 'white' }}>
                        + הוספת שורה ידנית
                     </button>
                  </div>
               </div>
               
               <div style={{ padding: 20 }}>
                 {(itemsMap[activeQuoteId] || []).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>אין פריטים להצעה זו. הוסף פריט מחיפוש האתר או הוסף שורה ידנית.</div>
                 ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                       <thead>
                         <tr>
                           <th style={{ textAlign: 'right', padding: 10, borderBottom: '2px solid var(--border)' }}>תיאור פריט</th>
                           <th style={{ textAlign: 'center', padding: 10, borderBottom: '2px solid var(--border)', width: 80 }}>כמות</th>
                           <th style={{ textAlign: 'center', padding: 10, borderBottom: '2px solid var(--border)', width: 100 }}>מחיר יחידה</th>
                           <th style={{ textAlign: 'center', padding: 10, borderBottom: '2px solid var(--border)', width: 100 }}>הנחה (%)</th>
                           <th style={{ textAlign: 'center', padding: 10, borderBottom: '2px solid var(--border)', width: 100 }}>סה״כ שורה</th>
                           <th style={{ textAlign: 'center', padding: 10, borderBottom: '2px solid var(--border)', width: 60 }}></th>
                         </tr>
                       </thead>
                       <tbody>
                         {(itemsMap[activeQuoteId] || []).map(item => (
                            <tr key={item.id}>
                              <td style={{ padding: 10, borderBottom: '1px solid var(--border-light)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {/* Thumbnail: image if WC product, gift icon if manual */}
                                  {item.image_url ? (
                                    <a href={item.woo_product_url || '#'} target="_blank" rel="noreferrer" title="צפה במוצר באתר" style={{ flexShrink: 0 }}>
                                      <img
                                        src={item.image_url}
                                        alt={item.product_name}
                                        width={36}
                                        height={36}
                                        style={{ borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)', display: 'block' }}
                                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                                      />
                                    </a>
                                  ) : (
                                    <span style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', borderRadius: 6, border: '1px dashed var(--border)', flexShrink: 0, color: 'var(--text-muted)' }}>
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/>
                                        <line x1="12" y1="22" x2="12" y2="7"/>
                                        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                                        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                                      </svg>
                                    </span>
                                  )}
                                  <input
                                    value={item.product_name}
                                    onChange={e => updateItem(activeQuoteId, item.id, 'product_name', e.target.value)}
                                    style={{ border: 'none', background: 'transparent', width: '100%', fontWeight: 500, fontSize: 13 }}
                                  />
                                </div>
                                {item.woo_product_url && (
                                  <a href={item.woo_product_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--blue)', marginRight: 44, display: 'block', marginTop: 2 }}>🔗 צפה באתר</a>
                                )}
                              </td>


                              <td style={{ padding: 10, borderBottom: '1px solid var(--border-light)' }}>
                                <input 
                                  type="number" min="1"
                                  value={item.quantity} 
                                  onChange={e => updateItem(activeQuoteId, item.id, 'quantity', parseFloat(e.target.value)||0)}
                                  style={{ width: '100%', textAlign: 'center', padding: 4, border: '1px solid var(--border)', borderRadius: 4 }}
                                />
                              </td>
                              <td style={{ padding: 10, borderBottom: '1px solid var(--border-light)' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                   <span style={{color: 'var(--text-muted)'}}>₪</span>
                                   <input 
                                      type="number"
                                      value={item.unit_price} 
                                      onChange={e => updateItem(activeQuoteId, item.id, 'unit_price', parseFloat(e.target.value)||0)}
                                      style={{ width: '100%', textAlign: 'center', border: 'none', background: 'transparent' }}
                                   />
                                </div>
                              </td>
                              <td style={{ padding: 10, borderBottom: '1px solid var(--border-light)' }}>
                                <input 
                                  type="number" min="0" max="100"
                                  value={item.discount_percent} 
                                  onChange={e => updateItem(activeQuoteId, item.id, 'discount_percent', parseFloat(e.target.value)||0)}
                                  style={{ width: '100%', textAlign: 'center', border: 'none', background: 'transparent' }}
                                />
                              </td>
                              <td style={{ padding: 10, borderBottom: '1px solid var(--border-light)', textAlign: 'center', fontWeight: 600 }}>
                                ₪{item.line_total.toFixed(2)}
                              </td>
                              <td style={{ padding: 10, borderBottom: '1px solid var(--border-light)', textAlign: 'center' }}>
                                <button onClick={() => deleteItem(activeQuoteId, item.id)} style={{ background: 'none', border: 'none', color: '#e53935', cursor: 'pointer', fontSize: 16 }}>×</button>
                              </td>
                            </tr>
                         ))}
                       </tbody>
                    </table>
                 )}
                 
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20, gap: 16, flexWrap: 'wrap' }}>
                    {/* Duplicate buttons */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>שכפול הצעה:</div>
                      <button
                        onClick={() => openDupModal(activeQuoteId)}
                        style={{ padding: '8px 14px', fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
                      >⊞ אפשרויות שכפול</button>
                    </div>

                    {/* Totals */}
                    <div style={{ width: 300, background: 'var(--surface)', padding: 16, borderRadius: 8, fontSize: 14 }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span>סה״כ מוצרים:</span>
                          <strong>₪{quotes.find(q=>q.id===activeQuoteId)?.subtotal?.toFixed(2)}</strong>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                          <span>עלות משלוח:</span>
                          <div style={{ display: 'flex', alignItems: 'center', width: 80 }}>
                            <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>₪</span>
                            <input
                               type="number"
                               value={quotes.find(q=>q.id===activeQuoteId)?.shipping_cost || 0}
                               onChange={e => updateQuoteShipping(activeQuoteId, parseFloat(e.target.value)||0)}
                               style={{ width: '100%', textAlign: 'left', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4 }}
                            />
                          </div>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                          <span>מע״מ (18%):</span>
                          <span>כלול בחישוב המלא</span>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '2px solid var(--border)', fontWeight: 700, fontSize: 16, color: 'var(--pink)' }}>
                          <span>סה״כ לתשלום:</span>
                          <span>₪{quotes.find(q=>q.id===activeQuoteId)?.total_with_vat?.toFixed(2)}</span>
                       </div>
                    </div>
                  </div>
                 </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Duplication Modal */}
      {showDupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: 20, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>שכפול הצעת מחיר</h2>
              <button onClick={() => setShowDupModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>

            {/* Option 1: Same opportunity */}
            <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>⊞ שכפל להזדמנות זו</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>יצירת הצעה חדשה עם אותם פריטים באותה הזדמנות.</div>
              <button onClick={duplicateQuoteSameOpp} disabled={isDuplicating} className="btn btn-primary" style={{ fontSize: 13 }}>
                {isDuplicating ? 'משכפל...' : 'שכפל כאן'}
              </button>
            </div>

            {/* Option 2: Existing opportunity */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
              <div style={{ fontWeight: 600, flexShrink: 0 }}>🔀 שכפל להזדמנות קיימת</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>בחר הזדמנות אחרת לשכפל אליה (עד 50 אחרונות):</div>
              <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border)', borderRadius: 8 }}>
                {recentOpps.length === 0 ? (
                  <div style={{ padding: 16, color: 'var(--text-muted)', textAlign: 'center' }}>טוען הזדמנויות...</div>
                ) : recentOpps.map(opp => (
                  <div
                    key={opp.id}
                    onClick={() => !isDuplicating && duplicateToExistingOpp(opp.id)}
                    style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', cursor: 'pointer', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onMouseOver={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'white')}
                  >
                    <span>{opp.subject}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{new Date(opp.created_at).toLocaleDateString('he-IL')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Option 3: New opportunity */}
            <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>✨ שכפל להזדמנות חדשה</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>פתח טופס הזדמנות חדשה – ההצעה תשוכפל אוטומטית לאחר יצירתה.</div>
              <button
                onClick={() => {
                  if (dupSourceQuoteId) {
                    sessionStorage.setItem('cloneQuoteId', dupSourceQuoteId)
                    router.push('/opportunities/new?cloneFrom=' + dupSourceQuoteId)
                  }
                }}
                className="btn btn-secondary"
                style={{ fontSize: 13 }}
              >צור הזדמנות חדשה עם הצעה זו</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
