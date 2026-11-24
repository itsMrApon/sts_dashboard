import type { BusinessSiteContent } from '@/lib/business/siteContent'
import { socialUrl } from '@/lib/business/siteContent'

/**
 * schema.org data for the business page, so search engines can read the business name,
 * contact details and FAQ. Only filled fields are included; nothing is invented.
 */
export function businessStructuredData(input: {
  businessName: string
  description: string | null
  pageUrl: string
  content: BusinessSiteContent
  answers: { question: string; answer: string }[]
}): Record<string, unknown>[] {
  const { content, answers } = input
  const { footer } = content
  const sameAs = content.social.accounts
    .map((account) => account.url || socialUrl(account.platform, account.handle))
    .filter((url): url is string => Boolean(url))

  const business: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: input.businessName,
    url: input.pageUrl,
  }
  const description = content.seo.description || input.description
  if (description) business.description = description
  if (content.seo.ogImage) business.image = content.seo.ogImage
  if (footer.phone) business.telephone = footer.phone
  if (footer.email) business.email = footer.email
  if (footer.address) business.address = footer.address
  if (footer.mapUrl) business.hasMap = footer.mapUrl
  if (sameAs.length) business.sameAs = sameAs

  const data: Record<string, unknown>[] = [business]
  if (answers.length > 0) {
    data.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: answers.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    })
  }
  return data
}

/** JSON for a <script type="application/ld+json">, safe against "</script>" in creator text. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
