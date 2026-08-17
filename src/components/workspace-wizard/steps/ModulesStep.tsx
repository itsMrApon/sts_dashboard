'use client'

import { Blocks, Building2, Link2, MessageCircle, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MODULE_META, type WorkspaceModuleId } from '../types'
import { useWorkspaceWizard } from '../WorkspaceWizardContext'

const ICONS: Record<WorkspaceModuleId, React.ComponentType<{ className?: string }>> = {
  publish: Building2,
  partners: Link2,
  messages: MessageCircle,
  product: Blocks,
  webinar: Radio,
}

const ORDER: WorkspaceModuleId[] = [
  'publish',
  'partners',
  'messages',
  'product',
  'webinar',
]

export function ModulesStep() {
  const { draft, toggleModule } = useWorkspaceWizard()

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Select one or more. Each selection adds steps to this wizard — same steps you get when
        creating from that module’s page.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {ORDER.map((id) => {
          const selected = draft.modules.includes(id)
          const Icon = ICONS[id]
          const meta = MODULE_META[id]
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggleModule(id)}
              className={cn(
                'rounded-lg border px-3 py-3 text-left transition-colors',
                selected
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:bg-muted/60',
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{meta.label}</span>
                {selected ? (
                  <span className="ml-auto text-[10px] font-medium text-primary">Selected</span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
