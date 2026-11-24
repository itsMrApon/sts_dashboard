import { EMBED_DAILY_QUOTAS, EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'
import { saveChatUpload } from '@/lib/services/chatUpload'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { guardSdkRequest, sdkJson, sdkOptions, serviceDisabled } from '@/lib/sdk/sdkGuard'

export const runtime = 'nodejs'

export async function OPTIONS(request: Request) {
  return sdkOptions(request)
}

/** Website SDK: a document the chat asked for (multipart: `file`, optional `documentId`). */
export async function POST(request: Request) {
  const guard = await guardSdkRequest(request, {
    scope: 'chat',
    perSession: EMBED_RATE_LIMITS.mobile,
    perIp: EMBED_RATE_LIMITS.mobile,
    dailyQuota: EMBED_DAILY_QUOTAS.mobile,
  })
  if (!guard.ok) return guard.response
  const { chat } = await getBusinessServices(guard.business.workspaceId)
  if (!chat.enabled) return serviceDisabled(guard.corsHeaders, 'Chat AI')

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  const documentId = form?.get('documentId')
  const result = await saveChatUpload({
    ownerUserId: guard.business.userId,
    documentRequests: chat.config.documentRequests,
    file: file instanceof File ? file : null,
    documentId: typeof documentId === 'string' ? documentId : null,
  })
  if (!result.ok) return sdkJson({ error: result.error, code: result.code }, guard.corsHeaders, { status: result.status })
  return sdkJson({ ok: true, file: result.file, message: result.message }, guard.corsHeaders)
}
