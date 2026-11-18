// Agent state, adapted from 000h by Cojeev (MIT licence): https://cojeev.com/ui/docs/agent-state/
// Changes for this app: tokens and resets are scoped to the component (the original set them on
// :root and on every [data-slot] element, which restyled shadcn components app-wide), the app's own
// font is used instead of remote font files, and the library's motion-settings runtime is replaced
// by the user's reduced-motion preference.
'use client'

import * as React from 'react'
import { motion, useInView, useReducedMotion, type Transition } from 'motion/react'
import { cn } from '@/lib/utils'

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'needs-input' | 'complete' | 'error'
export type AgentStateProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  status?: AgentStatus
  size?: 'sm' | 'md' | 'lg'
  label?: string
  description?: string
}

const STATE_LABELS: Record<AgentStatus, string> = {
  idle: 'Ready when you are',
  thinking: 'Thinking',
  working: 'Working',
  'needs-input': 'Your decision',
  complete: 'Complete',
  error: 'Needs attention',
}

// Equal cubic topology lets Motion interpolate between silhouettes. Each state stays
// recognisable when motion is off.
const SILHOUETTES: Record<AgentStatus, string> = {
  idle: 'M90 24C116 17 151 32 153 60C157 84 139 96 124 116C111 135 81 141 59 126C34 113 22 85 32 61C43 36 65 31 90 24Z',
  thinking: 'M90 18C120 27 132 19 148 51C163 78 141 92 135 116C127 146 94 137 68 129C40 123 18 98 30 70C40 48 66 7 90 18Z',
  working: 'M90 17C114 11 156 41 151 65C146 85 165 110 134 123C106 140 85 121 61 131C34 140 17 94 30 71C44 47 68 25 90 17Z',
  'needs-input': 'M90 27C121 20 147 29 145 61C143 82 162 111 134 125C108 138 91 114 65 127C35 140 28 101 31 76C34 48 62 33 90 27Z',
  complete: 'M90 24C118 24 145 36 150 63C155 91 134 116 112 125C87 137 63 128 47 113C29 95 25 69 40 47C53 28 66 24 90 24Z',
  error: 'M90 30C113 7 131 35 147 54C167 77 135 93 139 117C142 142 105 128 83 132C55 139 18 117 28 89C37 65 60 40 90 30Z',
}

const SETTLE: Transition = { type: 'spring', stiffness: 360, damping: 32, mass: 0.85 }
const STILL: Transition = { duration: 0 }

function usePageVisible() {
  return React.useSyncExternalStore(
    (onChange) => {
      document.addEventListener('visibilitychange', onChange)
      return () => document.removeEventListener('visibilitychange', onChange)
    },
    () => document.visibilityState !== 'hidden',
    () => true,
  )
}

export function AgentState({ status = 'idle', size = 'md', label, description, className, ...props }: AgentStateProps) {
  const id = React.useId().replace(/:/g, '')
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '40px' })
  const reduced = useReducedMotion() ?? false
  const visible = usePageVisible()

  // Only real in-progress states move, and only while someone can see them.
  const active = !reduced && inView && visible && (status === 'thinking' || status === 'working')
  const settle = reduced ? STILL : SETTLE
  const contour = SILHOUETTES[status]
  const alternate = SILHOUETTES[status === 'thinking' ? 'working' : 'thinking']
  const pathAnimation = active ? { d: [contour, alternate, contour] } : { d: contour }
  const fieldTransition: Transition = active
    ? { duration: status === 'working' ? 5 : 7, repeat: Infinity, ease: 'easeInOut' }
    : settle

  return (
    <div
      ref={ref}
      data-slot="agent-state"
      data-status={status}
      data-size={size}
      data-animated={active || undefined}
      className={cn('v-agent-state', className)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      {...props}
    >
      <style href="sts-agent-state" precedence="default">
        {AGENT_STATE_CSS}
      </style>
      <svg className="v-agent-state__field" viewBox="0 0 180 160" fill="none" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={`${id}-body`} cx=".3" cy=".2" r=".85">
            <stop stopColor="var(--agent-light)" />
            <stop offset=".5" stopColor="var(--agent-base)" />
            <stop offset="1" stopColor="var(--agent-deep)" />
          </radialGradient>
          <radialGradient id={`${id}-fold`} cx=".65" cy=".22" r=".8">
            <stop stopColor="var(--agent-cream)" stopOpacity=".84" />
            <stop offset=".4" stopColor="var(--agent-light)" stopOpacity=".7" />
            <stop offset="1" stopColor="var(--agent-deep)" stopOpacity=".2" />
          </radialGradient>
          <linearGradient id={`${id}-rim`} x1="30" y1="30" x2="138" y2="134" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--agent-cream)" stopOpacity=".92" />
            <stop offset=".48" stopColor="var(--agent-light)" stopOpacity=".2" />
            <stop offset="1" stopColor="var(--agent-deep)" stopOpacity=".8" />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <motion.path initial={false} d={contour} animate={pathAnimation} transition={fieldTransition} />
          </clipPath>
        </defs>
        <ellipse cx="92" cy="139" rx="43" ry="5" fill="var(--agent-deep)" opacity=".12" />
        <motion.path initial={false} d={contour} animate={pathAnimation} transition={fieldTransition} fill={`url(#${id}-body)`} />
        <g clipPath={`url(#${id}-clip)`}>
          <motion.g
            initial={false}
            animate={active ? { rotate: [0, 12, -6, 0], x: [0, 5, -3, 0] } : { rotate: 0, x: 0 }}
            transition={active ? { duration: 10, repeat: Infinity, ease: 'easeInOut' } : settle}
            style={{ transformOrigin: '90px 80px' }}
          >
            <path d="M15 61C51 32 81 110 128 89C165 72 142 24 105 14C163 7 181 113 125 142C74 168 20 125 15 61Z" fill={`url(#${id}-fold)`} />
            <path d="M26 48C64 18 59 134 119 110C147 99 132 71 155 47" stroke={`url(#${id}-rim)`} strokeWidth="1.2" />
            <path d="M30 44C69 19 58 139 125 111C151 99 136 69 159 43" stroke={`url(#${id}-rim)`} strokeWidth=".65" opacity=".75" />
            <path d="M35 42C74 26 64 143 131 109C154 97 141 65 162 40" stroke={`url(#${id}-rim)`} strokeWidth=".5" opacity=".5" />
            <path d="M24 92C47 78 93 148 139 118" stroke="var(--agent-deep)" strokeOpacity=".25" strokeWidth="14" />
          </motion.g>
        </g>
        <motion.path initial={false} d={contour} animate={pathAnimation} transition={fieldTransition} stroke={`url(#${id}-rim)`} strokeWidth="1.2" />
        <g stroke="var(--agent-ink)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          {status === 'complete' ? (
            <path d="m77 79 9 9 19-21" />
          ) : status === 'error' ? (
            <>
              <path d="M90 66v16" />
              <path d="M90 91h.01" />
            </>
          ) : status === 'needs-input' ? (
            <>
              <path d="M84 72a7 7 0 0 1 14 0c0 5-8 6-8 11" />
              <path d="M90 92h.01" />
            </>
          ) : (
            <>
              <path d="M77 77v5M101 77v5" />
              <path d={status === 'idle' ? 'M84 91q6 4 12 0' : 'M85 91h10'} />
            </>
          )}
        </g>
      </svg>
      <div className="v-agent-state__copy">
        <span className="v-agent-state__label">{label ?? STATE_LABELS[status]}</span>
        {description ? <span className="v-agent-state__description">{description}</span> : null}
      </div>
    </div>
  )
}

