'use client'

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'

import {
  ArrowDown01Icon,
  HugeiconsIcon,
  ToolsIcon,
} from '@/components/ui/tool-calls-section-utils/icons'
import { cn } from '@/lib/utils'
import {
  formatToolName,
  getToolCategoryIcon,
} from '@/components/ui/tool-calls-section-utils/tool-icons'
import { CompactMarkdown } from '@/components/ui/tool-calls-section-utils/compact-markdown'

export interface ToolCallEntry {
  tool_name: string
  tool_category: string
  message?: string
  show_category?: boolean
  tool_call_id?: string
  inputs?: Record<string, unknown>
  output?: string
  inboundPrompt?: string
  outboundPrompt?: string
  icon_url?: string
  integration_name?: string
}

export interface IntegrationInfo {
  iconUrl?: string
  name?: string
}

export interface ToolCallsSectionProps {
  toolCalls: ToolCallEntry[]
  integrations?: Map<string, IntegrationInfo>
  maxIconsToShow?: number
  defaultExpanded?: boolean
  /** Override the collapsed header label (default: "Used N tool(s)") */
  summaryLabel?: string
  className?: string
  iconSize?: number
  renderIcon?: (call: ToolCallEntry, size: number) => ReactNode
  renderContent?: (content: unknown) => ReactNode
}

interface ChevronIconProps {
  isExpanded: boolean
  size?: number
  className?: string
}

function ChevronIcon({ isExpanded, size = 18, className = '' }: ChevronIconProps) {
  return (
    <HugeiconsIcon
      icon={ArrowDown01Icon}
      size={size}
      className={cn('transition-transform duration-200', isExpanded && 'rotate-180', className)}
    />
  )
}

