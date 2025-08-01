import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

// Lazy load SMS components
const SMSDashboard = lazy(() => import('@/pages/sms/SMSDashboard'))
const SMSCampaignWizard = lazy(() => import('@/pages/sms/SMSCampaignWizard'))
const SMSCampaignDetail = lazy(() => import('@/pages/sms/SMSCampaignDetail'))
const SMSAutomationDashboard = lazy(() => import('@/pages/sms/SMSAutomationDashboard'))
const SMSAutomationWizard = lazy(() => import('@/pages/sms/SMSAutomationWizard'))

export default function SMSRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route index element={<SMSDashboard />} />
        <Route path="new" element={<SMSCampaignWizard />} />
        <Route path=":id" element={<SMSCampaignDetail />} />
        <Route path="automations" element={<SMSAutomationDashboard />} />
        <Route path="automations/new" element={<SMSAutomationWizard />} />
        <Route path="automations/:id" element={<SMSAutomationWizard />} />
      </Routes>
    </Suspense>
  )
}