'use client'

import * as React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ClipboardPaste, Command, LoaderIcon, SendIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageList } from '@/components/ui/message-list'
import type { Message } from '@/components/ui/chat-message'
import {
  currentSlashToken,
  filterSlashCommands,
  replaceCurrentSlashToken,
  type PartnerSlashCommand,
} from '@/lib/partners/slashCommands'
import {
  listPipelinePrompts,
  type PipelinePromptPick,
} from '@/lib/partners/pipelinePrompts'

type CommandSuggestion = PartnerSlashCommand & {
  icon: React.ReactNode
}

interface UseAutoResizeTextareaProps {
  minHeight: number
  maxHeight?: number
}

function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current
      if (!textarea) return

      if (reset) {
        textarea.style.height = `${minHeight}px`
        return
      }

      textarea.style.height = `${minHeight}px`
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY),
      )
      textarea.style.height = `${newHeight}px`
    },
    [minHeight, maxHeight],
  )

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) textarea.style.height = `${minHeight}px`
  }, [minHeight])

  useEffect(() => {
    const handleResize = () => adjustHeight()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [adjustHeight])

  return { textareaRef, adjustHeight }
}

type ComposerTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  containerClassName?: string
  showRing?: boolean
}

const ComposerTextarea = React.forwardRef<HTMLTextAreaElement, ComposerTextareaProps>(
  ({ className, containerClassName, showRing = true, onFocus, onBlur, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false)

    return (
      <div className={cn('relative', containerClassName)}>
        <textarea
          className={cn(
            'flex min-h-[80px] w-full rounded-md bg-transparent px-3 py-2 text-sm',
            'transition-all duration-200 ease-in-out',
            'placeholder:text-muted-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
            showRing ? 'focus-visible:outline-none' : '',
            className,
          )}
          ref={ref}
          onFocus={(event) => {
            setIsFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setIsFocused(false)
            onBlur?.(event)
          }}
          {...props}
        />
        {showRing && isFocused ? (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-violet-500/30 ring-offset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        ) : null}
      </div>
    )
  },
)
ComposerTextarea.displayName = 'ComposerTextarea'

