'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bot, ExternalLink, Loader2, Package } from 'lucide-react'
import { toast } from 'sonner'
import { updatePublishProfile } from '@/actions/publishProfiles'
import { MultiSelect } from '@/components/ui/multi-select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type {
  RoomBusinessData,
  SelectableAgentOption,
  SelectableProductOption,
} from '../_lib/getRoomPageData'

const AGENT_STYLE = {
  badgeColor: '#6366f1',
  iconColor: '#e0e7ff',
  gradient: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
}

const PRODUCT_STYLE = {
  badgeColor: '#10b981',
  iconColor: '#d1fae5',
  gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
}

type Props = {
  publishProfile: RoomBusinessData
  roomName: string
  selectableAgents: SelectableAgentOption[]
  selectableProducts: SelectableProductOption[]
}

export function RoomBusinessLinksEditor({
  publishProfile: business,
  roomName,
  selectableAgents,
  selectableProducts,
}: Props) {
  const router = useRouter()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const [isPending, startTransition] = useTransition()

  const initialAgentIds = useMemo(
    () => business.agents.map((ba) => ba.agent.id),
    [business.agents],
  )
  const initialProductIds = useMemo(
    () => business.products.map((bp) => bp.webinar.id),
    [business.products],
  )
  const initialPrimaryAgentId = useMemo(
    () => business.agents.find((ba) => ba.isPrimary)?.agent.id ?? initialAgentIds[0] ?? '',
    [business.agents, initialAgentIds],
  )
  const initialPrimaryProductId = useMemo(
    () =>
      business.products.find((bp) => bp.isPrimary)?.webinar.id ?? initialProductIds[0] ?? '',
    [business.products, initialProductIds],
  )

  const [agentIds, setAgentIds] = useState(initialAgentIds)
  const [productIds, setProductIds] = useState(initialProductIds)

  useEffect(() => {
    setAgentIds(initialAgentIds)
    setProductIds(initialProductIds)
  }, [initialAgentIds, initialProductIds])

  const allAgents = useMemo(() => {
    const byId = new Map(selectableAgents.map((a) => [a.id, a]))
    for (const ba of business.agents) {
      if (!byId.has(ba.agent.id)) byId.set(ba.agent.id, ba.agent)
    }
    return [...byId.values()]
  }, [selectableAgents, business.agents])

  const allProducts = useMemo(() => {
    const byId = new Map(selectableProducts.map((p) => [p.id, p]))
    for (const bp of business.products) {
      if (!byId.has(bp.webinar.id)) {
        byId.set(bp.webinar.id, {
          id: bp.webinar.id,
          title: bp.webinar.title,
          kind: bp.webinar.kind,
        })
      }
    }
    return [...byId.values()]
  }, [selectableProducts, business.products])

  const agentOptions = useMemo(
    () =>
      allAgents.map((agent) => ({
        value: agent.id,
        label: agent.name,
        style: AGENT_STYLE,
      })),
    [allAgents],
  )

  const productOptions = useMemo(
    () =>
      allProducts.map((product) => ({
        value: product.id,
        label: product.title,
        style: PRODUCT_STYLE,
      })),
    [allProducts],
  )

  const agentById = useMemo(() => new Map(allAgents.map((a) => [a.id, a])), [allAgents])
  const productById = useMemo(() => new Map(allProducts.map((p) => [p.id, p])), [allProducts])

  const primaryAgentId = agentIds.includes(initialPrimaryAgentId)
    ? initialPrimaryAgentId
    : (agentIds[0] ?? '')
  const featuredProductId = productIds.includes(initialPrimaryProductId)
    ? initialPrimaryProductId
    : (productIds[0] ?? '')

  const dirty =
    agentIds.join(',') !== initialAgentIds.join(',') ||
    productIds.join(',') !== initialProductIds.join(',')

  const handleSave = () => {
    if (agentIds.length === 0) {
      toast.error('Select at least one AI agent')
      return
    }

    startTransition(async () => {
      const result = await updatePublishProfile(business.id, {
        agentIds,
        productIds,
        primaryAgentId,
        primaryProductId: featuredProductId || undefined,
      })
      if (!result.ok) {
        toast.error(result.error || 'Could not update links')
        return
      }
      toast.success('Agents and products updated')
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{business.name}</h2>
        <Badge variant="secondary" className="ml-auto">
          Publish profile linked
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-background/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">AI Agents</h3>
          </div>
          <MultiSelect
            key={`agents-${initialAgentIds.join('|')}`}
            options={agentOptions}
            defaultValue={agentIds}
            onValueChange={setAgentIds}
            placeholder="Choose AI agents"
            maxCount={3}
            hideSelectAll
            hideClearButton
            hideFooterActions
            resetOnDefaultValueChange={false}
            searchable
            singleLine
            className="w-full"
            emptyIndicator={
              <p className="text-muted-foreground py-4 text-center text-xs">
                No agents available. Create one in AI Agents first.
              </p>
            }
            addOption={{
              label: 'Manage AI Agents',
              onSelect: () => {
                window.location.href = '/ai-agents'
              },
            }}
          />
          {agentIds.length > 0 ? (
            <div className="mt-3 flex flex-col gap-1.5">
              {agentIds.map((id) => {
                const agent = agentById.get(id)
                if (!agent) return null
                return (
                  <div key={id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-muted-foreground">{agent.name}</span>
                      {id === primaryAgentId ? (
                        <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                          Primary
                        </Badge>
                      ) : null}
                    </div>
                    <a
                      href={`${appUrl}/chat/${agent.roomName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex shrink-0 items-center gap-1 text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Chat
                    </a>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground mt-2 text-xs">
              Select at least one agent for this room.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/70 bg-background/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Products</h3>
          </div>
          <MultiSelect
            key={`products-${initialProductIds.join('|')}`}
            options={productOptions}
            defaultValue={productIds}
            onValueChange={setProductIds}
            placeholder="Choose products"
            maxCount={3}
            hideSelectAll
            hideClearButton
            hideFooterActions
            resetOnDefaultValueChange={false}
            searchable
            singleLine
            className="w-full"
            emptyIndicator={
              <p className="text-muted-foreground py-4 text-center text-xs">
                No products yet. Add projects under Workspaces.
              </p>
            }
            addOption={{
              label: 'Browse projects',
              onSelect: () => {
                window.location.href = '/home'
              },
            }}
          />
          {productIds.length > 0 ? (
            <div className="mt-3 flex flex-col gap-1.5">
              {productIds.map((id) => {
                const product = productById.get(id)
                if (!product) return null
                const url =
                  product.kind === 'PROJECT'
                    ? `${appUrl}/live-project/${product.id}`
                    : `${appUrl}/live-product/${product.id}`
                return (
                  <div key={id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-muted-foreground">{product.title}</span>
                      {id === featuredProductId ? (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-emerald-500/40 text-[10px] font-normal text-emerald-600"
                        >
                          Featured
                        </Badge>
                      ) : null}
                    </div>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex shrink-0 items-center gap-1 text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View
                    </a>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground mt-2 text-xs">No products linked yet.</p>
          )}
        </div>
      </div>

      {dirty ? (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save links
          </Button>
        </div>
      ) : null}

      <p className="text-muted-foreground mt-3 text-xs">
        Primary agent and Featured product stay as set when still selected; otherwise the first
        selected item is used. Manage agents in{' '}
        <Link href="/ai-agents" className="text-primary underline">
          AI Agents
        </Link>
        .
      </p>
    </div>
  )
}
