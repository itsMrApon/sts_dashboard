import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { siteContentFromLegacy } from '@/lib/business/siteContent'
import { prismaClient } from '@/lib/prismaClient'
import { buildAgentContext } from '@/lib/messages/buildAgentContext'
import { loadPublicBusiness, serviceAccess } from '@/lib/public/publicService'
import { accentHex } from '@/lib/services/types'
import { getPublicWizard } from '@/lib/wizard/wizardRepo'
import { businessStructuredData, jsonLdScript } from '@/lib/business/structuredData'
import { publicBaseUrl } from '@/lib/offers/publicBaseUrl'
import { loadSiteAnswers } from '@/lib/questions/questionGroups'
import { PublicServiceShell, ServiceUnavailable } from '../../_components/PublicServiceShell'
import { loadBusinessOffers, loadBusinessOffersForSite } from '@/lib/business/businessOffers'
import { BusinessSite } from './_components/BusinessSite'
import { BusinessRoom, type BusinessRoomPanels } from './_components/BusinessRoom'

type Props = { params: Promise<{ roomName: string }> }

/** Business + its site content (same source as Services → Business), loaded once per request. */
const loadSite = cache(async (roomName: string) => {
  const loaded = await loadPublicBusiness(roomName)
  if (!loaded) return null
  const [workspace, offers] = await Promise.all([
    prismaClient.workspace.findUnique({
      where: { id: loaded.business.workspaceId },
      select: { contextVertical: true, contextCoreJson: true, contextIndustryJson: true, contextSocialJson: true },
    }),
    loadBusinessOffers(loaded.business.publishProfileId),
  ])
  const content = siteContentFromLegacy({
    businessName: loaded.business.name,
    vertical: workspace?.contextVertical ?? null,
    core: workspace?.contextCoreJson,
    industry: workspace?.contextIndustryJson,
    social: workspace?.contextSocialJson,
  })
  return { loaded, content, offers }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomName } = await params
  const site = await loadSite(decodeURIComponent(roomName))
  if (!site) return { title: 'Business', robots: { index: false } }
  const title = site.content.seo.title || site.loaded.business.name
  const description = site.content.seo.description || site.loaded.business.description || undefined
  const images = site.content.seo.ogImage ? [site.content.seo.ogImage] : undefined
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', images },
    robots: site.loaded.sitePublished ? undefined : { index: false },
  }
}

/**
 * The business room: the creator's published site with every service on one page. An intro card
 * starts a voice tour that follows the visitor's scroll; Chat, Talk, Book a call and Pay now open
 * from the bar at the bottom. The old /chat, /speak, /form and /wizard pages redirect here.
 */
export default async function BusinessServicePage({ params }: Props) {
  const { roomName } = await params
  const site = await loadSite(decodeURIComponent(roomName))
  if (!site) notFound()

  const { loaded, content, offers } = site
  const { business, services } = loaded
  const siteAccess = serviceAccess(loaded, 'business')
  const chatAccess = serviceAccess(loaded, 'chat')
  const speakAccess = serviceAccess(loaded, 'speak')
  const formAccess = serviceAccess(loaded, 'form')

  // "Talk to a person" needs the business's social contacts; homePreview skips the AI prompt build.
  const needsContacts = (chatAccess !== 'off' && services.chat.config.showHumanHandoff) || speakAccess !== 'off'
  const [context, tour, siteOffers, answers] = await Promise.all([
    needsContacts ? buildAgentContext(business.roomName, { mode: 'homePreview' }) : null,
    loaded.wizardSlug ? getPublicWizard(loaded.wizardSlug, loaded.isOwner ? business.userId : null) : null,
    loadBusinessOffersForSite(business.publishProfileId, ''),
    siteAccess === 'off' ? [] : loadSiteAnswers(business.userId),
  ])

  const voice = services.speak.agent ?? loaded.agent
  const panels: BusinessRoomPanels = {
    chat:
      chatAccess === 'off'
        ? null
        : { agentName: services.chat.agent?.name ?? loaded.agent.name, config: services.chat.config, isOwner: loaded.isOwner },
    talk:
      speakAccess === 'off'
        ? null
        : {
            agentName: voice.name,
            firstMessage: voice.firstMessage || `Hi! I'm ${voice.name}. How can I help you today?`,
            config: services.speak.config,
          },
    form:
      formAccess === 'off'
        ? null
        : {
            config: services.form.config,
            defaultCountry: (services.form.agent?.language ?? loaded.agent.language) === 'bn' ? 'BD' : 'US',
          },
  }
  const payOffer = siteOffers.find((offer) => offer.featured && offer.links.pay) ?? siteOffers.find((offer) => offer.links.pay)
  const hasAnyService = Boolean(panels.chat || panels.talk || panels.form)

  // Nothing published and no service on: there is no room to show yet.
  if (siteAccess === 'off' && !hasAnyService) {
    return (
      <PublicServiceShell businessName={business.name} service="business" links={{}} wide>
        <div className="mx-auto w-full max-w-xl">
          <ServiceUnavailable title="This site isn't published yet" detail={`Please check back later or contact ${business.name}.`} />
        </div>
      </PublicServiceShell>
    )
  }

  const tagline = content.seo.description || business.description || content.footer.tagline || null
  // Search engines read the business details and FAQ only from a published site.
  const structuredData =
    siteAccess === 'live'
      ? businessStructuredData({
          businessName: business.name,
          description: business.description,
          pageUrl: `${publicBaseUrl()}/business/${encodeURIComponent(business.roomName)}`,
          content,
          answers,
        })
      : null

  return (
    <PublicServiceShell
      businessName={business.name}
      service="business"
      links={{}}
      ownerPreview={siteAccess === 'owner-preview'}
      wide
    >
      {structuredData ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(structuredData) }} />
      ) : null}
      <BusinessRoom
        roomName={business.roomName}
        businessName={business.name}
        tagline={tagline}
        accent={accentHex(content.appearance.accent)}
        tour={tour && tour.steps.length > 0 ? tour : null}
        panels={panels}
        socialAccounts={context?.socialAccounts ?? []}
        payHref={siteAccess === 'off' ? null : payOffer?.links.pay ?? null}
      >
        {siteAccess === 'off' ? (
          // Services are on but the site isn't published: a plain welcome instead of the site.
          <section data-sts-step="intro" className="pt-12 text-center">
            <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{business.name}</h1>
            {tagline ? <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-zinc-300">{tagline}</p> : null}
          </section>
        ) : (
          <BusinessSite
            businessName={business.name}
            description={business.description}
            content={content}
            offers={offers}
            links={loaded.links}
            answers={answers}
          />
        )}
      </BusinessRoom>
    </PublicServiceShell>
  )
}
