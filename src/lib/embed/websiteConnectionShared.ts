import { isLocalhostOrigin } from './origin'

/** Shared by server actions (the go-live gate) and the client (the connect pop-up). */
export type WebsiteConnection = {
  connected: boolean
  origin: string | null
  /**
   * Every allowed address is localhost: services work while testing, but the live website is
   * refused (ORIGIN_NOT_ALLOWED) until its address is added.
   */
  localOnly: boolean
}

export const WEBSITE_REQUIRED_ERROR = 'Connect your website first (Services → Connection), then publish.'

/** localhost / 127.0.0.1 on any port: allowed for testing, never the live website. Same rule as the origin gate. */
export const isLocalOrigin = isLocalhostOrigin

/** The connection a list of allowed origins gives: the live address first, localhost as a fallback. */
export function connectionFromOrigins(origins: string[]): WebsiteConnection {
  const live = origins.find((o) => !isLocalOrigin(o)) ?? null
  const origin = live ?? origins[0] ?? null
  return { connected: origin !== null, origin, localOnly: origin !== null && live === null }
}
