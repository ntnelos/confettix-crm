'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface NewLeadToast {
  id: string
  source: 'website' | 'whatsapp'
  sender_name: string | null
  sender_phone: string | null
  company_name: string | null
  is_existing_customer: boolean
  created_at: string
}

// Soft notification sound via Web Audio API (no mp3 needed)
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // Friendly 3-note chime: G5 → A5 → B5
    const notes = [784, 880, 988]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.15
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.3, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
      osc.start(t)
      osc.stop(t + 0.4)
    })
  } catch {
    // Audio API not available (e.g. SSR)
  }
}

let toastIdCounter = 0

export default function LeadNotificationProvider() {
  const supabase = createClient()
  const [toasts, setToasts] = useState<(NewLeadToast & { _toastId: number })[]>([])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const removeToast = useCallback((toastId: number) => {
    setToasts(prev => prev.filter(t => t._toastId !== toastId))
  }, [])

  const addToast = useCallback((lead: NewLeadToast) => {
    const _toastId = ++toastIdCounter
    setToasts(prev => [{ ...lead, _toastId }, ...prev].slice(0, 5)) // max 5 toasts
    playNotificationSound()

    // Auto-dismiss after 8 seconds
    setTimeout(() => removeToast(_toastId), 8000)
  }, [removeToast])

  useEffect(() => {
    // Subscribe to new leads via Supabase Realtime
    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          const lead = payload.new as NewLeadToast
          addToast(lead)
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, addToast])

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 10,
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => (
        <div
          key={toast._toastId}
          style={{
            pointerEvents: 'auto',
            background: 'white',
            border: '1px solid #e2e8f0',
            borderLeft: `4px solid ${toast.source === 'whatsapp' ? '#25D366' : '#3b82f6'}`,
            borderRadius: 12,
            padding: '14px 16px',
            minWidth: 280,
            maxWidth: 340,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            animation: 'slideInRight 0.3s ease-out',
          }}
        >
          {/* Icon */}
          <div style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>
            {toast.source === 'whatsapp' ? '💬' : '🌐'}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 700,
              fontSize: 13,
              color: '#1e293b',
              marginBottom: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              ✨ ליד חדש נכנס!
              {toast.is_existing_customer && (
                <span style={{
                  fontSize: 10,
                  background: '#fce7f3',
                  color: '#be185d',
                  borderRadius: 10,
                  padding: '2px 6px',
                  fontWeight: 600,
                }}>
                  לקוח קיים
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>
              {toast.sender_name || 'ללא שם'}
            </div>
            {toast.sender_phone && (
              <div style={{ fontSize: 12, color: '#6b7280', direction: 'ltr', textAlign: 'right' }}>
                {toast.sender_phone}
              </div>
            )}
            {toast.company_name && (
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                🏢 {toast.company_name}
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <a
                href="/leads"
                style={{
                  fontSize: 12,
                  color: '#3b82f6',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                צפה בלידים ←
              </a>
            </div>
          </div>

          {/* Close */}
          <button
            onClick={() => removeToast(toast._toastId)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9ca3af',
              fontSize: 16,
              padding: 0,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      ))}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
