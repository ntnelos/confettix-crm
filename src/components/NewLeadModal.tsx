'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Contact {
  id: string
  name: string
  phone: string | null
  mobile?: string | null
  email?: string | null
  organizations?: { name: string } | null
}

interface NewLeadModalProps {
  onClose: () => void
  onSuccess: () => void
  prefilledContactId?: string
}

export default function NewLeadModal({ onClose, onSuccess, prefilledContactId }: NewLeadModalProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  // Search state
  const [contacts, setContacts] = useState<Contact[]>([])
  const [searchContactText, setSearchContactText] = useState('')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    sender_name: '',
    sender_phone: '',
    sender_email: '',
    company_name: '',
    message: '',
    gift_type: '',
    estimated_quantity: ''
  })

  // Load prefilled contact if provided
  useEffect(() => {
    if (prefilledContactId) {
      const fetchPrefilled = async () => {
        const { data } = await supabase
          .from('contacts')
          .select('id, name, phone, mobile, email, organizations(name)')
          .eq('id', prefilledContactId)
          .single()
        
        if (data) {
          handleSelectContact(data as any)
        }
      }
      fetchPrefilled()
    }
  }, [supabase, prefilledContactId])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchContactText.length >= 2) {
        setIsSearching(true)
        const { data } = await supabase
          .from('contacts')
          .select('id, name, phone, mobile, email, organizations(name)')
          .or(`name.ilike.%${searchContactText}%,phone.ilike.%${searchContactText}%,mobile.ilike.%${searchContactText}%`)
          .limit(20)
        
        if (data) {
          setContacts(data as any)
        }
        setIsSearching(false)
      } else {
        setContacts([])
      }
    }, 300)
    
    return () => clearTimeout(timer)
  }, [searchContactText, supabase])

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact)
    setSearchContactText('')
    setFormData(prev => ({
      ...prev,
      sender_name: contact.name || '',
      sender_phone: contact.mobile || contact.phone || '',
      sender_email: contact.email || '',
      company_name: contact.organizations?.name || prev.company_name
    }))
  }

  const handleClearContact = () => {
    setSelectedContact(null)
    setFormData(prev => ({
      ...prev,
      sender_name: '',
      sender_phone: '',
      sender_email: '',
      company_name: ''
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const payload = {
      source: 'manual',
      status: 'new',
      sender_name: formData.sender_name || null,
      sender_phone: formData.sender_phone || null,
      sender_email: formData.sender_email || null,
      company_name: formData.company_name || null,
      message: formData.message || null,
      gift_type: formData.gift_type || null,
      estimated_quantity: formData.estimated_quantity ? parseInt(formData.estimated_quantity, 10) : null,
      matched_contact_id: selectedContact?.id || null,
      is_existing_customer: !!selectedContact
    }

    const { error } = await supabase.from('leads').insert(payload)

    setLoading(false)
    if (error) {
      alert(`שגיאה ביצירת ליד: ${error.message}`)
    } else {
      onSuccess()
    }
  }

  const filteredContacts = contacts

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '550px', padding: '32px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>הוספת ליד ידני</h2>

        {!prefilledContactId && (
          <div className="form-group">
            <label>חפש איש קשר קיים במערכת (אופציונלי)</label>
            {selectedContact ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>👤</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedContact.name}</div>
                    {(selectedContact.phone || selectedContact.organizations?.name) && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {[selectedContact.phone, selectedContact.organizations?.name].filter(Boolean).join(' • ')}
                      </div>
                    )}
                  </div>
                </div>
                <button type="button" onClick={handleClearContact} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '4px 8px' }}>
                  הסר בחירה
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="הקלד לפחות 2 אותיות לחיפוש איש קשר..." 
                  value={searchContactText}
                  onChange={e => setSearchContactText(e.target.value)}
                />
                {searchContactText.length >= 2 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
                    {isSearching ? (
                      <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <span className="spinner" style={{ width: 14, height: 14, borderTopColor: 'var(--pink)' }} />
                        מחפש...
                      </div>
                    ) : filteredContacts.length > 0 ? (
                      filteredContacts.map(c => (
                        <div 
                          key={c.id} 
                          onClick={() => handleSelectContact(c)}
                          style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}
                        >
                          <div style={{ background: 'var(--surface-2)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {[c.mobile || c.phone, c.organizations?.name].filter(Boolean).join(' • ')}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>לא נמצאו אנשי קשר</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {prefilledContactId && selectedContact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 20 }}>
            <span style={{ fontSize: 20 }}>👤</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedContact.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>שיוך לאיש קשר זה</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>שם איש הקשר</label>
              <input 
                required 
                className="form-input" 
                value={formData.sender_name} 
                onChange={e => setFormData(p => ({ ...p, sender_name: e.target.value }))} 
              />
            </div>
            <div className="form-group">
              <label>טלפון</label>
              <input 
                className="form-input" 
                value={formData.sender_phone} 
                onChange={e => setFormData(p => ({ ...p, sender_phone: e.target.value }))} 
                style={{ direction: 'ltr', textAlign: 'right' }}
              />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>חברה / ארגון</label>
              <input 
                className="form-input" 
                value={formData.company_name} 
                onChange={e => setFormData(p => ({ ...p, company_name: e.target.value }))} 
              />
            </div>
            <div className="form-group">
              <label>אימייל</label>
              <input 
                type="email" 
                className="form-input" 
                value={formData.sender_email} 
                onChange={e => setFormData(p => ({ ...p, sender_email: e.target.value }))} 
                style={{ direction: 'ltr', textAlign: 'right' }}
              />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>סוג אירוע / מתנה (אופציונלי)</label>
              <input 
                className="form-input" 
                placeholder="לדוגמה: מתנות חג, כנס..."
                value={formData.gift_type} 
                onChange={e => setFormData(p => ({ ...p, gift_type: e.target.value }))} 
              />
            </div>
            <div className="form-group">
              <label>כמות משוערת</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="לדוגמה: 50"
                value={formData.estimated_quantity} 
                onChange={e => setFormData(p => ({ ...p, estimated_quantity: e.target.value }))} 
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>הודעה / פירוט נוסף</label>
            <textarea 
              className="form-input" 
              rows={3} 
              placeholder="פרטים רלוונטיים..."
              value={formData.message} 
              onChange={e => setFormData(p => ({ ...p, message: e.target.value }))} 
            />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>ביטול</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff', margin: 0 }} /> : 'שמור ליד'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
