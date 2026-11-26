'use client'

/**
 * hover-terminal, as given: "Install" that opens into the command on hover and copies it on click.
 * sts-ai changes: it takes the whole `command` (not a pip package), no demo wrapper around the
 * button, `motion` (framer-motion's current package), the open width fits the command, and on a
 * touch screen (no hover) the first tap opens it and the second copies.
 */

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Download, Terminal } from 'lucide-react'

interface HoverTerminalProps {
  command: string
  label?: string
}

export default function HoverTerminal({ command, label = 'Install' }: HoverTerminalProps) {
  const [state, setState] = useState<'idle' | 'hovered' | 'copied'>('idle')
  const [openWidth, setOpenWidth] = useState(350)
  const pointerType = useRef<string>('mouse')

  // Wide enough for the command (monospace, text-sm), never wider than the screen.
  useEffect(() => {
    const fit = () => setOpenWidth(Math.min(command.length * 8.5 + 88, window.innerWidth - 32))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [command])

  useEffect(() => {
    if (state === 'copied') {
      const timer = setTimeout(() => setState('idle'), 2000)
      return () => clearTimeout(timer)
    }
  }, [state])

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    // Touch: the first tap shows the command, the second copies it.
    if (pointerType.current !== 'mouse' && state === 'idle') {
      setState('hovered')
      return
    }
    const textToCopy = command

    try {
      // 1. Try modern Clipboard API first
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy)
        setState('copied')
      } else {
        throw new Error('Clipboard API not supported')
      }
    } catch {
      // 2. Fallback for restricted iframes
      try {
        const textArea = document.createElement('textarea')
        textArea.value = textToCopy
        textArea.style.position = 'absolute'
        textArea.style.left = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        const successful = document.execCommand('copy')
        textArea.remove()
        if (successful) setState('copied')
        else console.error('Fallback copy failed.')
      } catch (fallbackErr) {
        console.error('Failed to copy!', fallbackErr)
      }
    }
  }

  return (
    <motion.button
      layout
      type="button"
      aria-label={state === 'copied' ? 'Copied' : `${label}: copy ${command}`}
      onPointerDown={(e) => {
        pointerType.current = e.pointerType
      }}
      onClick={handleCopy}
      onHoverStart={() => state !== 'copied' && setState('hovered')}
      onHoverEnd={() => state !== 'copied' && setState('idle')}
      onBlur={() => state === 'hovered' && setState('idle')}
      className={`
          relative flex items-center justify-center h-12 overflow-hidden
          rounded-lg border font-mono text-sm shadow-sm
          transition-colors duration-300 focus:outline-none focus:ring-2
          focus:ring-neutral-500/50 focus:ring-offset-2
          focus:ring-offset-white dark:focus:ring-offset-[#0A0A0A]
          ${
            state === 'hovered'
              ? 'border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900'
              : state === 'copied'
                ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10'
                : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
          }
        `}
      animate={{
        width: state === 'hovered' ? openWidth : 140,
      }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {/* --- State 1: Default --- */}
        {state === 'idle' && (
          <motion.div
            key="idle"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
          >
            <Download size={16} className="text-neutral-400 dark:text-neutral-500" />
            <span className="font-medium tracking-wide">{label}</span>
          </motion.div>
        )}

        {/* --- State 2: Terminal/Hover --- */}
        {state === 'hovered' && (
          <motion.div
            key="hovered"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute flex w-full items-center gap-3 px-4"
          >
            <Terminal size={14} className="shrink-0 text-neutral-400 dark:text-neutral-500" />
            <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-neutral-800 dark:text-neutral-300">
              <span className="select-none text-neutral-400 dark:text-neutral-500">~</span>
              <span className="truncate whitespace-nowrap">{command}</span>
              <motion.div
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                className="h-4 w-1.5 shrink-0 bg-neutral-800 dark:bg-neutral-400"
              />
            </div>
          </motion.div>
        )}

        {/* --- State 3: Copied --- */}
        {state === 'copied' && (
          <motion.div
            key="copied"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute flex items-center gap-2 text-emerald-600 dark:text-emerald-400"
          >
            <Check size={16} />
            <span className="font-medium">Copied!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
