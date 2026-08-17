'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Activity, ChevronLeft, KeyRound, Link2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import {
  Component as DevToolLandingPage,
  type DemoLine,
  type FeatureCard,
  type PromptTab,
  type PromptTabId,
} from '@/components/ui/dev-tool-landing-page'
import {
  createInboundConnector,
  deleteInboundConnector,
  toggleInboundConnector,
} from '@/actions/inboundConnectors'
import { getPartnerIntegrationGuide } from '@/lib/partners/integrationGuides'
import {
  buildIntegrationAiPrompts,
  type IntegrationPromptStage,
} from '@/lib/partners/integrationPrompts'

type ConnectorRow = {
  id: string
  kind: string
  label: string
  mcpUrl: string
  authType: string
  enabled: boolean
}

type Props = {
  kind: string
  workspaceId: string | null
  workspaceName: string | null
  publishProfileId: string | null
  connector: ConnectorRow | null
}

function textToDemoLines(source: string): DemoLine[] {
  return source.split('\n').slice(0, 28).map((text, index) => {
    const num = index + 1
    if (!text.trim()) return { num, type: 'empty' as const }
    if (text.startsWith('#') || text.startsWith('//')) {
      return { num, type: 'comment' as const, text }
    }
    return {
      num,
      type: 'code' as const,
      tokens: [{ text, className: 'text-zinc-300' }],
    }
  })
}

const PROMPT_TABS: Array<{
  id: PromptTabId
  label: string
  fileName: (stage: IntegrationPromptStage) => string
}> = [
  { id: 'cursor', label: 'Cursor', fileName: (stage) => `${stage}-cursor.md` },
  { id: 'claude', label: 'Claude', fileName: (stage) => `${stage}-claude.md` },
  { id: 'cli', label: 'CLI', fileName: (stage) => (stage === 'install' ? 'install.sh' : `${stage}.sh`) },
  { id: 'universal', label: 'Universal', fileName: (stage) => `${stage}-universal.md` },
]

const fieldClassName =
  'mt-5 h-9 w-full max-w-md rounded-md border border-zinc-800 bg-[#0d0d0f] px-3 font-mono text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-zinc-600'

