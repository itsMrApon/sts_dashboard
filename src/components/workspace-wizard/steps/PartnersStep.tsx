'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { INBOUND_CONNECTOR_KINDS } from '@/lib/inboundConnectors'
import { useWorkspaceWizard } from '../WorkspaceWizardContext'

const DEFAULT_URLS: Record<string, string> = {
  medusa: 'http://localhost:9001',
  erpnext: 'http://localhost:8080',
  n8n: 'http://localhost:5678/mcp',
  chatwoot: 'http://localhost:3001',
  firecrawl: 'https://mcp.firecrawl.dev/mcp',
  custom: 'https://',
}

export function PartnersStep() {
  const { draft, patchDraft } = useWorkspaceWizard()
  const p = draft.partners

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Attaches to workspace <span className="font-medium text-foreground">{draft.workspaceName || '…'}</span>.
        One partner type per workspace. Chat will propose write actions for confirmation.
      </p>
      <div className="space-y-2">
        <Label>Partner type</Label>
        <Select
          value={p.kind}
          onValueChange={(kind) =>
            patchDraft({
              partners: {
                ...p,
                kind,
                label: p.label || kind,
                mcpUrl: DEFAULT_URLS[kind] ?? p.mcpUrl,
              },
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INBOUND_CONNECTOR_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {kind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="partner-label">Label</Label>
        <Input
          id="partner-label"
          value={p.label}
          onChange={(e) => patchDraft({ partners: { ...p, label: e.target.value } })}
          placeholder={p.kind}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="partner-url">MCP URL</Label>
        <Input
          id="partner-url"
          value={p.mcpUrl}
          onChange={(e) => patchDraft({ partners: { ...p, mcpUrl: e.target.value } })}
          placeholder={DEFAULT_URLS[p.kind] ?? 'https://…'}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Optional auth secret can be added later on Partners. Use app base URL or /mcp path.
      </p>
    </div>
  )
}
