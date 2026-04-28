'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface RejectionReason { id: string; label: string; sort_order: number; }
interface InventoryLocation { id: string; name: string; sort_order: number; }

export default function SettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState({ invoice_footer: '', invoice_email: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const [reasons, setReasons] = useState<RejectionReason[]>([]);
  const [newReasonLabel, setNewReasonLabel] = useState('');
  const [addingReason, setAddingReason] = useState(false);

  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [newLocationName, setNewLocationName] = useState('');
  const [addingLocation, setAddingLocation] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingLocationName, setEditingLocationName] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSettings({ invoice_footer: data.invoice_footer || '', invoice_email: data.invoice_email || '' });
        setIsLoaded(true);
      });
    (supabase.from('lead_rejection_reasons').select('*').order('sort_order') as any)
      .then(({ data }: any) => { if (data) setReasons(data); });
    (supabase.from('inventory_locations').select('*').order('sort_order') as any)
      .then(({ data }: any) => { if (data) setLocations(data); });
  }, []);

  const handleSaveInvoice = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      if (!res.ok) throw new Error('Failed to save');
      alert('ההגדרות נשמרו!');
    } catch (err: any) { alert(`שגיאה: ${err.message}`); }
    finally { setIsSaving(false); }
  };

  const handleAddReason = async () => {
    if (!newReasonLabel.trim()) return;
    setAddingReason(true);
    const maxOrder = reasons.length > 0 ? Math.max(...reasons.map(r => r.sort_order)) + 1 : 1;
    const { data, error } = await (supabase.from('lead_rejection_reasons') as any).insert({ label: newReasonLabel.trim(), sort_order: maxOrder }).select().single();
    if (data) { setReasons(prev => [...prev, data]); setNewReasonLabel(''); }
    else if (error) alert(`שגיאה: ${error.message}`);
    setAddingReason(false);
  };

  const handleDeleteReason = async (id: string) => {
    if (!window.confirm('למחוק סיבה זו?')) return;
    await (supabase.from('lead_rejection_reasons') as any).delete().eq('id', id);
    setReasons(prev => prev.filter(r => r.id !== id));
  };

  const handleAddLocation = async () => {
    if (!newLocationName.trim()) return;
    setAddingLocation(true);
    const maxOrder = locations.length > 0 ? Math.max(...locations.map(l => l.sort_order)) + 1 : 1;
    const { data, error } = await (supabase.from('inventory_locations') as any).insert({ name: newLocationName.trim(), sort_order: maxOrder }).select().single();
    if (data) { setLocations(prev => [...prev, data]); setNewLocationName(''); }
    else if (error) alert(`שגיאה: ${error.message}`);
    setAddingLocation(false);
  };

  const handleDeleteLocation = async (id: string) => {
    if (!window.confirm('למחוק מיקום זה?')) return;
    await (supabase.from('inventory_locations') as any).delete().eq('id', id);
    setLocations(prev => prev.filter(l => l.id !== id));
  };

  const handleSaveLocationName = async (id: string) => {
    if (!editingLocationName.trim()) return;
    const { error } = await (supabase.from('inventory_locations') as any).update({ name: editingLocationName.trim() }).eq('id', id);
    if (!error) {
      setLocations(prev => prev.map(l => l.id === id ? { ...l, name: editingLocationName.trim() } : l));
      setEditingLocationId(null);
    } else alert(`שגיאה: ${error.message}`);
  };

  if (!isLoaded) return <div style={{ padding: 100, textAlign: 'center' }}><span className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--pink)' }} /></div>;

  return (
    <>
      <div className="topbar"><div /></div>
      <div className="page-body">
        <div style={{ padding: '0 20px', maxWidth: 800, margin: '0 auto' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>הגדרות מערכת</h1>

          {/* System Operations */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header" style={{ padding: '20px 24px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>⚙️</span> פעולות מערכת
              </h2>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px 0' }}>ניהול לוגים</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>צפה בהיסטוריית שגיאות ופעולות מערכת, כולל תקלות מול ה-API של מורנינג.</p>
                </div>
                <a href="/settings/logs" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: 13, textDecoration: 'none' }}>צפייה בלוגים</a>
              </div>
            </div>
          </div>

          {/* Invoice Settings */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>עריכת פרטי חשבונית (Morning)</h2>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="form-group">
                <label>טקסט ב-Footer החשבונית</label>
                <textarea className="form-textarea" rows={4} placeholder="לדוגמה: תודה על קנייתכם..." value={settings.invoice_footer} onChange={e => setSettings(s => ({ ...s, invoice_footer: e.target.value }))} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }} />
              </div>
              <div className="form-group">
                <label>טקסט שיופיע במייל ללקוח</label>
                <textarea className="form-textarea" rows={4} placeholder="שלום, מצורפת חשבונית מס..." value={settings.invoice_email} onChange={e => setSettings(s => ({ ...s, invoice_email: e.target.value }))} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handleSaveInvoice} disabled={isSaving} style={{ padding: '10px 24px' }}>
                  {isSaving ? <span className="spinner" /> : 'שמור הגדרות'}
                </button>
              </div>
            </div>
          </div>

          {/* Inventory Locations */}
          <div className="card" style={{ marginBottom: 24, overflow: 'hidden' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>📍</span> מיקומי מלאי
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
                  נהל את המחסנים ונקודות המלאי בארגון.
                </p>
              </div>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {locations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', background: 'var(--surface-2)', borderRadius: 16, border: '1px dashed var(--border)' }}>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>אין מיקומים מוגדרים עדיין.</p>
                  </div>
                ) : locations.map(loc => (
                  <div 
                    key={loc.id} 
                    className="location-row"
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '12px 16px', 
                      borderRadius: 14, 
                      border: '1px solid var(--border)', 
                      background: 'var(--surface)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {editingLocationId === loc.id ? (
                      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                        <input
                          className="form-input"
                          style={{ flex: 1, margin: 0, padding: '8px 12px', fontSize: 14 }}
                          value={editingLocationName}
                          onChange={e => setEditingLocationName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveLocationName(loc.id); if (e.key === 'Escape') setEditingLocationId(null); }}
                          autoFocus
                        />
                        <button onClick={() => handleSaveLocationName(loc.id)} style={{ background: 'var(--pink)', color: '#fff', border: 'none', borderRadius: 10, padding: '0 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>שמור</button>
                        <button onClick={() => setEditingLocationId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>ביטול</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--pink-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pink)', fontSize: 16 }}>
                            📍
                          </div>
                          <span style={{ fontSize: 15, fontWeight: 600 }}>{loc.name}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button 
                            onClick={() => { setEditingLocationId(loc.id); setEditingLocationName(loc.name); }} 
                            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: 9, fontSize: 12, fontWeight: 600 }}
                          >
                            עריכה
                          </button>
                          <button 
                            onClick={() => handleDeleteLocation(loc.id)} 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '6px', borderRadius: 9, fontSize: 16, opacity: 0.7 }}
                            title="מחק מיקום"
                          >
                            ✕
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, background: 'var(--surface-2)', padding: 16, borderRadius: 16 }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="שם מיקום חדש (למשל: מחסן ראשי)" 
                  value={newLocationName} 
                  onChange={e => setNewLocationName(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleAddLocation()} 
                  style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--surface)' }} 
                />
                <button 
                  className="btn btn-primary" 
                  onClick={handleAddLocation} 
                  disabled={addingLocation || !newLocationName.trim()}
                  style={{ padding: '0 20px', borderRadius: 12 }}
                >
                  {addingLocation ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} /> : 'הוסף מיקום'}
                </button>
              </div>
            </div>
          </div>

          {/* Rejection Reasons */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>סיבות דחיית ליד</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>הרשימה תוצג בעת סימון ליד כ&quot;לא רלוונטי&quot;.</p>
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {reasons.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>אין סיבות מוגדרות עדיין.</p>
                ) : reasons.map(reason => (
                  <div key={reason.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                    <span style={{ fontSize: 14 }}>{reason.label}</span>
                    {reason.label !== 'לא לקוח' && (
                      <button onClick={() => handleDeleteReason(reason.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px 8px', borderRadius: 6, fontSize: 13 }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input type="text" className="form-input" placeholder="סיבה חדשה, למשל: כמות קטנה מדי" value={newReasonLabel} onChange={e => setNewReasonLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddReason()} style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={handleAddReason} disabled={addingReason || !newReasonLabel.trim()}>
                  {addingReason ? <span className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> : '+ הוסף'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
