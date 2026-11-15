'use client'

import React, { useState } from 'react'
import { BrainCircuit, Check, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PlanStepStatus = 'pending' | 'active' | 'success' | 'error'

export interface PlanStep {
  id: string
  title: string
  content?: React.ReactNode
  status: PlanStepStatus
  icon?: React.ReactNode
  duration?: string
  defaultExpanded?: boolean
}

export interface AgentPlanningProps {
  title?: string
  steps: PlanStep[]
  className?: string
}

const STATUS_COLOR: Record<PlanStepStatus, string> = {
  success: 'bg-emerald-100 text-emerald-600 ring-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400',
  active: 'bg-blue-100 text-blue-600 ring-blue-500/30 dark:bg-blue-500/20 dark:text-blue-400',
  error: 'bg-rose-100 text-rose-600 ring-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400',
  pending: 'bg-secondary text-muted-foreground ring-border/50 dark:bg-secondary/50',
}

/**
 * A collapsible "agent is thinking" timeline: one row per step with a status dot, a connecting
 * line, a duration and an expandable detail panel.
 */
export const AgentPlanning = ({ title = 'Agent is planning', steps, className }: AgentPlanningProps) => {
  const [isMainExpanded, setIsMainExpanded] = useState(true)
  // Steps appear over time: a step not toggled yet follows its own defaultExpanded.
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const isExpanded = (step: PlanStep) => toggled[step.id] ?? Boolean(step.defaultExpanded)

  const hasActive = steps.some((step) => step.status === 'active')
  const allSuccess = steps.length > 0 && steps.every((step) => step.status === 'success')

  return (
    <div className={cn('mx-auto my-4 w-full max-w-2xl font-sans text-foreground', className)}>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-300">
        <button
          type="button"
          onClick={() => setIsMainExpanded(!isMainExpanded)}
          aria-expanded={isMainExpanded}
          className={cn(
            'flex w-full select-none items-center justify-between px-4 py-3.5 text-left transition-colors',
            isMainExpanded ? 'border-b border-border/50 bg-secondary/30' : 'hover:bg-secondary/30',
          )}
        >
          <span className="flex items-center gap-3">
            <span className="flex h-5 w-5 items-center justify-center">
              {hasActive ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
              ) : allSuccess ? (
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <BrainCircuit className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-foreground/90">{title}</span>
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary">
            {isMainExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </button>

        <div
          className={cn(
            'grid bg-card transition-all duration-500 ease-in-out',
            isMainExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            <ol className="flex flex-col p-5">
              {steps.map((step, index) => {
                const expanded = isExpanded(step)
                const isLast = index === steps.length - 1
                return (
                  <li
                    key={step.id}
                    className={cn(
                      'relative flex gap-4 animate-in fade-in slide-in-from-top-4 duration-500 fill-mode-both',
                      step.status === 'pending' ? 'opacity-60 grayscale' : 'opacity-100',
                    )}
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    {!isLast && <span aria-hidden className="absolute bottom-[-10px] left-[11px] top-7 z-0 w-[2px] bg-border/60" />}

                    <span className="relative z-10 mt-0.5 h-6 w-6 flex-none">
                      <span
                        className={cn(
                          'flex h-full w-full items-center justify-center rounded-full ring-4 ring-card transition-colors duration-300',
                          STATUS_COLOR[step.status],
                        )}
                      >
                        {step.status === 'success' ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : step.status === 'active' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          step.icon || <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        )}
                      </span>
                    </span>

                    <div className="min-w-0 flex-1 pb-6">
                      <button
                        type="button"
                        disabled={!step.content}
                        onClick={() => setToggled((current) => ({ ...current, [step.id]: !expanded }))}
                        aria-expanded={step.content ? expanded : undefined}
                        className={cn(
                          'group -mx-2 flex w-[calc(100%+1rem)] items-center justify-between rounded-md px-2 py-1 text-left transition-colors',
                          step.content ? 'cursor-pointer hover:bg-secondary/50' : 'cursor-default',
                        )}
                      >
                        <span
                          className={cn(
                            'text-[14px] tracking-tight transition-colors duration-200',
                            step.status === 'active'
                              ? 'font-semibold text-foreground'
                              : step.status === 'error'
                                ? 'font-semibold text-rose-600 dark:text-rose-400'
                                : 'font-medium text-foreground/80 group-hover:text-foreground',
                          )}
                        >
                          {step.title}
                        </span>
                        <span className="flex items-center gap-3">
                          {step.duration && <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{step.duration}</span>}
                          {step.content && (
                            <span className="text-muted-foreground/40 transition-colors group-hover:text-muted-foreground">
                              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </span>
                          )}
                        </span>
                      </button>

                      {step.content && (
                        <div
                          className={cn(
                            'grid transition-all duration-300 ease-in-out',
                            expanded ? 'mt-2 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0',
                          )}
                        >
                          <div className="overflow-hidden">
                            <div className="pb-2 pt-1">{step.content}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgentPlanning
