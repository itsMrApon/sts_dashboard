import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ensureOfferTour, getOrCreateBusinessWizard, getWizardForOwner, listWizardProfiles } from '@/lib/wizard/wizardRepo'
import { cn } from '@/lib/utils'
import { loadMessagesContext } from '../_lib/messagesContext'
import { MessagesShell } from '../_components/MessagesShell'
import { WizardConfigurator } from './_components/configurator/WizardConfigurator'

type Props = { searchParams: Promise<{ product?: string }> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Wizard profiles: the business tour plus one per product (?product=<id>), each with its own
 * steps, voice and look. A product's profile is created with the product; older products get
 * theirs the first time it is opened here.
 */
export default async function WizardPage({ searchParams }: Props) {
  const [{ business }, { product }] = await Promise.all([loadMessagesContext(), searchParams])
  const productId = product && UUID_RE.test(product) ? product : null

  const wizard = productId
    ? await ensureOfferTour({ webinarId: productId, userId: business.userId }).then((slug) =>
        slug ? getWizardForOwner(slug, business.userId) : null,
      )
    : await getOrCreateBusinessWizard(business)
  if (!wizard) notFound()
  const profiles = await listWizardProfiles(business.userId)

  return (
    <MessagesShell
      businessName={business.name}
      title="Wizard"
      description="Narrated guided tours: one for your business, and one for each product's share link."
    >
      <nav aria-label="Wizard profiles" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
        {profiles.map((profile) => {
          const active = profile.webinarId === productId
          return (
            <Link
              key={profile.webinarId ?? 'business'}
              href={profile.webinarId ? `/messages/wizard?product=${profile.webinarId}` : '/messages/wizard'}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex max-w-[220px] shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                active ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-muted/60',
              )}
            >
              <span
                aria-hidden
                className={cn('h-1.5 w-1.5 shrink-0 rounded-full', profile.isPublished ? 'bg-emerald-500' : 'bg-zinc-500')}
              />
              <span className="truncate">{profile.label}</span>
            </Link>
          )
        })}
      </nav>
      {/* key: the editor's state is seeded from props, so each profile gets a fresh one. */}
      <WizardConfigurator key={wizard.slug} initialWizard={wizard} roomName={business.roomName} />
    </MessagesShell>
  )
}
