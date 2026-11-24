/**
 * Platform owners run sts-ai itself (not one business). They are listed by email in the
 * OWNER_EMAILS env var, comma separated, and are the only people who see platform settings
 * such as the trigger.dev keys in /integrations.
 */
export function isPlatformOwner(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase()
  if (!normalized) return false
  const owners = (process.env.OWNER_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  return owners.includes(normalized)
}
