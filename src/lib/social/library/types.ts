/**
 * The Social library: skills, prompts, workflows, plugins and reports a creator copies into their
 * own AI agent (Claude Code, Codex, Cursor…). Each item is drawn as a diagram and carries what the
 * agent needs to build it: the goal, the tools to connect and the steps.
 */

export const SOCIAL_KINDS = ['skill', 'prompt', 'workflow', 'plugin', 'report'] as const
export type SocialKind = (typeof SOCIAL_KINDS)[number]

export const SOCIAL_CHANNELS = [
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
  'linkedin',
  'x',
  'whatsapp',
  'telegram',
  'blog',
  'email',
  'print',
] as const
export type SocialChannel = (typeof SOCIAL_CHANNELS)[number]

/** What an item makes, for the second filter row. */
export const SOCIAL_FORMATS = ['video', 'image', 'post', 'carousel', 'article', 'audio', 'research', 'ads', 'automation'] as const
export type SocialFormat = (typeof SOCIAL_FORMATS)[number]

/** Things the agent may have to connect. Keys of NEEDS in needs.ts. */
export type NeedId =
  | 'stsBrain'
  | 'n8n'
  | 'n8nMcp'
  | 'tunnel'
  | 'docker'
  | 'higgsfield'
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'elevenlabs'
  | 'heygen'
  | 'kling'
  | 'flux'
  | 'creatomate'
  | 'bannerbear'
  | 'hyperframes'
  | 'remotion'
  | 'ffmpeg'
  | 'comfyui'
  | 'postiz'
  | 'metaGraph'
  | 'youtubeApi'
  | 'linkedinApi'
  | 'xApi'
  | 'telegramBot'
  | 'wordpress'
  | 'googleDrive'
  | 'googleSheets'
  | 'notion'
  | 'airtable'
  | 'apify'
  | 'agentReach'
  | 'scrapeAgent'
  | 'serper'
  | 'mautic'
  | 'twenty'
  | 'claudePlugin'
  | 'canva'
  | 'playwright'
  | 'whisper'
  | 'slack'
  | 'discord'

/* ------------------------------------------------------------------ diagrams */

/** One box in a diagram. `tag` is the small type label (TRIGGER, AI, OUTPUT…). */
export type DiagramNode = {
  label: string
  sub?: string
  tag?: string
  focal?: boolean
}

export type Diagram =
  /** Left to right, wrapping into a second row (right to left) past 4 nodes. */
  | { type: 'flow'; nodes: DiagramNode[]; edges?: (string | null)[] }
  /** One input, an optional middle step, then several outputs. */
  | { type: 'fan'; source: DiagramNode; via?: DiagramNode; outputs: DiagramNode[] }
  /** A reinforcing cycle around a hub. */
  | { type: 'loop'; hub: string; nodes: DiagramNode[] }
  /** A numbered method. */
  | { type: 'steps'; steps: DiagramNode[] }
  /** Drop-off from stage to stage. */
  | { type: 'funnel'; stages: { label: string; value: string }[] }
  /** Stacked layers, top first. */
  | { type: 'layers'; layers: DiagramNode[] }
  /** Messages between actors over time. */
  | { type: 'sequence'; actors: string[]; messages: { from: number; to: number; label: string; focal?: boolean }[] }
  /** Who does what, in order. */
  | { type: 'swimlane'; lanes: string[]; steps: { lane: number; label: string; focal?: boolean }[] }
  /** Two-axis prioritisation; x and y from 0 to 1. */
  | { type: 'quadrant'; xAxis: [string, string]; yAxis: [string, string]; points: { label: string; x: number; y: number; focal?: boolean }[] }
  /** Horizontal bars. */
  | { type: 'bars'; unit?: string; bars: { label: string; value: number; focal?: boolean }[] }
  /** Values in a grid (e.g. best time to post). Values 0..1. */
  | { type: 'heatmap'; rows: string[]; cols: string[]; values: number[][] }
  /** Dated events on a line. */
  | { type: 'timeline'; events: { when: string; label: string; focal?: boolean }[] }
  /** A centre with satellites on both sides (an agent and what it connects to). */
  | { type: 'hub'; center: DiagramNode; around: DiagramNode[] }

export type DiagramType = Diagram['type']

/* ------------------------------------------------------------------- items */

export type SocialSource = { label: string; url: string }

export type SocialItem = {
  /** Stable slug, used for saves and links (?item=). */
  id: string
  kind: SocialKind
  title: string
  /** One sentence for the card and the dialog. */
  summary: string
  channels: SocialChannel[]
  formats: SocialFormat[]
  needs: NeedId[]
  source: SocialSource
  diagram: Diagram
  /** What the agent should build, in a few sentences. */
  goal: string
  /** Ordered steps for the agent. */
  steps: string[]
  /** What the creator gets at the end. */
  output: string
  /** Skills: where the skill lives inside the source repo (e.g. skills/copywriting). */
  skillPath?: string
  /** Workflows: the n8n JSON to import. */
  workflowUrl?: string
  /** Workflows: node count, for the card. */
  nodeCount?: number
}

export type AgentClient = 'claude' | 'codex' | 'cursor'
