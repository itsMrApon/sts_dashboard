'use client'

import { useEffect, useMemo, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { AssistantSummary } from '@/actions/assistants'
import type { WorkflowApp, WorkflowGraph, WorkflowNode } from '@/components/ui/interactive-workflow-blueprint'
import type WorkflowBlueprintComponent from '@/components/ui/interactive-workflow-blueprint'
import { ASSISTANT_SERVICES, ASSISTANT_SERVICE_META, type AssistantService } from '@/lib/agents/assistantServices'
import { estimateTokens } from '@/lib/agents/promptLint'

// React Flow is ~100 kB: load it on the client only, after the page shell.
const WorkflowBlueprint = dynamic(() => import('@/components/ui/interactive-workflow-blueprint'), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse rounded-2xl border border-border bg-muted/30" />,
})

export type EngineSummary = { llm: string; llmProvider: string; voice: string; voiceProvider: string; stt: string } | null

type BlueprintProps = ComponentProps<typeof WorkflowBlueprintComponent>

type Props = {
  assistant: AssistantSummary
  /** Every assistant in the workspace: shows which agent runs each channel. */
  assistants: AssistantSummary[]
  businessName: string
  engine: EngineSummary
  emailReady: boolean
  /** Shown in place of the title text (the page passes its rename control). */
  titleSlot?: ReactNode
  onConfigure: (configKey: string) => void
  stackTop: ReactNode
  stackMarks: BlueprintProps['stackMarks']
  overlay: ReactNode
}

// v4: every channel runs through its own agent node. Drafts saved by earlier layouts are ignored.
const STORAGE_PREFIX = 'sts-ai:workflow:v4:'
const STACK_KEY = 'sts-ai:workflow-stack'

const COL = 215
const ROW = 84

