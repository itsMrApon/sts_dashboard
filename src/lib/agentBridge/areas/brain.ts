import 'server-only'
import { brainToMarkdown, loadApprovedReviews, loadBusinessBrain } from '@/lib/mcp/businessBrain'
import { int, type AgentTool } from '../types'

const NO_BUSINESS = 'This account has no business set up yet. Finish onboarding in sts-ai first.'
const EMPTY = { type: 'object', properties: {}, additionalProperties: false }

/** The business brain: what everything the agent writes should be based on. */
export const BRAIN_TOOLS: AgentTool[] = [
  {
    kind: 'read',
    name: 'get_business_brain',
    area: 'brain',
    title: 'Business brain',
    description:
      'Everything about the creator’s business in one markdown document: name, description, business page, offers with links and prices, social accounts, latest approved reviews and the business knowledge their own AI assistant uses. Call this first.',
    inputSchema: EMPTY,
    async run(ctx) {
      const [brain, reviews] = await Promise.all([loadBusinessBrain(ctx.userId), loadApprovedReviews(ctx.userId, 5)])
      if (!brain) throw new Error(NO_BUSINESS)
      return brainToMarkdown(brain, reviews)
    },
  },
  {
    kind: 'read',
    name: 'list_offers',
    area: 'brain',
    title: 'Offers and links',
    description: 'The business’s live offers (products, services, webinars, projects) with their public page and buy links, as JSON.',
    inputSchema: EMPTY,
    async run(ctx) {
      const brain = await loadBusinessBrain(ctx.userId)
      if (!brain) throw new Error(NO_BUSINESS)
      const offers = { businessPageUrl: brain.businessPageUrl, primaryOfferUrl: brain.primaryOfferUrl, offers: brain.offers }
      return { text: JSON.stringify(offers, null, 2), structured: offers }
    },
  },
  {
    kind: 'read',
    name: 'list_reviews',
    area: 'brain',
    title: 'Approved reviews',
    description: 'Customer reviews the creator approved for public use, newest first. Reviewers are shown by first name only.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 50, description: 'How many reviews (default 20).' } },
      additionalProperties: false,
    },
    async run(ctx, input) {
      const reviews = await loadApprovedReviews(ctx.userId, int(input, 'limit', { min: 1, max: 50, fallback: 20 }))
      return { text: reviews.length ? JSON.stringify(reviews, null, 2) : 'No approved reviews yet.', structured: { reviews } }
    },
  },
]
