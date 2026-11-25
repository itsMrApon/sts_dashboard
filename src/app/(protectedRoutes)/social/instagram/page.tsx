import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { SocialShell } from '../_components/SocialShell'
import { prismaClient } from '@/lib/prismaClient'
import { instagramAppConfig, instagramRedirectUri } from '@/lib/instagram/graph'
import { publicBaseUrl } from '@/lib/offers/publicBaseUrl'
import { isPlatformOwner } from '@/lib/platform/platformOwner'
import { SetupLinks } from '@/components/integrations/SetupLinks'
import { SETUP_LINKS } from '@/lib/integrations/setupLinks'
import { InstagramSettings } from '../_components/InstagramSettings'

type Props = { searchParams: Promise<{ connected?: string; error?: string }> }

const ERRORS: Record<string, string> = {
  denied: 'Instagram login was cancelled.',
  state: 'The login link expired. Try connecting again.',
  not_configured: 'Instagram is not set up on this server yet (the platform Meta app keys are missing).',
  account: 'Use an Instagram Business or Creator account.',
  exchange: 'Instagram did not accept the login. Try again, or check the app is set up for your account.',
}

/** Comment-to-DM: keywords on a post or reel send the commenter a DM and make them a lead. */
export default async function SocialInstagramPage({ searchParams }: Props) {
  const [query, auth] = await Promise.all([searchParams, onAuthenticateUser()])
  if (!auth.user) redirect('/sign-in')
  const [connection, campaigns] = await Promise.all([
    prismaClient.instagramConnection.findUnique({
      where: { userId: auth.user.id },
      select: { username: true, tokenExpiresAt: true, webhookSubscribed: true },
    }),
    prismaClient.instagramCampaign.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: 'desc' } }),
  ])

  const owner = isPlatformOwner(auth.user.email)
  const baseUrl = (publicBaseUrl() || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')

  return (
    <SocialShell title="Instagram" description="When someone comments a keyword on your post, they get a DM from you and become a lead.">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {query.error ? <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm">{ERRORS[query.error] ?? 'Something went wrong.'}</p> : null}
        {query.connected ? <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm">Instagram connected.</p> : null}
        <SetupLinks links={SETUP_LINKS.instagram.links} note={SETUP_LINKS.instagram.note} />
        {owner ? (
          <div className="space-y-2">
            <SetupLinks title="Platform owner: the Meta app" links={SETUP_LINKS.instagramPlatform.links} note={SETUP_LINKS.instagramPlatform.note} />
            <dl className="grid gap-1 rounded-xl border bg-card p-4 text-xs">
              <dt className="text-muted-foreground">OAuth redirect address</dt>
              <dd className="break-all font-mono">{instagramRedirectUri(baseUrl)}</dd>
              <dt className="mt-2 text-muted-foreground">Webhook callback address (fields: comments, messages)</dt>
              <dd className="break-all font-mono">{baseUrl}/api/instagram/webhook</dd>
              <dt className="mt-2 text-muted-foreground">Server settings</dt>
              <dd className="font-mono">INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_WEBHOOK_VERIFY_TOKEN</dd>
            </dl>
          </div>
        ) : null}
        <InstagramSettings
          configured={Boolean(instagramAppConfig())}
          connection={
            connection
              ? {
                  username: connection.username,
                  tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
                  webhookSubscribed: connection.webhookSubscribed,
                }
              : null
          }
          campaigns={campaigns.map((campaign) => ({
            id: campaign.id,
            mediaId: campaign.mediaId,
            mediaCaption: campaign.mediaCaption,
            mediaThumb: campaign.mediaThumb,
            keywords: campaign.keywords,
            matchMode: campaign.matchMode === 'word' ? 'word' : 'contains',
            dmText: campaign.dmText,
            linkUrl: campaign.linkUrl,
            publicReply: campaign.publicReply,
            askContact: campaign.askContact,
            active: campaign.active,
            matchedCount: campaign.matchedCount,
            sentCount: campaign.sentCount,
            contactsCount: campaign.contactsCount,
          }))}
        />
      </div>
    </SocialShell>
  )
}
