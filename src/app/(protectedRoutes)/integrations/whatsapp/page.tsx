import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { publicBaseUrl } from '@/lib/offers/publicBaseUrl'
import { loadWhatsAppConnectionView, webhookUrl } from '@/lib/whatsapp/connection'
import { WhatsAppSettings } from '../_components/WhatsAppSettings'

/** The creator's own WhatsApp number, through their Kapso project. */
export default async function WhatsAppIntegrationPage() {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')
  const view = await loadWhatsAppConnectionView(auth.user.id)
  const baseUrl = publicBaseUrl() || process.env.NEXT_PUBLIC_APP_URL || ''

  return (
    <PageViewport scrollable>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-2">
        <Link href="/integrations" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Integrations
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Customers message your own WhatsApp number and your Chat AI answers them. Uses your Kapso project and your keys.
          </p>
        </div>
        <WhatsAppSettings view={view} webhookAddress={view.webhookToken ? webhookUrl(baseUrl, view.webhookToken) : null} />
      </div>
    </PageViewport>
  )
}
