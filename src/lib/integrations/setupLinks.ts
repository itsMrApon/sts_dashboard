import type { SetupLink } from '@/lib/email/smtpProviders'

/**
 * The outside websites a creator opens to set up each integration, in the order they need
 * them. Shown as "Where to get it" on the integration's page. Every link was checked to open.
 */

export type IntegrationSetupLink = SetupLink & { detail?: string }

export const SETUP_LINKS: Record<string, { links: IntegrationSetupLink[]; note?: string }> = {
  whatsapp: {
    links: [
      { label: 'Open Kapso and make a project', href: 'https://app.kapso.ai', detail: 'free to start' },
      { label: 'Connect your WhatsApp number', href: 'https://docs.kapso.ai/docs/how-to/whatsapp/connect-whatsapp', detail: 'then copy its Phone number ID' },
      { label: 'Make an API key', href: 'https://app.kapso.ai', detail: 'Project settings → API keys' },
      { label: 'Add the webhook below in Kapso', href: 'https://docs.kapso.ai/docs/platform/webhooks/overview', detail: 'event whatsapp.message.received, with a secret key' },
    ],
    note: 'Kapso handles Meta’s WhatsApp setup for you. Your keys stay in your own Kapso project.',
  },
  instagram: {
    links: [
      { label: 'Switch to a Business or Creator account', href: 'https://help.instagram.com/502981923235522', detail: 'in the Instagram app, free' },
    ],
    note: 'Then press Connect Instagram and log in. No keys to copy.',
  },
  /** For the platform owner: the one Meta app every creator logs in through. */
  instagramPlatform: {
    links: [
      { label: 'Make a Meta app (type Business)', href: 'https://developers.facebook.com/apps' },
      { label: 'Add Instagram → API setup with Instagram login', href: 'https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login' },
      { label: 'Verify your business', href: 'https://business.facebook.com/settings/security', detail: 'needed before App Review' },
    ],
    note: 'Set the redirect and webhook addresses shown below in the app, add yourself as a tester, then send it to App Review for instagram_business_manage_comments and instagram_business_manage_messages.',
  },
  fathom: {
    links: [
      { label: 'Open Fathom', href: 'https://fathom.video' },
      { label: 'Make an API key', href: 'https://fathom.video/customize', detail: 'Settings → API Access' },
      { label: 'Fathom API guide', href: 'https://developers.fathom.ai/quickstart' },
    ],
  },
  google: {
    links: [
      { label: 'Make an OAuth client (Web application)', href: 'https://console.cloud.google.com/apis/credentials', detail: 'add the redirect address shown here' },
      { label: 'Set up the consent screen', href: 'https://console.cloud.google.com/apis/credentials/consent' },
      { label: 'Turn on the Google Calendar API', href: 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com' },
      { label: 'Turn on the Google Drive API', href: 'https://console.cloud.google.com/apis/library/drive.googleapis.com', detail: 'for files visitors upload in chat' },
    ],
  },
  serper: {
    links: [
      { label: 'Sign up for Serper', href: 'https://serper.dev/signup', detail: '2,500 free searches' },
      { label: 'Copy your API key', href: 'https://serper.dev/api-keys' },
    ],
  },
  trigger: {
    links: [
      { label: 'Open trigger.dev Cloud', href: 'https://cloud.trigger.dev', detail: 'free tier' },
      { label: 'Add the job environment variables', href: 'https://trigger.dev/docs/deploy-environment-variables' },
    ],
  },
  inngest: {
    links: [
      { label: 'Sign up for Inngest', href: 'https://app.inngest.com/sign-up', detail: 'free: 50,000 runs a month, no card' },
      { label: 'Copy the Event key and Signing key', href: 'https://app.inngest.com', detail: 'Production → Manage → Event keys / Signing key' },
      { label: 'How the worker connects', href: 'https://www.inngest.com/docs/setup/connect' },
    ],
    note: 'Put INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY in .env.production, then deploy the app and the sts-jobs-worker container. Nothing else to deploy: the jobs run on your server.',
  },
  medusa: {
    links: [
      { label: 'Medusa docs', href: 'https://docs.medusajs.com' },
      { label: 'Give it a public address (Cloudflare Tunnel)', href: 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/' },
    ],
  },
  erpnext: {
    links: [
      { label: 'ERPNext docs', href: 'https://docs.frappe.io/erpnext', detail: 'make an API key and secret for a user' },
      { label: 'Give it a public address (Cloudflare Tunnel)', href: 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/' },
    ],
  },
  n8n: {
    links: [
      { label: 'Turn on n8n’s MCP server', href: 'https://docs.n8n.io/advanced-ai/accessing-n8n-mcp-server/' },
      { label: 'Give it a public address (Cloudflare Tunnel)', href: 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/' },
    ],
  },
  openseo: {
    links: [
      { label: 'Install OpenSEO', href: 'https://github.com/every-app/open-seo' },
      { label: 'Give it a public address (Cloudflare Tunnel)', href: 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/' },
    ],
  },
  custom: {
    links: [{ label: 'What an MCP server is', href: 'https://modelcontextprotocol.io' }],
  },
}

export function setupLinksFor(kind: string) {
  return SETUP_LINKS[kind] ?? null
}