/** Every service this assistant can run (classic assistants: all of them). */
export function servicesFor(assistant: AssistantSummary): AssistantService[] {
  return assistant.service ? [assistant.service] : [...ASSISTANT_SERVICES]
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * The stack this assistant sits in, one row per channel:
 *   channel → (speech to text) → that channel's agent → outputs
 * Nothing goes from a channel straight to the model: each channel has an agent with its own
 * persona, prompt and behaviour. The workspace (business knowledge) feeds every agent; this
 * assistant's persona feeds the rows it runs. Nodes carry a configKey for the gear button.
 */
function graphFor(assistant: AssistantSummary, assistants: AssistantSummary[], businessName: string, engine: EngineSummary, emailReady: boolean): WorkflowGraph {
  const services = servicesFor(assistant)
  const runnerOf = (service: AssistantService) => assistants.find((item) => item.inUse.includes(service)) ?? null
  const status = (on: boolean) => (on ? 'live' : 'off') as 'live' | 'off'
  const nodes: WorkflowNode[] = []
  const edges: WorkflowGraph['edges'] = []
  const link = (source: string, target: string, on: boolean) =>
    edges.push({ id: `${source}-${target}`, source, target, className: on ? undefined : 'wb-off' })
  const language = assistant.language === 'bn' ? 'Bangla' : 'English'
  const rowY = (service: AssistantService) => services.indexOf(service) * ROW
  let personaUsed = false

  for (const service of services) {
    const meta = ASSISTANT_SERVICE_META[service]
    const runner = runnerOf(service)
    // A row run by another assistant shows that agent; otherwise it's this assistant (live or not).
    const own = !runner || runner.id === assistant.id
    const on = Boolean(runner)
    const y = rowY(service)
    const agentId = `agent-${service}`

    nodes.push({
      id: `trigger-${service}`,
      type: 'blueprint',
      position: { x: 0, y },
      data: { label: meta.label, detail: meta.description, kind: 'trigger', tool: on ? 'Live' : 'Off', status: status(on), configKey: `behaviour:${service}` },
    })
    if (service === 'voice') {
      nodes.push({
        id: 'stt',
        type: 'blueprint',
        position: { x: COL, y },
        data: { label: 'Speech to text', detail: 'Turns the caller’s speech into text.', kind: 'integration', tool: engine?.stt, status: status(on), configKey: 'engine' },
      })
      link('trigger-voice', 'stt', on)
      link('stt', agentId, on)
    } else {
      link(`trigger-${service}`, agentId, on)
    }
    nodes.push({
      id: agentId,
      type: 'blueprint',
      position: { x: COL * 2, y },
      data: {
        label: capitalise(meta.noun),
        detail: own
          ? `${assistant.name}: its persona and ${meta.label} behaviour. Replies in ${language}.`
          : `${runner?.name} runs ${meta.label} with its own persona and behaviour.`,
        kind: 'agent',
        tool: own ? assistant.name : runner?.name,
        status: status(on),
        configKey: own ? `behaviour:${service}` : `assistant:${runner?.id}`,
      },
    })
    link('business', agentId, on)
    if (own) {
      personaUsed = true
      link('prompt', agentId, on)
    }
  }

  // Knowledge under the channels: the workspace every agent shares, and this assistant's persona.
  const below = services.length * ROW + 12
  nodes.push({
    id: 'business',
    type: 'blueprint',
    position: { x: 0, y: below },
    data: { label: businessName, detail: 'Workspace knowledge every agent reads: business details, products, FAQs.', kind: 'knowledge', tool: 'Workspace' },
  })
  if (personaUsed) {
    nodes.push({
      id: 'prompt',
      type: 'blueprint',
      position: { x: COL, y: below },
      data: {
        label: 'Persona & prompt',
        detail: 'Who this assistant is, how it sounds and the rules it follows.',
        kind: 'knowledge',
        tool: `${language} · ≈${estimateTokens(assistant.systemPrompt || '').toLocaleString()} tok`,
        configKey: 'prompt:system',
      },
    })
  }

  // Outputs, on the row of the channel they come from.
  const has = (service: AssistantService) => services.includes(service)
  const on = (service: AssistantService) => Boolean(runnerOf(service))
  if (has('voice')) {
    nodes.push({
      id: 'tts',
      type: 'blueprint',
      position: { x: COL * 3, y: rowY('voice') },
      data: { label: 'Voice reply', detail: 'Speaks the answer on calls.', kind: 'delivery', tool: engine?.voice, status: status(on('voice')), configKey: 'engine' },
    })
    link('agent-voice', 'tts', on('voice'))
  }
  const replyRows = (['chat', 'tour'] as const).filter(has)
  if (replyRows.length) {
    const replyOn = replyRows.some(on)
    nodes.push({
      id: 'reply',
      type: 'blueprint',
      // On the first reply row: between rows it would sit on Voice reply / Save lead.
      position: { x: COL * 3, y: rowY(replyRows[0]) },
      data: { label: 'Reply', detail: 'The answer streams back to the visitor.', kind: 'delivery', tool: replyRows.map((service) => ASSISTANT_SERVICE_META[service].label).join(' · '), status: status(replyOn) },
    })
    for (const service of replyRows) link(`agent-${service}`, 'reply', on(service))
  }
  if (has('form')) {
    nodes.push({
      id: 'lead',
      type: 'blueprint',
      position: { x: COL * 3, y: rowY('form') },
      data: {
        label: 'Save lead',
        detail: emailReady ? 'Form answers become a lead and are emailed to you.' : 'Form answers become a lead.',
        kind: 'delivery',
        tool: emailReady ? 'Leads + email' : 'Leads',
        status: status(on('form')),
        configKey: 'behaviour:form:delivery',
      },
    })
    link('agent-form', 'lead', on('form'))
  }
  return { nodes, edges }
}

/** A saved draft keeps its layout, but live/off and engine names always come from today's setup. */
function withCurrentState(graph: WorkflowGraph, current: WorkflowGraph): WorkflowGraph {
  const fresh = new Map(current.nodes.map((node) => [node.id, node.data]))
  const nodes = graph.nodes.map((node) => {
    const data = fresh.get(node.id)
    if (!data) return node
    // Agent and workspace names come from today's setup too (a rename or a new runner).
    const label = node.id.startsWith('agent-') || node.id === 'business' ? data.label : node.data.label
    return { ...node, data: { ...node.data, label, detail: data.detail, kind: data.kind, status: data.status, tool: data.tool, configKey: data.configKey } }
  })
  const off = new Set(nodes.filter((node) => node.data.status === 'off').map((node) => node.id))
  const edges = graph.edges.map((edge) => ({ ...edge, className: off.has(edge.source) || off.has(edge.target) ? 'wb-off' : undefined }))
  return { nodes, edges }
}

const APPS: WorkflowApp[] = [
  {
    id: 'ai',
    name: 'AI steps',
    actions: [
      { label: 'Classify intent', detail: 'Question, booking or complaint?', kind: 'agent' },
      { label: 'Summarise', detail: 'A short recap for your team.', kind: 'agent' },
      { label: 'Translate', detail: 'Bangla ⇄ English, same meaning.', kind: 'agent' },
    ],
  },
  {
    id: 'leads',
    name: 'Leads',
    actions: [
      { label: 'Research website', detail: 'Read the lead’s website.', kind: 'integration', tool: 'Scrape agent' },
      { label: 'Save lead', detail: 'Store contact and answers.', kind: 'delivery', tool: 'Leads' },
      { label: 'Email owner', detail: 'Send the lead to your inbox.', kind: 'delivery', tool: 'Email' },
    ],
  },
  {
    id: 'people',
    name: 'People',
    actions: [
      { label: 'Hand off to human', detail: 'Pass the conversation on.', kind: 'review' },
      { label: 'Approve first', detail: 'A teammate checks the answer.', kind: 'review' },
    ],
  },
]

/** Matches the app's violet accent; live steps use the same green as the live dots. */
const BRAND_STYLE = {
  '--color-primary': 'oklch(0.68 0.19 293)',
  '--color-primary-foreground': 'oklch(0.99 0 0)',
  '--color-chart-2': 'oklch(0.76 0.15 162)',
  '--color-chart-3': 'oklch(0.78 0.12 230)',
} as CSSProperties

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked: the canvas still works, it just won't be remembered.
  }
}

