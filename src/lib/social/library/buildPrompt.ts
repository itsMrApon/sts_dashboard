import { NEEDS } from './needs'
import type { AgentClient, SocialItem, SocialKind } from './types'

/** The one setup command every prompt starts with. */
// Pinned to the release line (not '1'): npx reuses any cached copy that matches, so '1' could keep
// running an older 1.0 on a computer that ran it before. Bump with each CLI release.
export const STS_CLI_VERSION = '1.1'
export function stsInitCommand(client: AgentClient): string {
  return `npx --yes @sts-ai/cli@${STS_CLI_VERSION} init --client ${client} --write`
}

export const AGENT_CLIENT_LABEL: Record<AgentClient, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
}

const KIND_INTRO: Record<SocialKind, string> = {
  skill: 'Install and use an agent skill',
  prompt: 'Run a content task',
  workflow: 'Import and adapt an n8n workflow',
  plugin: 'Connect a plugin / MCP server',
  report: 'Build a recurring report',
}

function skillInstall(item: SocialItem, client: AgentClient): string[] {
  if (!item.skillPath) return [`Install the skill from ${item.source.url} following its README.`]
  const name = item.skillPath.split('/').pop()
  const target = client === 'claude' ? `.claude/skills/${name}` : client === 'codex' ? `.agents/skills/${name}` : `.cursor/skills/${name}`
  return [
    `Install the skill: clone ${item.source.url} (shallow) into a temp folder and copy \`${item.skillPath}\` to \`${target}\` in this project. If the repo ships a plugin for this agent, installing the plugin is fine too.`,
    'Read the skill’s SKILL.md fully before using it, and follow it.',
  ]
}

function workflowSteps(item: SocialItem): string[] {
  return [
    `Download the workflow JSON from ${item.workflowUrl} and read it: list every node, what it does, and every credential it needs.`,
    'Replace any hard-coded text (brand name, audience, tone, links, prices) with values from the sts-ai business brain. Keep Bangla text exactly as written.',
    'Import it into the creator’s n8n switched OFF (n8n MCP, or POST /api/v1/workflows with N8N_API_KEY). Tag it `sts-ai`.',
    'Tell the creator which credentials to add in n8n (credentials never travel inside a workflow) and which webhook URLs need the tunnel.',
    'Where the workflow publishes or sends anything, add an approval step first (Telegram or email “approve / skip”) unless the creator says otherwise.',
    'Run it once manually with test data, fix errors, and report what ran.',
  ]
}

/**
 * The text "Copy prompt" puts on the clipboard: a complete brief the creator pastes into their own
 * agent. It always starts by connecting the sts-ai business brain, then the item's tools and steps.
 */
export function buildSocialPrompt(item: SocialItem, client: AgentClient): string {
  const needs = item.needs.filter((id) => id !== 'stsBrain')
  const steps =
    item.kind === 'workflow'
      ? workflowSteps(item)
      : item.kind === 'skill'
        ? [...skillInstall(item, client), ...item.steps]
        : item.steps

  const lines: string[] = [
    `# ${KIND_INTRO[item.kind]}: ${item.title}`,
    '',
    `You are working for a creator who uses sts-ai. ${item.summary}`,
    '',
    '## 1. Connect the sts-ai business brain',
    'Run this once in the project folder:',
    '```bash',
    stsInitCommand(client),
    '```',
    NEEDS.stsBrain.how,
    'Use it as the source of truth for the business name, offers, prices, links, tone and audience. Never invent facts about the business; ask when something is missing.',
    '',
    '## 2. Goal',
    item.goal,
  ]

  if (needs.length > 0) {
    lines.push('', '## 3. Connect these tools', 'Check each one first; ask the creator for anything missing. Keep every key in env vars and never print it.')
    for (const id of needs) lines.push(`- **${NEEDS[id].label}**: ${NEEDS[id].how}`)
  }

  lines.push('', `## ${needs.length > 0 ? 4 : 3}. Steps`)
  steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`))

  lines.push(
    '',
    `## ${needs.length > 0 ? 5 : 4}. Deliver`,
    item.output,
    '',
    '## Rules',
    '- Nothing is posted, sent or paid for without the creator’s OK. Prepare drafts; show the cost before any paid generation.',
    '- Bangla stays in Bangla script, exactly as written. Write in the language the creator asks for.',
    '- Respect each platform’s terms; no fake engagement, no scraping behind logins.',
    '- At the end, list what you made, where it is, and what the creator still has to do.',
    '',
    `Source: ${item.source.label} (${item.source.url})`,
  )
  return lines.join('\n')
}
