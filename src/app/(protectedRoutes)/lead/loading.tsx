import PageHeader from '@/components/ReusableComponent/PageHeader'
import { Brain, CalendarDays, PhoneCall } from 'lucide-react'
import { LeadDashboardSkeleton } from './_components/LeadDashboardSkeleton'
import { LeadViewport } from './_components/LeadViewport'

export default function LeadLoading() {
  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader
        leftIcon={<CalendarDays className="h-3 w-3" />}
        mainIcon={<PhoneCall className="h-12 w-12" />}
        rightIcon={<Brain className="h-4 w-4" />}
        heading="The home to all your Leads"
        placeholder="Search option..."
      />
      <LeadViewport>
        <LeadDashboardSkeleton />
      </LeadViewport>
    </div>
  )
}
