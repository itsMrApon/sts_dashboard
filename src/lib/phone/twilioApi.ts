import 'server-only'

/**
 * The few Twilio REST calls a phone line needs, on the creator's own account (Account SID + Auth
 * Token). Calls go: caller → Twilio number → Elastic SIP trunk → LiveKit SIP → the Voice AI room.
 * Every call has a timeout and returns a result instead of throwing.
 */

const TWILIO_TIMEOUT_MS = 10000

export type TwilioAuth = { accountSid: string; authToken: string }
export type TwilioResult<T> = { ok: true; result: T } | { ok: false; error: string }
export type TwilioNumber = { sid: string; phoneNumber: string; friendlyName: string; trunkSid: string | null }

export const TWILIO_SID_RE = /^AC[0-9a-f]{32}$/i
export const TWILIO_TOKEN_RE = /^[0-9a-f]{32}$/i

async function twilio<T>(
  auth: TwilioAuth,
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  form?: Record<string, string>,
): Promise<TwilioResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        authorization: `Basic ${Buffer.from(`${auth.accountSid}:${auth.authToken}`).toString('base64')}`,
        ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
      signal: AbortSignal.timeout(TWILIO_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (response.status === 204) return { ok: true, result: null as T }
    const payload = (await response.json().catch(() => null)) as (T & { message?: string }) | null
    if (!response.ok) {
      if (response.status === 401) return { ok: false, error: 'Twilio did not accept the Account SID and Auth Token' }
      return { ok: false, error: payload?.message || `Twilio error ${response.status}` }
    }
    return { ok: true, result: payload as T }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    return { ok: false, error: timedOut ? 'Twilio did not answer in time' : 'Could not reach Twilio' }
  }
}

const API = 'https://api.twilio.com/2010-04-01'
const TRUNKING = 'https://trunking.twilio.com/v1'

/** Voice numbers on the account (first 100). */
export async function listTwilioNumbers(auth: TwilioAuth): Promise<TwilioResult<TwilioNumber[]>> {
  const result = await twilio<{
    incoming_phone_numbers: { sid: string; phone_number: string; friendly_name: string; trunk_sid: string | null; capabilities?: { voice?: boolean } }[]
  }>(auth, 'GET', `${API}/Accounts/${auth.accountSid}/IncomingPhoneNumbers.json?PageSize=100`)
  if (!result.ok) return result
  return {
    ok: true,
    result: result.result.incoming_phone_numbers
      .filter((number) => number.capabilities?.voice !== false)
      .map((number) => ({
        sid: number.sid,
        phoneNumber: number.phone_number,
        friendlyName: number.friendly_name,
        trunkSid: number.trunk_sid,
      })),
  }
}

/** A trunk that sends this number's calls to LiveKit. Returns the trunk SID. */
export async function createTwilioTrunkToLiveKit(
  auth: TwilioAuth,
  input: { name: string; livekitSipHost: string; numberSid: string },
): Promise<TwilioResult<string>> {
  const trunk = await twilio<{ sid: string }>(auth, 'POST', `${TRUNKING}/Trunks`, { FriendlyName: input.name.slice(0, 64) })
  if (!trunk.ok) return trunk
  const trunkSid = trunk.result.sid

  const origination = await twilio(auth, 'POST', `${TRUNKING}/Trunks/${trunkSid}/OriginationUrls`, {
    FriendlyName: 'LiveKit',
    SipUrl: `sip:${input.livekitSipHost}`,
    Weight: '1',
    Priority: '1',
    Enabled: 'true',
  })
  const attached = origination.ok
    ? await twilio(auth, 'POST', `${TRUNKING}/Trunks/${trunkSid}/PhoneNumbers`, { PhoneNumberSid: input.numberSid })
    : origination
  if (!attached.ok) {
    await deleteTwilioTrunk(auth, trunkSid)
    return attached
  }
  return { ok: true, result: trunkSid }
}

/** Removing the trunk hands the number back to its own voice settings in Twilio. */
export function deleteTwilioTrunk(auth: TwilioAuth, trunkSid: string) {
  return twilio<null>(auth, 'DELETE', `${TRUNKING}/Trunks/${trunkSid}`)
}
