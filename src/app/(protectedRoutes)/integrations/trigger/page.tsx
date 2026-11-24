import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { SetupLinks } from '@/components/integrations/SetupLinks'
import { SETUP_LINKS } from '@/lib/integrations/setupLinks'
import { loadTriggerSettings } from '@/lib/jobs/triggerSettings'
import { isPlatformOwner } from '@/lib/platform/platformOwner'
import { TriggerSettingsBox } from '../_components/TriggerSettingsBox'
import { JobRunnerBox } from '../_components/JobRunnerBox'
import { activeJobProvider, loadInngestStatus } from '@/lib/jobs/jobProvider'

/** trigger.dev runs the platform's background jobs. Only platform owners see this page. */
export default async function TriggerIntegrationPage() {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')
  if (!isPlatformOwner(auth.user.email)) redirect('/integrations')
  const [settings, active, inngestStatus] = await Promise.all([loadTriggerSettings(), activeJobProvider(), loadInngestStatus()])

  return (
    <PageViewport scrollable>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-2">
        <Link href="/integrations" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm">
          <ArrowLeft className="size-4" />
          Integrations
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Background jobs</h1>
          <p className="text-muted-foreground text-sm">
            trigger.dev and Inngest can both run every creator&apos;s scheduled jobs. Only platform owners see this page.
          </p>
        </div>
        <JobRunnerBox
          active={active}
          triggerReady={settings.source !== 'none'}
          triggerEnvironment={settings.environment}
          inngest={inngestStatus}
        />
        <h2 className="pt-2 text-base font-semibold">trigger.dev</h2>
        <SetupLinks links={SETUP_LINKS.trigger.links} note={SETUP_LINKS.trigger.note} />
        <TriggerSettingsBox settings={settings} />
        <h2 className="pt-2 text-base font-semibold">Inngest</h2>
        <SetupLinks links={SETUP_LINKS.inngest.links} note={SETUP_LINKS.inngest.note} />
      </div>
    </PageViewport>
  )
}