/**
 * The assistant's map: the full stack as a canvas, with the config stack (prompt, behaviour) in its
 * side panel and the editor drawer over the canvas. Canvas edits are a draft kept in this browser.
 */
export function AssistantWorkflow({ assistant, assistants, businessName, engine, emailReady, titleSlot, onConfigure, stackTop, stackMarks, overlay }: Props) {
  const starting = useMemo(
    () => graphFor(assistant, assistants, businessName, engine, emailReady),
    [assistant, assistants, businessName, engine, emailReady],
  )
  const storageKey = `${STORAGE_PREFIX}${assistant.id}`
  const [loaded, setLoaded] = useState<{ graph: WorkflowGraph; stackOpen: boolean } | null>(null)

  useEffect(() => {
    const saved = readJson<WorkflowGraph>(storageKey)
    const graph = saved && Array.isArray(saved.nodes) && Array.isArray(saved.edges) ? withCurrentState(saved, starting) : starting
    setLoaded({ graph, stackOpen: readJson<boolean>(STACK_KEY) ?? true })
  }, [storageKey, starting])

  if (!loaded) return <div className="h-full animate-pulse rounded-2xl border border-border bg-muted/30" />

  return (
    <WorkflowBlueprint
      key={storageKey}
      fill
      nodeSize="compact"
      title={`How ${assistant.name} works`}
      titleSlot={titleSlot}
      eyebrow="Full stack · draft canvas"
      initialGraph={loaded.graph}
      apps={APPS}
      stackTitle="Config stack"
      stackWidth={288}
      stackTop={stackTop}
      stackMarks={stackMarks}
      overlay={overlay}
      onNodeConfigure={onConfigure}
      defaultStackOpen={loaded.stackOpen}
      onStackOpenChange={(open) => writeJson(STACK_KEY, open)}
      agentTemplate={{ label: 'New AI step', detail: 'Describe what this step does.', kind: 'agent', tool: engine?.llm }}
      onChange={(graph) =>
        writeJson(storageKey, {
          nodes: graph.nodes.map(({ id, position, data }) => ({ id, type: 'blueprint', position, data })),
          edges: graph.edges.map(({ id, source, target, className }) => ({ id, source, target, className })),
        })
      }
      style={BRAND_STYLE}
      className="rounded-2xl"
    />
  )
}
