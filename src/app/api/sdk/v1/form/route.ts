import { EMBED_DAILY_QUOTAS, EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'
import { submitBusinessForm } from '@/lib/services/formSubmit'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { guardSdkRequest, sdkJson, sdkOptions, serviceDisabled } from '@/lib/sdk/sdkGuard'

export async function OPTIONS(request: Request) {
  return sdkOptions(request)
}

export async function GET(request: Request) {
  const guard = await guardSdkRequest(request, { scope: 'read', perIp: EMBED_RATE_LIMITS.read })
  if (!guard.ok) return guard.response
  const { form } = await getBusinessServices(guard.business.workspaceId)
  if (!form.enabled) return serviceDisabled(guard.corsHeaders, 'Form')
  // notifyEmail stays private; successMessage is returned after submit.
  const { title, description, fields, consentText, submitLabel } = form.config
  return sdkJson({ form: { title, description, fields, consentText, submitLabel } }, guard.corsHeaders)
}

export async function POST(request: Request) {
  const guard = await guardSdkRequest(request, {
    scope: 'form',
    perSession: EMBED_RATE_LIMITS.mobile,
    perIp: EMBED_RATE_LIMITS.mobile,
    dailyQuota: EMBED_DAILY_QUOTAS.mobile,
  })
  if (!guard.ok) return guard.response
  const { form } = await getBusinessServices(guard.business.workspaceId)
  if (!form.enabled) return serviceDisabled(guard.corsHeaders, 'Form')

  const body = (await request.json().catch(() => null)) as { values?: unknown; consent?: unknown } | null
  try {
    const result = await submitBusinessForm({
      ownerUserId: guard.business.userId,
      businessName: guard.business.name,
      config: form.config,
      values: body?.values,
      consent: body?.consent === true,
      source: 'sdk',
    })
    if (!result.ok) {
      return sdkJson({ error: result.error, code: result.code, fieldId: result.fieldId ?? null }, guard.corsHeaders, {
        status: result.status,
      })
    }
    return sdkJson({ ok: true, message: result.message }, guard.corsHeaders)
  } catch (error) {
    console.error('[sdk-form]', error)
    return sdkJson({ error: 'Could not submit the form', code: 'FORM_FAILED' }, guard.corsHeaders, { status: 500 })
  }
}
