'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import type { GuideStep } from '@/lib/services/snippets'
import { cn } from '@/lib/utils'
import { StudioWindow } from './StudioPrimitives'

function CodeLines({ code }: { code: string }) {
  return (
    <div className="max-h-[460px] overflow-auto py-3 font-mono text-[12px] leading-6">
      {code.split('\n').map((line, index) => (
        <div key={index} className="flex px-3">
          <span className="w-8 shrink-0 select-none pr-3 text-right text-muted-foreground/50">{index + 1}</span>
          <span
            className={cn(
              'whitespace-pre',
              line.trim().startsWith('//') || line.trim().startsWith('#') ? 'text-muted-foreground' : 'text-foreground/90',
            )}
          >
            {line || ' '}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Numbered steps; picking one shows its code below, ready to copy. */
export function CodeWalkthrough({ steps, notice }: { steps: GuideStep[]; notice?: string | null }) {
  const [active, setActive] = useState(0)
  const [copied, setCopied] = useState(false)
  const step = steps[active] ?? steps[0]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(step.code)
      setCopied(true)
      toast.success(`${step.file} copied`)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="space-y-1.5">
        {steps.map((item, index) => {
          const selected = index === active
          return (
            <li key={item.title}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setActive(index)
                  setCopied(false)
                }}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all',
                  selected ? 'border-border bg-card shadow-lg shadow-black/5' : 'border-transparent hover:border-border/70 hover:bg-muted/30',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]',
                    selected ? 'border-primary text-primary' : 'border-border text-muted-foreground',
                  )}
                >
                  {index + 1}
                </span>
                <span>
                  <span className={cn('block text-sm font-medium', !selected && 'text-muted-foreground')}>{item.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.body}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <StudioWindow
        title={step.file}
        actions={
          <button
            type="button"
            onClick={() => void copy()}
            aria-label={`Copy ${step.file}`}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0, filter: 'blur(6px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(4px)' }}
            transition={{ duration: 0.18 }}
          >
            <CodeLines code={step.code} />
          </motion.div>
        </AnimatePresence>
      </StudioWindow>

      {notice ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">{notice}</p>
      ) : null}
    </div>
  )
}
