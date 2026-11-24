'use client'

import posthog from 'posthog-js'

/**
 * Visitor analytics for the public pages, through PostHog. Off unless NEXT_PUBLIC_POSTHOG_KEY
 * is set. Only page views and a few named steps are recorded, with the link's ?src= tag;
 * nothing typed by visitors is sent.
 */

let started = false

export function startAnalytics() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (started || !key || typeof window === 'undefined') return
  started = true
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    autocapture: false,
    disable_session_recording: false,
    mask_all_text: true,
  })
  const src = new URLSearchParams(window.location.search).get('src')
  if (src) posthog.register({ src: src.slice(0, 32) })
}

export type TrackedEvent = 'panel_opened' | 'tour_started' | 'form_submitted' | 'review_submitted' | 'ask_clicked'

export function track(event: TrackedEvent, properties: Record<string, string | number | boolean | null> = {}) {
  if (!started) return
  try {
    posthog.capture(event, properties)
  } catch {
    // Analytics must never break the page.
  }
}
