import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadPublicBusiness, serviceAccess } from '@/lib/public/publicService'
import { cn } from '@/lib/utils'
import { BusinessMark, FormRoom } from './_components/FormRoom'

type Props = { params: Promise<{ roomName: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomName } = await params
  const loaded = await loadPublicBusiness(decodeURIComponent(roomName))
  if (!loaded) return { title: 'Form', robots: { index: false } }
  const { config } = loaded.services.form
  return { title: `${config.title} · ${loaded.business.name}`, description: config.description }
}

/** Form service: a full-screen, one-question-at-a-time form (no site chrome, Typeform style). */
export default async function FormServicePage({ params }: Props) {
  const { roomName } = await params
  const loaded = await loadPublicBusiness(decodeURIComponent(roomName))
  if (!loaded) notFound()

  const access = serviceAccess(loaded, 'form')
  const { config } = loaded.services.form

  if (access === 'off') {
    return (
      <div
        className={cn(
          'fixed inset-0 flex flex-col px-6 py-5',
          config.theme === 'light' ? 'bg-[#fafafa] text-zinc-900' : 'bg-[#0b0b10] text-zinc-50',
        )}
      >
        <BusinessMark name={loaded.business.name} theme={config.theme} />
        <div className="mx-auto flex max-w-md flex-1 flex-col justify-center text-center">
          <h1 className="text-xl font-medium">This form isn&apos;t available right now</h1>
          <p className="mt-2 text-sm opacity-70">Please check back later or contact {loaded.business.name}.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {access === 'owner-preview' ? (
        <div className="fixed inset-x-0 top-1 z-20 bg-amber-400 px-4 py-1.5 text-center text-xs font-medium text-black">
          Only you can see this. Form is off.{' '}
          <Link href="/messages/form" className="underline underline-offset-2">
            Turn it on
          </Link>{' '}
          to share it.
        </div>
      ) : null}
      <FormRoom
        roomName={loaded.business.roomName}
        businessName={loaded.business.name}
        config={config}
        chatHref={loaded.links.chat}
        defaultCountry={loaded.agent.language === 'bn' ? 'BD' : 'US'}
      />
    </>
  )
}