function PromptCopyBlock({
  label,
  value,
}: {
  label: string
  value: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${label} copied — paste it in the partner assistant search bar`)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy prompt')
    }
  }

  return (
    <div className="flex flex-col">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium text-zinc-400 dark:text-zinc-500">{label}</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-white"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto rounded-md bg-zinc-50 p-2 dark:bg-zinc-900/40">
        <CompactMarkdown content={value} />
      </div>
    </div>
  )
}

export function ToolCallsSection({
  toolCalls,
  integrations,
  maxIconsToShow = 10,
  defaultExpanded = false,
  summaryLabel,
  className,
  iconSize = 21,
  renderIcon,
  renderContent,
}: ToolCallsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [expandedCalls, setExpandedCalls] = useState<Set<number>>(new Set())

  const integrationLookup = useMemo(() => {
    if (integrations) return integrations
    return new Map<string, IntegrationInfo>()
  }, [integrations])

  const getIconUrl = (call: ToolCallEntry): string | undefined => {
    if (call.icon_url) return call.icon_url
    return integrationLookup.get(call.tool_category)?.iconUrl
  }

  const getIntegrationName = (call: ToolCallEntry): string | undefined => {
    if (call.integration_name) return call.integration_name
    return integrationLookup.get(call.tool_category)?.name
  }

  const toggleCallExpansion = (index: number) => {
    setExpandedCalls((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  if (toolCalls.length === 0) return null

  const defaultRenderIcon = (call: ToolCallEntry, size: number) => {
    const icon = getToolCategoryIcon(
      call.tool_category || 'general',
      { width: size, height: size },
      getIconUrl(call),
    )
    return (
      icon || (
        <div className="min-h-8 min-w-8 rounded-lg bg-zinc-200 p-1 text-zinc-600 backdrop-blur dark:bg-zinc-800 dark:text-zinc-400">
          <HugeiconsIcon icon={ToolsIcon} size={size} />
        </div>
      )
    )
  }

  const iconRenderer = renderIcon || defaultRenderIcon
  const defaultRenderContent = (content: unknown) => <CompactMarkdown content={content} />
  const contentRenderer = renderContent || defaultRenderContent

  const renderStackedIcons = () => {
    const seenCategories = new Set<string>()
    const uniqueIcons = toolCalls.filter((call) => {
      const category = call.tool_category || 'general'
      if (seenCategories.has(category)) return false
      seenCategories.add(category)
      return true
    })
    const displayIcons = uniqueIcons.slice(0, maxIconsToShow)

    return (
      <div className="flex min-h-8 items-center -space-x-2">
        {displayIcons.map((call, index) => (
          <div
            key={`${call.tool_name}-${index}`}
            className="relative flex min-w-8 items-center justify-center"
            style={{
              rotate:
                displayIcons.length > 1 ? (index % 2 === 0 ? '8deg' : '-8deg') : '0deg',
              zIndex: index,
            }}
          >
            {iconRenderer(call, iconSize)}
          </div>
        ))}
        {uniqueIcons.length > maxIconsToShow ? (
          <div className="z-0 flex size-7 min-h-7 min-w-7 items-center justify-center rounded-lg bg-zinc-200 text-xs font-normal text-zinc-600 dark:bg-zinc-700/60 dark:text-zinc-500">
            +{uniqueIcons.length - maxIconsToShow}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('w-fit max-w-[35rem]', className)}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex cursor-pointer items-center gap-2 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
      >
        {renderStackedIcons()}
        <span className="text-xs font-medium transition-all duration-200">
          {summaryLabel ||
            `Used ${toolCalls.length} tool${toolCalls.length > 1 ? 's' : ''}`}
        </span>
        <ChevronIcon isExpanded={isExpanded} />
      </button>

      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isExpanded ? 'max-h-[80vh] overflow-y-auto opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="space-y-0 pt-1">
          {toolCalls.map((call, index) => {
            const hasCategoryText =
              call.show_category !== false &&
              Boolean(call.tool_category) &&
              call.tool_category !== 'unknown'
            const outbound = call.outboundPrompt
            const inbound = call.inboundPrompt
            const hasDetails = Boolean(
              outbound || inbound || call.inputs || call.output,
            )
            const isCallExpanded = expandedCalls.has(index)

            return (
              <div
                key={`${call.tool_name}-step-${index}`}
                className="flex items-stretch gap-2"
              >
                <div className="flex flex-col items-center self-stretch">
                  <div className="flex min-h-8 min-w-8 shrink-0 items-center justify-center">
                    {iconRenderer(call, iconSize)}
                  </div>
                  {index < toolCalls.length - 1 ? (
                    <div className="min-h-4 w-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className={cn(
                      'group/parent flex items-center gap-1',
                      hasDetails ? 'cursor-pointer' : '',
                      !hasCategoryText ? 'pt-2' : '',
                    )}
                    onClick={() => hasDetails && toggleCallExpansion(index)}
                  >
                    <p
                      className={cn(
                        'text-xs font-medium text-zinc-600 dark:text-zinc-400',
                        hasDetails &&
                          'group-hover/parent:text-zinc-900 dark:group-hover/parent:text-white',
                      )}
                    >
                      {call.message || formatToolName(call.tool_name)}
                    </p>
                    {hasDetails ? <ChevronIcon isExpanded={isCallExpanded} size={14} /> : null}
                  </button>

                  {hasCategoryText ? (
                    <p className="text-[11px] text-zinc-400 capitalize dark:text-zinc-500">
                      {getIntegrationName(call) ||
                        call.tool_category
                          .replace(/_/g, ' ')
                          .split(' ')
                          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                          .join(' ')}
                    </p>
                  ) : null}

                  {isCallExpanded && hasDetails ? (
                    <div className="mb-3 mt-2 w-fit space-y-2 rounded-xl bg-zinc-100 p-3 text-[11px] dark:bg-zinc-800/50">
                      {outbound ? <PromptCopyBlock label="Outbound prompt" value={outbound} /> : null}
                      {inbound ? <PromptCopyBlock label="Inbound prompt" value={inbound} /> : null}
                      {!outbound &&
                      !inbound &&
                      call.inputs &&
                      Object.keys(call.inputs).length > 0 ? (
                        <div className="flex flex-col">
                          <span className="mb-1 font-medium text-zinc-400 dark:text-zinc-500">
                            Input
                          </span>
                          {contentRenderer(call.inputs)}
                        </div>
                      ) : null}
                      {!outbound && !inbound && call.output ? (
                        <div className="flex flex-col">
                          <span className="mb-1 font-medium text-zinc-400 dark:text-zinc-500">
                            Output
                          </span>
                          {contentRenderer(call.output)}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ToolCallsSection
