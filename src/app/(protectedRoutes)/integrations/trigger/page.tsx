import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { loadTriggerSettings } from '@/lib/jobs/triggerSettings'
import { isPlatformOwner } from '@/lib/platform/platformOwner'
import { TriggerSettingsBox } from '../_components/TriggerSettingsBox'

/** trigger.dev runs the platform's background jobs. Only platform owners see this page. */
export default async function TriggerIntegrationPage() {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')
  if (!isPlatformOwner(auth.user.email)) redirect('/integrations')
  const settings = await loadTriggerSettings()

  return (
    <PageViewport scrollable>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-2">
        <Link href="/integrations" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm">
          <ArrowLeft className="size-4" />
          Integrations
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">trigger.dev</h1>
          <p className="text-muted-foreground text-sm">
            Runs the daily lead jobs for every creator. Only platform owners see this page.
          </p>
        </div>
        <TriggerSettingsBox settings={settings} />
      </div>
    </PageViewport>
  )
}
