import Sidebar from '@/components/layout/Sidebar'
import LeadNotificationProvider from '@/components/LeadNotificationProvider'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        {children}
      </div>
      <LeadNotificationProvider />
    </div>
  )
}
