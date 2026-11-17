import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright'
import { expect, test } from '@playwright/test'
import { hasSignedInEnv, optionalEnv } from './env'

// Needs a Clerk dev-instance test user (E2E_CLERK_USER_EMAIL) and CLERK_SECRET_KEY.
// Sign-in uses a backend sign-in token, so no password is stored anywhere.

test.describe('signed in', () => {
  test.skip(!hasSignedInEnv(), 'CLERK_SECRET_KEY / E2E_CLERK_USER_EMAIL not set')

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page })
    await page.goto('/sign-in')
    await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER_EMAIL!.trim() })
  })

  test('dashboard loads and the user API answers', async ({ page }) => {
    const response = await page.goto('/home')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/home/)
    await expect(page.getByRole('button', { name: /add service/i }).first()).toBeVisible()

    const api = await page.request.get('/api/user/tenants')
    expect(api.status()).toBe(200)
  })

  test('voice room hands out a LiveKit token', async ({ page }) => {
    const roomName = optionalEnv('E2E_ROOM_NAME')
    test.skip(!roomName, 'E2E_ROOM_NAME not set')
    const response = await page.request.post('/api/livekit/connection-details', { data: { roomName } })
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.serverUrl).toMatch(/^wss?:\/\//)
    expect(typeof body.participantToken).toBe('string')
  })
})

test('offer share link renders for buyers', async ({ page }) => {
  const slug = optionalEnv('E2E_OFFER_SLUG')
  test.skip(!slug, 'E2E_OFFER_SLUG not set')
  const response = await page.goto(`/o/${slug}`)
  expect(response?.status()).toBe(200)
  await expect(page.getByText(/something went wrong/i)).toHaveCount(0)
})