export function PartnerIntegrationPage({
  kind,
  workspaceId,
  workspaceName,
  publishProfileId,
  connector,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const guide = getPartnerIntegrationGuide(kind)
  const [label, setLabel] = useState(connector?.label || guide.label)
  const [mcpUrl, setMcpUrl] = useState(connector?.mcpUrl || guide.defaultUrl)
  const [authSecret, setAuthSecret] = useState('')

  const prompts = useMemo(() => {
    const appBaseUrl =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    return buildIntegrationAiPrompts({
      kind: guide.kind,
      label: label || guide.label,
      workspaceId,
      workspaceName,
      publishProfileId,
      mcpUrl: mcpUrl || guide.defaultUrl,
      appBaseUrl,
      connected: Boolean(connector),
    })
  }, [
    connector,
    guide.defaultUrl,
    guide.kind,
    guide.label,
    label,
    mcpUrl,
    publishProfileId,
    workspaceId,
    workspaceName,
  ])

  const promptTabsByStep = useMemo(() => {
    const tabsFor = (stage: IntegrationPromptStage): PromptTab[] =>
      PROMPT_TABS.map((tab) => ({
        id: tab.id,
        label: tab.label,
        fileName: tab.fileName(stage),
        copyValue: prompts[stage][tab.id],
        lines: textToDemoLines(prompts[stage][tab.id]),
      }))

    return {
      1: tabsFor('install'),
      2: tabsFor('connect'),
      3: tabsFor('test'),
    }
  }, [prompts])

  const handleCreate = () => {
    if (!workspaceId) {
      toast.error('Create a Messages room first, then connect this partner.')
      return
    }
    startTransition(async () => {
      const result = await createInboundConnector({
        tenantId: workspaceId,
        kind: guide.kind,
        label: label || guide.label,
        mcpUrl,
        authType: authSecret ? 'bearer' : 'none',
        authSecret: authSecret || undefined,
      })
      if (!result.success) {
        toast.error(result.error || 'Failed to connect')
        return
      }
      toast.success(`${guide.label} connected`)
      router.refresh()
    })
  }

  const handleToggle = (enabled: boolean) => {
    if (!connector) return
    startTransition(async () => {
      await toggleInboundConnector(connector.id, enabled)
      router.refresh()
    })
  }

  const handleDelete = () => {
    if (!connector) return
    if (!confirm(`Remove ${connector.label}?`)) return
    startTransition(async () => {
      const result = await deleteInboundConnector(connector.id)
      if (!result.success) {
        toast.error(result.error || 'Failed to remove')
        return
      }
      toast.success('Connector removed')
      router.refresh()
    })
  }

  const features: FeatureCard[] = [
    {
      id: 'url',
      title: 'App / MCP URL',
      description: guide.constraintsBody,
      icon: Link2,
      accent: 'text-emerald-400',
      glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(52,211,153,0.15)]',
      proof: {
        label: 'Expected endpoint',
        lines: [
          { text: `kind: ${guide.kind}`, dim: true },
          { text: mcpUrl || guide.defaultUrl, dim: false },
          { text: connector ? 'status: connected' : 'status: not connected', dim: true },
        ],
      },
      extra: connector ? null : (
        <input
          className={fieldClassName}
          value={mcpUrl}
          onChange={(event) => setMcpUrl(event.target.value)}
          placeholder={guide.defaultUrl}
        />
      ),
    },
    {
      id: 'auth',
      title: 'API token / secret',
      description: `Paste ${guide.authHint}. STS stores it on the connector. Never put secrets in the copied Cursor/Claude prompt.`,
      icon: KeyRound,
      accent: 'text-amber-400',
      glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(251,191,36,0.15)]',
      proof: {
        label: 'Auth contract',
        lines: [
          { text: `header: Authorization: Bearer`, dim: true },
          { text: guide.authHint, dim: false },
          { text: connector?.authType ? `mode: ${connector.authType}` : 'mode: none until pasted', dim: true },
        ],
      },
      extra: connector ? (
        <p className="mt-5 text-xs text-zinc-500">Secret is already stored on this connector.</p>
      ) : (
        <input
          className={fieldClassName}
          type="password"
          value={authSecret}
          onChange={(event) => setAuthSecret(event.target.value)}
          placeholder={guide.authHint}
        />
      ),
    },
    {
      id: 'connect',
      title: connector ? 'Connection live' : 'Connect this workspace',
      description: connector
        ? `${guide.label} is attached to this Messages room. Chat with /${guide.kind}.`
        : `Paste URL + ${guide.authHint} in this section, then Connect. If ${guide.label} is not running yet, copy a prompt from the preview first.`,
      icon: Activity,
      accent: 'text-rose-400',
      glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(251,113,133,0.15)]',
      proof: {
        label: 'Chat commands',
        lines: [
          { text: `/${guide.kind}`, dim: false },
          {
            text:
              guide.kind === 'medusa'
                ? '/ecommerce'
                : guide.kind === 'n8n'
                  ? '/automate'
                  : guide.kind === 'erpnext'
                    ? '/erp'
                    : `/${guide.kind}`,
            dim: true,
          },
          { text: workspaceId ? `workspace: ${workspaceName}` : 'workspace: create a Messages room', dim: true },
        ],
      },
      extra: connector ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleToggle(!connector.enabled)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-600"
          >
            {connector.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleDelete}
            className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-rose-400 hover:border-rose-500/40"
          >
            <span className="inline-flex items-center gap-1">
              <Trash2 className="h-3 w-3" />
              Remove
            </span>
          </button>
          <Link
            href="/tenants/chat"
            className="rounded-lg border border-zinc-800 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900"
          >
            Open assistant
          </Link>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <input
            className={fieldClassName}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={guide.label}
          />
          <button
            type="button"
            disabled={isPending || !mcpUrl.trim()}
            onClick={handleCreate}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-40"
          >
            {isPending ? 'Connecting…' : `Connect ${guide.label}`}
          </button>
          {!workspaceId ? (
            <p className="text-xs text-zinc-500">
              Create a room in{' '}
              <Link href="/messages" className="text-zinc-200 underline">
                Messages
              </Link>{' '}
              first.
            </p>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <PageViewport scrollable>
      <DevToolLandingPage
        header={
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800/50 px-6 py-4 md:px-12">
            <Link
              href="/tenants"
              className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              <ChevronLeft className="h-4 w-4" />
              All partners
            </Link>
            <p className="text-sm font-medium text-zinc-200">{guide.label}</p>
            <Link
              href="/tenants/chat"
              className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Assistant
            </Link>
          </div>
        }
        badge={`${guide.label} integration`}
        heroTitle="Zero-config previews."
        heroDescription={guide.zeroConfigBody}
        walkthroughLabel="Walkthrough"
        explanations={{
          1: guide.walkthrough.install,
          2: guide.walkthrough.connect,
          3: guide.walkthrough.test,
        }}
        walkthroughLines={[1, 2, 3]}
        promptTabsByStep={promptTabsByStep}
        defaultPromptTab="cursor"
        defaultWalkthroughLine={1}
        featuresTitle="Engineered for constraints."
        featuresDescription={guide.constraintsBody}
        features={features}
      />
    </PageViewport>
  )
}
