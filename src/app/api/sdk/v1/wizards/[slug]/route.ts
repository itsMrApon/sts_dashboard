import { prismaClient } from '@/lib/prismaClient'
import { EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'
import { getPublicWizard } from '@/lib/wizard/wizardRepo'
import { guardSdkRequest, sdkJson, sdkOptions } from '@/lib/sdk/sdkGuard'

type RouteContext = { params: Promise<{ slug: string }> }

export async function OPTIONS(request: Request) {
  return sdkOptions(request)
}

/** Published tour for this business. Audio URLs are plain GETs (an <audio> element can't send headers). */
export async function GET(request: Request, context: RouteContext) {
  const guard = await guardSdkRequest(request, { scope: 'read', perIp: EMBED_RATE_LIMITS.read })
  if (!guard.ok) return guard.response

  const { slug } = await context.params
  const owned = await prismaClient.voiceWizard.findFirst({
    where: { slug, userId: guard.business.userId, isPublished: true },
    select: { id: true },
  })
  const wizard = owned ? await getPublicWizard(slug, null) : null
  if (!wizard) return sdkJson({ error: 'Wizard not found', code: 'WIZARD_NOT_FOUND' }, guard.corsHeaders, { status: 404 })

  const origin = new URL(request.url).origin
  return sdkJson(
    {
      wizard: {
        slug: wizard.slug,
        name: wizard.name,
        guideName: wizard.guideName,
        language: wizard.language,
        steps: wizard.steps.map((step) => ({
          id: step.id,
          heading: step.heading,
          body: step.body,
          narration: step.narration || [step.heading, step.body].filter(Boolean).join('. '),
          target: step.target || null,
          ctaLabel: step.ctaLabel || null,
          ctaUrl: step.ctaUrl || null,
          audioUrl: step.audioVersion
            ? `${origin}/api/wizard/${encodeURIComponent(wizard.slug)}/audio/${encodeURIComponent(step.id)}?v=${step.audioVersion}`
            : null,
        })),
      },
    },
    guard.corsHeaders,
  )
}
