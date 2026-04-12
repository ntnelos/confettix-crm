'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'

type Quote = Database['public']['Tables']['quotes']['Row']
type QuoteItem = Database['public']['Tables']['quote_items']['Row']

export default function QuotesManager({ opportunityId }: { opportunityId: string }) {
  const supabase = createClient()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [itemsMap, setItemsMap] = useState<Record<string, QuoteItem[]>>({})
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null)

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
        vat_rate: 17,
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
          {activeQuoteId && (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
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
                                <input 
                                  value={item.product_name} 
                                  onChange={e => updateItem(activeQuoteId, item.id, 'product_name', e.target.value)}
                                  style={{ border: 'none', background: 'transparent', width: '100%', fontWeight: 500 }}
                                />
                                {item.woo_product_url && <a href={item.woo_product_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--blue)' }}>🔗 צפה באתר</a>}
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
                 
                 <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                    
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
                          <span>מע״מ (17%):</span>
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
          )}
        </div>
      )}
    </div>
  )
}
