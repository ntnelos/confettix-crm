import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'קונפטיקס CRM',
  description: 'מערכת ניהול לקוחות — קונפטיקס מתנות לארגונים',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
