'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    invoice_footer: '',
    invoice_email: '',
    invoice_remarks: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSettings({
          invoice_footer: data.invoice_footer || '',
          invoice_email: data.invoice_email || '',
          invoice_remarks: data.invoice_remarks || ''
        });
        setIsLoaded(true);
      });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Failed to save settings');
      alert('ההגדרות נשמרו בהצלחה!');
    } catch (err: any) {
      alert(`שגיאה בשמירת הגדרות: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoaded) {
    return <div style={{ padding: 100, textAlign: 'center' }}><span className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--pink)' }} /></div>;
  }

  return (
    <>
      <div className="topbar">
        <div></div>
      </div>
      <div className="page-body">
        <div style={{ padding: '0 20px', maxWidth: 800, margin: '0 auto' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: 'var(--text-primary)' }}>הגדרות מערכת</h1>
          
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>עריכת פרטי חשבונית (Morning)</h2>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div className="form-group">
                <label>טקסט ב-Footer החשבונית</label>
                <textarea 
                  className="form-textarea" 
                  rows={4}
                  placeholder="לדוגמה: תודה על קלייתכם התשלום שולם מראש..."
                  value={settings.invoice_footer}
                  onChange={e => setSettings(s => ({ ...s, invoice_footer: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>הטקסט יופיע בתחתית החשבונית המופקת.</p>
              </div>

              <div className="form-group">
                <label>טקסט שיופיע במייל ללקוח</label>
                <textarea 
                  className="form-textarea" 
                  rows={4}
                  placeholder="שלום, מצורפת חשבונית מס..."
                  value={settings.invoice_email}
                  onChange={e => setSettings(s => ({ ...s, invoice_email: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>הטקסט יופיע בגוף המייל שישלח ללקוח ע"י מערכת מורנינג.</p>
              </div>

              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSave} 
                  disabled={isSaving}
                  style={{ padding: '10px 24px' }}
                >
                  {isSaving ? <span className="spinner" /> : 'שמור הגדרות'}
                </button>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </>
  );
}
