import { expect, test } from '@playwright/test'

// Needs no secrets: runs in CI, against a deploy candidate, and locally.

test('health: app and database are up', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.database).toBe('healthy')
})

test('sign-in page renders the Clerk form', async ({ page }) => {
  const response = await page.goto('/sign-in')
  expect(response?.status()).toBe(200)
  // The instance may offer only social sign-in (no email field), so check for the card itself.
  await expect(page.locator('.cl-signIn-root, .cl-cardBox').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /continue/i }).first()).toBeVisible()
})

test('logged out: a protected page sends the browser to sign-in', async ({ request }) => {
  const response = await request.get('/home', {
    maxRedirects: 0,
    headers: { accept: 'text/html', 'sec-fetch-dest': 'document' },
  })
  expect(response.status()).toBe(307)
  expect(response.headers()['location']).toMatch(/sign-in|handshake/)
})

test('logged out: a protected API answers 401', async ({ request }) => {
  const response = await request.get('/api/user/tenants', { maxRedirects: 0 })
  expect(response.status()).toBe(401)
})

test('an unknown offer share link is a 404, not a crash', async ({ request }) => {
  const response = await request.get(`/o/smoke-missing-${Date.now()}`)
  expect(response.status()).toBe(404)
})

test('text chat rejects a malformed request with 400', async ({ request }) => {
  const response = await request.post('/api/chat/smoke-missing-room', { data: {} })
  expect(response.status()).toBe(400)
})

test('voice connection rejects a request without a room with 400', async ({ request }) => {
  const response = await request.post('/api/livekit/connection-details', { data: {} })
  expect(response.status()).toBe(400)
})