function TypingDots() {
  return (
    <div className="ml-1 flex items-center">
      {[1, 2, 3].map((dot) => (
        <motion.div
          key={dot}
          className="mx-0.5 h-1.5 w-1.5 rounded-full bg-foreground/90"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.85, 1.1, 0.85] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: dot * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

export function AnimatedAIChat({
  value,
  onValueChange,
  onSend,
  isTyping,
  commands,
  messages,
  pipelineKinds,
  placeholder = 'Type a command or ask a question…',
  title = 'How can I help today?',
  subtitle = 'Type /medusa, /n8n, or pick an inbound/outbound prompt',
  header,
  footer,
}: {
  value: string
  onValueChange: (value: string) => void
  onSend: () => void
  isTyping: boolean
  commands: CommandSuggestion[]
  messages: Message[]
  /** Partner kinds whose inbound/outbound prompts appear in the picker. Empty = all. */
  pipelineKinds?: string[]
  placeholder?: string
  title?: string
  subtitle?: string
  header?: React.ReactNode
  footer?: React.ReactNode
}) {
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [recentCommand, setRecentCommand] = useState<string | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [inputFocused, setInputFocused] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  })
  const commandPaletteRef = useRef<HTMLDivElement>(null)
  const isEmpty = messages.length === 0

  const slashToken = currentSlashToken(value)
  const filteredCommands = useMemo(() => {
    if (!slashToken) return commands
    const matches = filterSlashCommands(slashToken)
    return matches
      .map((match) => commands.find((command) => command.id === match.id))
      .filter((command): command is CommandSuggestion => Boolean(command))
  }, [commands, slashToken])
  const barCommands = useMemo(
    () => commands.filter((command) => command.showInBar),
    [commands],
  )
  const pipelinePrompts = useMemo(() => listPipelinePrompts(pipelineKinds), [pipelineKinds])

  useEffect(() => {
    if (slashToken) {
      setShowCommandPalette(true)
      setActiveSuggestion(filteredCommands.length > 0 ? 0 : -1)
      return
    }
    setShowCommandPalette(false)
    setActiveSuggestion(-1)
  }, [filteredCommands.length, slashToken])

  useEffect(() => {
    if (!inputFocused) return
    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({ x: event.clientX, y: event.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [inputFocused])

  useEffect(() => {
    if (!value) adjustHeight(true)
  }, [adjustHeight, value])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const commandButton = document.querySelector('[data-command-button]')
      if (
        commandPaletteRef.current &&
        !commandPaletteRef.current.contains(target) &&
        !commandButton?.contains(target)
      ) {
        setShowCommandPalette(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectCommand = (command: CommandSuggestion) => {
    onValueChange(replaceCurrentSlashToken(value, command.prefix))
    setShowCommandPalette(false)
    setRecentCommand(command.label)
    window.setTimeout(() => setRecentCommand(null), 2500)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      adjustHeight()
    })
  }

  const selectPipelinePrompt = (pick: PipelinePromptPick) => {
    onValueChange(pick.prompt)
    setPasteOpen(false)
    setRecentCommand(pick.title)
    window.setTimeout(() => setRecentCommand(null), 2500)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      adjustHeight()
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandPalette && filteredCommands.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveSuggestion((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveSuggestion((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1))
        return
      }
      if (event.key === 'Tab' || event.key === 'Enter') {
        event.preventDefault()
        const selected = filteredCommands[activeSuggestion] ?? filteredCommands[0]
        if (selected) selectCommand(selected)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setShowCommandPalette(false)
        return
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (value.trim()) onSend()
    }
  }

  const canSend = Boolean(value.trim())

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 h-96 w-96 animate-pulse rounded-full bg-violet-500/10 blur-[128px] mix-blend-normal filter" />
        <div className="absolute right-1/4 bottom-0 h-96 w-96 animate-pulse rounded-full bg-indigo-500/10 blur-[128px] mix-blend-normal filter delay-700" />
        <div className="absolute top-1/4 right-1/3 h-64 w-64 animate-pulse rounded-full bg-fuchsia-500/10 blur-[96px] mix-blend-normal filter delay-1000" />
      </div>

      {header}

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4 pt-14 pb-6">
        <motion.div
          className={`flex min-h-0 flex-1 flex-col space-y-8 ${isEmpty ? 'justify-center' : 'justify-end'}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {isEmpty ? (
            <div className="space-y-3 text-center">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="inline-block"
              >
                <h1 className="bg-gradient-to-r from-foreground/90 to-foreground/40 bg-clip-text pb-1 text-3xl font-medium tracking-tight text-transparent">
                  {title}
                </h1>
                <motion.div
                  className="h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '100%', opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                />
              </motion.div>
              <motion.p
                className="text-sm text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {subtitle}
              </motion.p>
              {recentCommand ? (
                <p className="text-xs text-violet-500">Using {recentCommand}</p>
              ) : null}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <MessageList messages={messages} isTyping={isTyping} showTimeStamps={false} />
            </div>
          )}

          <motion.div
            className="relative rounded-2xl border border-foreground/10 bg-foreground/[0.03] shadow-2xl backdrop-blur-2xl"
            initial={{ scale: 0.98 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <AnimatePresence>
              {showCommandPalette && filteredCommands.length > 0 ? (
                <motion.div
                  ref={commandPaletteRef}
                  className="absolute right-4 bottom-full left-4 z-50 mb-2 overflow-hidden rounded-lg border border-border bg-popover/95 shadow-lg backdrop-blur-xl"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="max-h-64 overflow-y-auto py-1">
                    {filteredCommands.map((suggestion, index) => (
                      <motion.button
                        type="button"
                        key={`${suggestion.prefix}-${suggestion.id}`}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors',
                          activeSuggestion === index
                            ? 'bg-foreground/10 text-foreground'
                            : 'text-muted-foreground hover:bg-foreground/5',
                        )}
                        onClick={() => selectCommand(suggestion)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <div className="flex h-5 w-5 items-center justify-center text-muted-foreground">
                          {suggestion.icon}
                        </div>
                        <div className="font-medium text-foreground">{suggestion.label}</div>
                        <div className="ml-1 text-xs text-muted-foreground">{suggestion.prefix}</div>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="p-4">
              <ComposerTextarea
                ref={textareaRef}
                value={value}
                onChange={(event) => {
                  onValueChange(event.target.value)
                  adjustHeight()
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={placeholder}
                containerClassName="w-full"
                className={cn(
                  'min-h-[60px] w-full resize-none border-none bg-transparent px-4 py-3',
                  'text-sm text-foreground/90',
                  'placeholder:text-muted-foreground/60',
                  'focus:outline-none',
                )}
                style={{ overflow: 'hidden' }}
                showRing={false}
              />
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-foreground/10 p-4">
              <div className="flex items-center gap-3">
                <motion.button
                  type="button"
                  onClick={() => setPasteOpen(true)}
                  whileTap={{ scale: 0.94 }}
                  className="group relative rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Pick inbound or outbound prompt"
                >
                  <ClipboardPaste className="h-4 w-4" />
                  <motion.span className="absolute inset-0 rounded-lg bg-foreground/[0.05] opacity-0 transition-opacity group-hover:opacity-100" />
                </motion.button>
                <motion.button
                  type="button"
                  data-command-button
                  onClick={(event) => {
                    event.stopPropagation()
                    if (slashToken) {
                      setShowCommandPalette((prev) => !prev)
                      return
                    }
                    onValueChange(value.trim() ? `${value.trimEnd()} /` : '/')
                  }}
                  whileTap={{ scale: 0.94 }}
                  className={cn(
                    'group relative rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground',
                    showCommandPalette && 'bg-foreground/10 text-foreground',
                  )}
                  aria-label="Open partner commands"
                >
                  <Command className="h-4 w-4" />
                </motion.button>
              </div>

              <motion.button
                type="button"
                onClick={onSend}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                disabled={isTyping || !canSend}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                  canSend
                    ? 'bg-foreground text-background shadow-lg shadow-foreground/10'
                    : 'bg-foreground/5 text-muted-foreground',
                )}
              >
                {isTyping ? (
                  <LoaderIcon className="h-4 w-4 animate-[spin_2s_linear_infinite]" />
                ) : (
                  <SendIcon className="h-4 w-4" />
                )}
                <span>Send</span>
              </motion.button>
            </div>
          </motion.div>

          {footer}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {barCommands.map((suggestion, index) => (
              <motion.button
                type="button"
                key={suggestion.id}
                onClick={() => selectCommand(suggestion)}
                className="group relative flex items-center gap-2 rounded-lg bg-foreground/[0.03] px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-foreground/[0.06] hover:text-foreground"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                {suggestion.icon}
                <span>{suggestion.label}</span>
                <span className="text-[11px] text-muted-foreground/70">{suggestion.prefix}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {isTyping && isEmpty ? (
          <motion.div
            className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 rounded-full border border-foreground/10 bg-background/70 px-4 py-2 shadow-lg backdrop-blur-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-8 items-center justify-center rounded-full bg-foreground/5 text-center">
                <span className="text-xs font-medium text-foreground/90">sts</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Thinking</span>
                <TypingDots />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {inputFocused ? (
        <motion.div
          className="pointer-events-none fixed z-0 h-[50rem] w-[50rem] rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 opacity-[0.04] blur-[96px]"
          animate={{
            x: mousePosition.x - 400,
            y: mousePosition.y - 400,
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 150, mass: 0.5 }}
        />
      ) : null}

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="max-w-lg gap-0 p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>Inbound / outbound prompts</DialogTitle>
            <DialogDescription>
              Pick a pipeline prompt. It fills the search bar — edit if you want, then Send.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[min(70vh,28rem)]">
            <div className="space-y-1 p-2">
              {pipelinePrompts.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No inbound/outbound prompts for the connected partners.
                </p>
              ) : (
                pipelinePrompts.map((pick) => (
                  <button
                    key={pick.id}
                    type="button"
                    onClick={() => selectPipelinePrompt(pick)}
                    className="flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{pick.title}</span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          pick.direction === 'outbound'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                        )}
                      >
                        {pick.direction}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {pick.integrationName}
                      <span className="mx-1.5 text-muted-foreground/50">·</span>
                      <span className="font-mono">{pick.kind}</span>
                    </p>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
