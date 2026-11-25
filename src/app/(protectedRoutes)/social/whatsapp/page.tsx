import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { SocialShell } from '../_components/SocialShell'
import { SetupLinks } from '@/components/integrations/SetupLinks'
import { SETUP_LINKS } from '@/lib/integrations/setupLinks'
import { publicBaseUrl } from '@/lib/offers/publicBaseUrl'
import { loadWhatsAppConnectionView, webhookUrl } from '@/lib/whatsapp/connection'
import { WhatsAppSettings } from '../_components/WhatsAppSettings'

/** The creator's own WhatsApp number, through their Kapso project. */
export default async function SocialWhatsAppPage() {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')
  const view = await loadWhatsAppConnectionView(auth.user.id)
  const baseUrl = publicBaseUrl() || process.env.NEXT_PUBLIC_APP_URL || ''

  return (
    <SocialShell
      title="WhatsApp"
      description="Customers message your own WhatsApp number and your Chat AI answers them. Uses your Kapso project and your keys."
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <SetupLinks links={SETUP_LINKS.whatsapp.links} note={SETUP_LINKS.whatsapp.note} />
        <WhatsAppSettings view={view} webhookAddress={view.webhookToken ? webhookUrl(baseUrl, view.webhookToken) : null} />
      </div>
    </SocialShell>
  )
}
