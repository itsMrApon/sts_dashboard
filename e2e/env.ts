/** Which smoke groups can run here, based on the secrets present. */

function present(name: string): boolean {
  return !!process.env[name]?.trim()
}

export function hasSignedInEnv(): boolean {
  return present('CLERK_SECRET_KEY') && present('CLERK_PUBLISHABLE_KEY') && present('E2E_CLERK_USER_EMAIL')
}

export function hasWebhookEnv(): boolean {
  return present('STRIPE_WEBHOOK_SECRET')
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}
