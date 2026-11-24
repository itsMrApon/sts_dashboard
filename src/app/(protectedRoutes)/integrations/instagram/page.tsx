import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { prismaClient } from '@/lib/prismaClient'
import { instagramAppConfig } from '@/lib/instagram/graph'
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
export default async function InstagramIntegrationPage({ searchParams }: Props) {
  const [query, auth] = await Promise.all([searchParams, onAuthenticateUser()])
  if (!auth.user) redirect('/sign-in')
  const [connection, campaigns] = await Promise.all([
    prismaClient.instagramConnection.findUnique({
      where: { userId: auth.user.id },
      select: { username: true, tokenExpiresAt: true, webhookSubscribed: true },
    }),
    prismaClient.instagramCampaign.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: 'desc' } }),
  ])

  return (
    <PageViewport scrollable>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-2">
        <Link href="/integrations" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Integrations
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Instagram</h1>
          <p className="text-sm text-muted-foreground">
            When someone comments a keyword on your post, they get a DM from you and become a lead.
          </p>
        </div>
        {query.error ? <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm">{ERRORS[query.error] ?? 'Something went wrong.'}</p> : null}
        {query.connected ? <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm">Instagram connected.</p> : null}
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
    </PageViewport>
  )
}
