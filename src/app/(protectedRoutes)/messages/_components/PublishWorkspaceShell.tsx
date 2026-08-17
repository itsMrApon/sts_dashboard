'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import PublishBusinessEditor from './PublishBusinessEditor'
import type { ContextPlatformConfig, PublishNavSection } from './publishTypes'

type TenantForEditor = {
  id: string
  name: string
  publishProfile?: { id: string; name: string } | null
  contextStatus: 'DRAFT' | 'PUBLISHED' | 'STALE'
  contextVersion: string | null
  compactTokenEstimate: number
  contextVertical: string | null
  contextCoreJson: unknown
  contextIndustryJson: unknown
  contextSocialJson: unknown
  compactProfileJson: unknown
}

type Props = {
  workspaceId: string
  workspaceName: string
  tenant: TenantForEditor
  socialPlatforms: ContextPlatformConfig[]
  messagingPlatforms: ContextPlatformConfig[]
  otherPlatforms: ContextPlatformConfig[]
  backHref?: string
  backLabel?: string
  roomName?: string | null
}

const SECTIONS: Array<{
  id: PublishNavSection
  label: string
  description: string
}> = [
  { id: 'about', label: 'About', description: 'Name, industry, and pitch' },
  { id: 'services', label: 'Services', description: 'Catalog for the website' },
  { id: 'policies', label: 'Policies', description: 'Terms and legal text' },
  { id: 'social', label: 'Social', description: 'Public handles' },
  { id: 'advanced', label: 'Advanced', description: 'Import and JSON snapshot' },
]

function statusLabel(status: TenantForEditor['contextStatus']): string {
  if (status === 'PUBLISHED') return 'Live'
  if (status === 'STALE') return 'Needs publish'
  return 'Draft'
}

export function PublishWorkspaceShell({
  workspaceId,
  workspaceName,
  tenant,
  socialPlatforms,
  messagingPlatforms,
  otherPlatforms,
  backHref = `/tenants?tenantId=${workspaceId}`,
  backLabel = 'Workspace',
  roomName = null,
}: Props) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<PublishNavSection>('about')
  const activeMeta = SECTIONS.find((section) => section.id === activeSection)

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[520px] w-full overflow-hidden rounded-se-xl border border-border text-primary">
      <aside className="flex w-[300px] shrink-0 flex-col border-r border-border">
        <div className="space-y-2 border-b border-border p-4">
          <Button variant="outline" className="w-full justify-start gap-2" asChild>
            <Link href={backHref}>
              <ChevronLeft className="h-4 w-4" />
              {backLabel}
            </Link>
          </Button>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Business details
            </p>
            <p className="truncate text-sm font-semibold">{workspaceName}</p>
            {roomName ? (
              <p className="truncate font-mono text-[11px] text-muted-foreground">{roomName}</p>
            ) : null}
          </div>
          <Badge variant={tenant.contextStatus === 'PUBLISHED' ? 'default' : 'outline'}>
            {statusLabel(tenant.contextStatus)}
          </Badge>
        </div>

        <ScrollArea className="flex-1 px-2 py-3">
          {SECTIONS.map((section) => {
            const selected = activeSection === section.id
            return (
              <button
                key={section.id}
                type="button"
                className={`mb-2 w-full rounded-lg border p-3 text-left transition-colors ${
                  selected
                    ? 'border-primary/40 bg-primary/20'
                    : 'border-transparent bg-primary/10 hover:border-primary/30 hover:bg-primary/20'
                }`}
                onClick={() => setActiveSection(section.id)}
              >
                <span className="block truncate text-sm font-medium">{section.label}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {section.description}
                </span>
              </button>
            )
          })}
        </ScrollArea>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-8">
          <div>
            <p className="text-sm font-medium">{activeMeta?.label ?? 'Business details'}</p>
            <p className="text-xs text-muted-foreground">{activeMeta?.description}</p>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4 sm:p-8">
            <PublishBusinessEditor
              key={tenant.id}
              tenant={tenant}
              activeSection={activeSection}
              socialPlatforms={socialPlatforms}
              messagingPlatforms={messagingPlatforms}
              otherPlatforms={otherPlatforms}
              onPublished={() => router.refresh()}
            />
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
