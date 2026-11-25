import { CLI_CLIENT_LABEL, isCliClient, listCliTokens } from '@/lib/cli/cliAuth'
import { loadSocialContext } from './_lib/socialContext'
import { SocialShell } from './_components/SocialShell'
import { SocialFolders } from './_components/SocialFolders'

/**
 * Social home: a library of skills, prompts, n8n workflows, plugins and reports. The creator copies
 * one into their own AI agent, which builds the post, video or report with their business brain.
 * (Instagram and WhatsApp connections stay in Integrations.)
 */
export default async function SocialPage() {
  const { user } = await loadSocialContext()
  const tokens = await listCliTokens(user.id)
  const agents = tokens.map((token) => ({
    id: token.id,
    clientLabel: isCliClient(token.client) ? CLI_CLIENT_LABEL[token.client] : token.client,
    name: token.name,
    prefix: token.prefix,
    createdAt: token.createdAt.toISOString(),
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
  }))

  return (
    <SocialShell
      title="Social"
      description="Copy a skill, prompt or workflow into your AI agent. It builds the post, video, flyer or report with your business brain."
    >
      <SocialFolders agents={agents} />
    </SocialShell>
  )
}
