'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { MessageSquare, Mic, Pencil, Plus, Wand2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { AI_SERVICE_LABEL, AI_SERVICE_ORDER, type AiService, type OfferSettingsView } from '@/lib/offers/offerTypes'

export type AiPanelPicks = {
  aiServices: AiService[]
  /** The one agent that answers on Chat and Voice. */
  agentId: string
}

type Props = {
  offerId: string
  picks: AiPanelPicks
  onChange: (picks: AiPanelPicks) => void
  agents: OfferSettingsView['agents']
  tour: OfferSettingsView['tour']
}

const PANEL_COPY: Record<AiService, { hint: string; icon: ReactNode }> = {
  CHAT: { hint: 'Answers in writing. Chats show up in your pipeline.', icon: <MessageSquare className="h-4 w-4" /> },
  WIZARD: { hint: "A narrated walk-through of this product, ending on the payment button.", icon: <Wand2 className="h-4 w-4" /> },
  SPEAK: { hint: 'A live voice call that can bring up the payment button.', icon: <Mic className="h-4 w-4" /> },
}

/**
 * AI sales assistant: pick the agent once (it answers on Chat and Voice), switch each panel on or
 * off, and build this product's own Guided tour.
 */
export function AiPanelPicker({ offerId, picks, onChange, agents, tour }: Props) {
  const toggle = (service: AiService, on: boolean) =>
    onChange({
      ...picks,
      aiServices: on ? [...picks.aiServices, service] : picks.aiServices.filter((item) => item !== service),
    })
  // The product's own wizard profile in Services → Wizard.
  const tourHref = `/services/wizard?product=${offerId}#tour-steps`

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="offer-agent">AI agent</Label>
        {agents.length ? (
          <Select value={picks.agentId} onValueChange={(agentId) => onChange({ ...picks, agentId })}>
            <SelectTrigger id="offer-agent" className="w-full">
              <SelectValue placeholder="Pick an agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm text-muted-foreground">
            No AI agents yet.{' '}
            <Link href="/ai-agents" className="underline underline-offset-2">
              Create one in AI Agents
            </Link>
            .
          </p>
        )}
        <p className="text-xs text-muted-foreground">Its prompt answers buyers on Chat and Voice.</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Buyers can talk to your AI by</p>
        <div className="divide-y divide-border rounded-xl border border-border">
          {AI_SERVICE_ORDER.map((service) => {
            const on = picks.aiServices.includes(service)
            return (
              <div key={service} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Switch
                    checked={on}
                    onCheckedChange={(checked) => toggle(service, checked)}
                    aria-label={AI_SERVICE_LABEL[service]}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className={cn('flex items-center gap-1.5 text-sm font-medium', !on && 'text-muted-foreground')}>
                      {PANEL_COPY[service].icon}
                      {AI_SERVICE_LABEL[service]}
                      {service === 'WIZARD' && tour.status !== 'none' ? (
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-medium',
                            tour.status === 'published' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500',
                          )}
                        >
                          {tour.status === 'published' ? 'Published' : 'Draft'}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{PANEL_COPY[service].hint}</p>
                  </div>
                </div>

                {service === 'WIZARD' && on ? (
                  <Link
                    href={tourHref}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm hover:bg-muted/60"
                  >
                    {tour.status === 'none' ? <Plus className="h-4 w-4" aria-hidden /> : <Pencil className="h-4 w-4" aria-hidden />}
                    {tour.status === 'none' ? 'Create tour steps' : 'Go to steps'}
                  </Link>
                ) : null}
              </div>
            )
          })}
        </div>
        {picks.aiServices.includes('WIZARD') && tour.status !== 'published' ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
            {tour.status === 'none'
              ? 'This product has no tour yet, so the Guided tour panel stays hidden. '
              : 'The tour is a draft: only you see it on the share link. '}
            <Link href={tourHref} className="font-medium underline underline-offset-2">
              {tour.status === 'none' ? 'Create it' : 'Publish it'}
            </Link>{' '}
            so buyers get it too.
          </p>
        ) : null}
      </div>
    </div>
  )
}
