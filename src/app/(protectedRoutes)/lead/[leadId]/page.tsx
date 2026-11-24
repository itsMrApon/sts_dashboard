import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { ConnectionLostToast } from '@/components/ReusableComponent/ConnectionLostToast'
import { WifiOff } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { getCallIntelLeadDetail } from '@/actions/callIntel'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { LeadProfile } from '../_components/LeadProfile'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import Link from 'next/link'

function isUnavailable(
  data: Awaited<ReturnType<typeof getCallIntelLeadDetail>>,
): data is { unavailable: true } {
  return Boolean(data && typeof data === 'object' && 'unavailable' in data)
}

export default async function LeadProfilePage({
  params,
}: {
  params: Promise<{ leadId: string }>
}) {
  const { leadId } = await params
  const auth = await onAuthenticateUser()
  if (auth.status === 500) {
    return (
      <div className="flex w-full flex-col gap-8">
        <ConnectionLostToast />
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
              <Link href={`/lead/${leadId}`}>Try again</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  if (!auth.user) redirect('/sign-in')

  const [data, business] = await Promise.all([getCallIntelLeadDetail(leadId), getCreatorBusiness(auth.user.id)])
  if (isUnavailable(data)) {
    redirect('/lead/list')
  }
  if (!data) redirect('/lead/list')

  return (
    <PageViewport scrollable>
      <Suspense
        fallback={
          <Card className="h-full shadow-xs">
            <CardContent className="py-10 text-sm text-muted-foreground">
              Loading…
            </CardContent>
          </Card>
        }
      >
        <LeadProfile
          lead={JSON.parse(JSON.stringify(data.lead))}
          businessName={business?.name || 'your business'}
          hasGeminiKey={data.hasGeminiKey}
        />
      </Suspense>
    </PageViewport>
  )
}
