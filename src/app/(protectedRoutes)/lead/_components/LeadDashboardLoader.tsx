import { redirect } from 'next/navigation'
import { getCallIntelDashboard } from '@/actions/callIntel'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { WifiOff } from 'lucide-react'
import Link from 'next/link'
import { CallIntelDashboard } from './CallIntelDashboard'
import type { LeadViewMode } from './LeadPageHeaderControls'

function isUnavailable(
  data: Awaited<ReturnType<typeof getCallIntelDashboard>>,
): data is { unavailable: true } {
  return Boolean(data && typeof data === 'object' && 'unavailable' in data)
}

export async function LeadDashboardLoader({
  user,
  view,
}: {
  user: { id: string; email: string; name: string }
  view: LeadViewMode
}) {
  const data = await getCallIntelDashboard(user)
  if (isUnavailable(data)) {
    return (
      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <WifiOff className="h-4 w-4" />
            You&apos;re offline or the server can&apos;t be reached
          </CardTitle>
          <CardDescription>
            Check your internet connection, then reload this page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link href={`/lead/${view}`}>Try again</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }
  if (!data) redirect('/sign-in')

  return (
    <CallIntelDashboard
      view={view}
      connections={data.connections}
      settings={data.settings}
      setup={data.setup}
      agents={data.agents}
      leads={data.leads}
      searchBatches={data.searchBatches || []}
      importBatches={data.importBatches || []}
      calendarMonth={data.calendarMonth || null}
      serperConfigured={data.serperConfigured}
      geminiResearchReady={data.geminiResearchReady}
      googleOAuthConfigured={data.googleOAuthConfigured}
      hasGeminiKey={data.hasGeminiKey}
    />
  )
}
