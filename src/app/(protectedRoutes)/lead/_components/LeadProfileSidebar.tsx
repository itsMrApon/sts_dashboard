'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2, FileAudio, Globe, MapPin, Phone } from 'lucide-react'
import type { LeadProfileData } from './leadProfileTypes'

type AgentOption = { id: string; name: string; systemPrompt: string | null }

type Props = {
  lead: LeadProfileData
  agents: AgentOption[]
  emailDraft: string
  companyDraft: string
  detailsDirty: boolean
  pending: boolean
  meetingsCount: number
  onEmailChange: (value: string) => void
  onCompanyChange: (value: string) => void
  onSaveDetails: () => void
  onSetAgent: (agentId: string | null) => void
  initials: (name: string) => string
  formatWhen: (value: string | null | undefined) => string
}

export function LeadProfileSidebar({
  lead,
  agents,
  emailDraft,
  companyDraft,
  detailsDirty,
  pending,
  meetingsCount,
  onEmailChange,
  onCompanyChange,
  onSaveDetails,
  onSetAgent,
  initials,
  formatWhen,
}: Props) {
  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0 shadow-none lg:border-0 lg:shadow-none">
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto pt-4 pb-4 lg:pt-5 lg:pb-5">
        <div className="flex flex-col items-center text-center">
          <Avatar className="size-16 lg:size-20">
            <AvatarFallback className="text-lg lg:text-xl">
              {initials(lead.name)}
            </AvatarFallback>
          </Avatar>
          <h2 className="mt-2 line-clamp-2 text-lg font-semibold lg:mt-3 lg:text-xl">
            {lead.name}
          </h2>
        </div>

        <div className="space-y-3">
          {lead.kind === 'Business' ? (
            <div className="bg-muted/40 flex h-10 items-center gap-3 rounded-lg border px-3">
              <Building2 className="text-primary size-4 shrink-0" />
              <span className="text-muted-foreground text-sm">Business lead</span>
              <span className="ml-auto text-sm font-semibold">Prospect</span>
            </div>
          ) : (
            <div className="bg-muted/40 flex h-10 items-center gap-3 rounded-lg border px-3">
              <FileAudio className="text-primary size-4 shrink-0" />
              <span className="text-muted-foreground text-sm">Meetings</span>
              <span className="ml-auto text-sm font-semibold">
                {meetingsCount}
              </span>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs">Agent rulebook</label>
            <Select
              value={lead.selectedAgentId || '__none__'}
              onValueChange={(v) => onSetAgent(v === '__none__' ? null : v)}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Use setup default</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Details</h3>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs"
              disabled={pending || !detailsDirty}
              onClick={onSaveDetails}
            >
              Save
            </Button>
          </div>
          <Separator />
          {lead.kind === 'Business' ? null : (
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs">Email</label>
              <Input
                type="email"
                className="h-10"
                value={emailDraft}
                placeholder="Add guest email…"
                disabled={pending}
                onChange={(e) => onEmailChange(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs">Company</label>
            <Input
              className="h-10"
              value={companyDraft}
              placeholder="Add company…"
              disabled={pending}
              onChange={(e) => onCompanyChange(e.target.value)}
            />
          </div>
          {lead.kind === 'Business' ? (
            <div className="space-y-2 text-sm">
              {lead.address ? (
                <div className="flex items-start gap-2">
                  <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <span className="text-muted-foreground">{lead.address}</span>
                </div>
              ) : null}
              {lead.phone ? (
                <div className="flex items-center gap-2">
                  <Phone className="text-muted-foreground size-4 shrink-0" />
                  <a
                    href={`tel:${lead.phone}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {lead.phone}
                  </a>
                </div>
              ) : null}
              {lead.website ? (
                <div className="flex items-center gap-2">
                  <Globe className="text-muted-foreground size-4 shrink-0" />
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate font-medium underline-offset-2 hover:underline"
                  >
                    {lead.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Last call</span>
              <span className="truncate text-right font-medium">
                {formatWhen(lead.meeting?.recordedAt || lead.lastAppointmentAt)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
