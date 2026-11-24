import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api(.*)',
  // Public services, keyed by the business room: /chat, /speak, /form, /business.
  '/speak/:roomName',
  '/form/:roomName',
  '/business/:roomName',
  // Live link: waiting room and the live session room.
  '/live/:slug',
  '/live/:slug/room',
  // Buyer share links. Not '/o(.*)': that would also make /onboarding public.
  '/o/:slug',
  '/o/:slug/opengraph-image(.*)',
  '/pay/:slug',
  // A customer's private review link.
  '/review/:token',
  '/chat(.*)',
  // Public tour player only — /wizard (list) and /wizard/:slug/configure stay protected.
  '/wizard/:slug',
  '/callback(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
