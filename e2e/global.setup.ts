import { clerkSetup } from '@clerk/testing/playwright'
import { test as setup } from '@playwright/test'
import { hasSignedInEnv } from './env'

setup.describe.configure({ mode: 'serial' })

// Clerk's testing token lets Playwright get past bot protection on the dev instance.
// Only needed for the signed-in journeys.
setup('clerk testing token', async () => {
  setup.skip(!hasSignedInEnv(), 'CLERK_SECRET_KEY / E2E_CLERK_USER_EMAIL not set')
  await clerkSetup()
})
