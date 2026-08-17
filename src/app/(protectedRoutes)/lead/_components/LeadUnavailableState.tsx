import { ConnectionLostToast } from '@/components/ReusableComponent/ConnectionLostToast'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Brain, CalendarDays, PhoneCall, WifiOff } from 'lucide-react'
import Link from 'next/link'

export function LeadUnavailableState() {
  return (
    <div className="flex w-full flex-col gap-8">
      <ConnectionLostToast />
      <PageHeader
        leftIcon={<CalendarDays className="h-3 w-3" />}
        mainIcon={<PhoneCall className="h-12 w-12" />}
        rightIcon={<Brain className="h-4 w-4" />}
        heading="The home to all your Leads"
        placeholder="Search option..."
      />
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
            <Link href="/lead">Try again</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
