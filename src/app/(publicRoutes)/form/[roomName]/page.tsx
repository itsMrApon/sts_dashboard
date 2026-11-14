import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadPublicBusiness, serviceAccess } from '@/lib/public/publicService'
import { PublicServiceShell, ServiceUnavailable } from '../../_components/PublicServiceShell'
import { FormRoom } from './_components/FormRoom'

type Props = { params: Promise<{ roomName: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomName } = await params
  const loaded = await loadPublicBusiness(decodeURIComponent(roomName))
  if (!loaded) return { title: 'Form', robots: { index: false } }
  const { config } = loaded.services.form
  return { title: `${config.title} · ${loaded.business.name}`, description: config.description }
}

/** Form service: the business's contact / callback form. */
export default async function FormServicePage({ params }: Props) {
  const { roomName } = await params
  const loaded = await loadPublicBusiness(decodeURIComponent(roomName))
  if (!loaded) notFound()

  const access = serviceAccess(loaded, 'form')
  return (
    <PublicServiceShell
      businessName={loaded.business.name}
      service="form"
      links={loaded.links}
      ownerPreview={access === 'owner-preview'}
    >
      {access === 'off' ? (
        <ServiceUnavailable title="This form isn't available right now" detail={`Please check back later or contact ${loaded.business.name}.`} />
      ) : (
        <FormRoom
          roomName={loaded.business.roomName}
          config={loaded.services.form.config}
          chatHref={loaded.links.chat}
          defaultCountry={loaded.agent.language === 'bn' ? 'BD' : 'US'}
        />
      )}
    </PublicServiceShell>
  )
}