// React 19 hoists this <style> into <head> once per page. Every rule is scoped to the component.
const AGENT_STATE_CSS = `
[data-slot="agent-state"]{
  --agent-pink:#F0A4CC;--agent-pink-deep:#d693b7;--agent-olive:#A8BC75;--agent-olive-deep:#96a86a;
  --agent-blue:#95BAE8;--agent-blue-deep:#86a6cf;--agent-yellow:#F1D369;--agent-yellow-deep:#d6bc60;
  --agent-danger:#D7473C;--agent-cream:#F6EFE2;--agent-ink:#111111;
  --agent-base:var(--agent-pink);--agent-light:var(--agent-yellow);--agent-deep:var(--agent-pink-deep);
  display:flex;align-items:center;min-width:0;gap:12px;color:inherit;
}
[data-slot="agent-state"][data-status="thinking"]{--agent-base:var(--agent-blue);--agent-light:var(--agent-pink);--agent-deep:var(--agent-blue-deep)}
[data-slot="agent-state"][data-status="needs-input"]{--agent-base:var(--agent-yellow);--agent-light:var(--agent-cream);--agent-deep:var(--agent-yellow-deep)}
[data-slot="agent-state"][data-status="complete"]{--agent-base:var(--agent-olive);--agent-light:var(--agent-yellow);--agent-deep:var(--agent-olive-deep)}
[data-slot="agent-state"][data-status="error"]{--agent-deep:var(--agent-danger)}
[data-slot="agent-state"] .v-agent-state__field{display:block;width:88px;height:auto;flex:0 0 auto;overflow:visible;pointer-events:none}
[data-slot="agent-state"] .v-agent-state__copy{display:grid;min-width:0;gap:4px}
[data-slot="agent-state"] .v-agent-state__label{font-weight:600;font-size:17px;line-height:1.25;letter-spacing:-.02em;overflow-wrap:anywhere}
[data-slot="agent-state"] .v-agent-state__description{font-size:13px;line-height:1.45;opacity:.7;max-width:35ch;overflow-wrap:anywhere}
[data-slot="agent-state"][data-size="sm"]{gap:4px}
[data-slot="agent-state"][data-size="sm"] .v-agent-state__field{width:48px}
[data-slot="agent-state"][data-size="sm"] .v-agent-state__label{font-size:13px;letter-spacing:0}
[data-slot="agent-state"][data-size="sm"] .v-agent-state__description{font-size:12px}
[data-slot="agent-state"][data-size="lg"]{flex-direction:column;text-align:center;gap:0}
[data-slot="agent-state"][data-size="lg"] .v-agent-state__field{width:min(100%,216px)}
[data-slot="agent-state"][data-size="lg"] .v-agent-state__label{font-size:26px}
[data-slot="agent-state"][data-size="lg"] .v-agent-state__description{max-width:32ch;margin-inline:auto;font-size:14px}
@media (forced-colors:active){[data-slot="agent-state"] .v-agent-state__field{forced-color-adjust:none}}
`
