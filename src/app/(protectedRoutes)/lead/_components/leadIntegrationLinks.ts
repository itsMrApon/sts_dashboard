/** Fathom, Google OAuth and Serper are set up on /integrations, one box each. */
export const LEAD_INTEGRATION_LINKS = {
  fathom: '/integrations/fathom',
  google: '/integrations/google',
  serper: '/integrations/serper',
} as const

export type LeadIntegration = keyof typeof LEAD_INTEGRATION_LINKS

/** For toast actions and other places without a router at hand. */
export function openLeadIntegration(which: LeadIntegration) {
  window.location.assign(LEAD_INTEGRATION_LINKS[which])
}
