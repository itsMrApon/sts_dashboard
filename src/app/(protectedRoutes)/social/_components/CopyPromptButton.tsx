'use client'

import { Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AGENT_CLIENT_LABEL, buildSocialPrompt, stsInitCommand } from '@/lib/social/library/buildPrompt'
import type { AgentClient, SocialItem } from '@/lib/social/library/types'
import { copyText, useAgentClient } from '../_lib/useSocialPrefs'

/**
 * "Copy prompt" with a menu beside it, like 21st.dev: the main button copies the full brief for
 * the creator's agent; the menu picks which agent it is written for and copies the CLI command.
 */
export function CopyPromptButton({ item, className }: { item: SocialItem; className?: string }) {
  const [client, setClient] = useAgentClient()
  const [copied, setCopied] = useState(false)

  async function copy(text: string, what: string) {
    if (await copyText(text)) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
      toast.success(`${what} copied`, { description: `Paste it into ${AGENT_CLIENT_LABEL[client]}.` })
    } else {
      toast.error('Couldn’t copy. Select the prompt text and copy it by hand.')
    }
  }

  return (
    <div className={cn('inline-flex h-10 items-stretch overflow-hidden rounded-md bg-primary text-primary-foreground', className)}>
      <button
        type="button"
        onClick={() => copy(buildSocialPrompt(item, client), 'Prompt')}
        className="inline-flex items-center gap-2 px-5 text-sm font-medium transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {copied ? 'Copied' : 'Copy prompt'}
        {copied ? <Check className="size-4" aria-hidden /> : null}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Prompt options"
          className="inline-flex w-10 items-center justify-center border-l border-white/20 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ChevronDown className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Written for</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={client} onValueChange={(value) => setClient(value as AgentClient)}>
            {(Object.keys(AGENT_CLIENT_LABEL) as AgentClient[]).map((key) => (
              <DropdownMenuRadioItem key={key} value={key}>
                {AGENT_CLIENT_LABEL[key]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => copy(stsInitCommand(client), 'CLI command')}>Copy CLI command</DropdownMenuItem>
          {item.workflowUrl ? (
            <DropdownMenuItem onSelect={() => copy(item.workflowUrl!, 'Workflow link')}>Copy workflow JSON link</DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
