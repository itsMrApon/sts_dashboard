'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  Check,
  Copy,
  Cpu,
  FileCode2,
  ShieldCheck,
  Terminal,
  type LucideIcon,
} from 'lucide-react'

export type DemoToken = { text: string; className: string }

export type DemoLine =
  | { num: number; type: 'comment'; text: string }
  | { num: number; type: 'empty'; text?: string }
  | { num: number; type: 'code'; indent?: boolean; tokens: DemoToken[] }

export type CodePreview = {
  fileName: string
  copyValue: string
  lines: DemoLine[]
}

export type PromptTabId = 'cursor' | 'claude' | 'cli' | 'universal'

export type PromptTab = CodePreview & {
  id: PromptTabId
  label: string
}

const PROMPT_TAB_ORDER: PromptTabId[] = ['cursor', 'claude', 'cli', 'universal']

export type FeatureCard = {
  id: string
  title: string
  description: string
  icon: LucideIcon
  accent: string
  glow: string
  proof: {
    label: string
    lines: Array<{ text: string; dim: boolean }>
  }
  extra?: React.ReactNode
}

const DEFAULT_DEMO_CODE: DemoLine[] = [
  { num: 1, type: 'comment', text: '// This is a file with a demo for your component' },
  { num: 2, type: 'comment', text: "// That's what users will see in the preview" },
  { num: 3, type: 'comment', text: '// Create new files in this directory to add more demos' },
  { num: 4, type: 'empty' },
  {
    num: 5,
    type: 'code',
    tokens: [
      { text: 'import ', className: 'text-rose-400' },
      { text: '{ ', className: 'text-amber-400' },
      { text: 'Component', className: 'text-amber-400' },
      { text: ' } ', className: 'text-amber-400' },
      { text: 'from ', className: 'text-rose-400' },
      { text: '"@/components/ui/component"', className: 'text-emerald-300/90' },
      { text: ';', className: 'text-zinc-500' },
    ],
  },
  { num: 6, type: 'empty' },
  { num: 7, type: 'comment', text: '// ONLY DEFAULT EXPORT WILL BE TREATED AS A DEMO' },
  {
    num: 8,
    type: 'code',
    tokens: [
      { text: 'export default function ', className: 'text-rose-400' },
      { text: 'DemoOne', className: 'text-amber-400' },
      { text: '() {', className: 'text-amber-400' },
    ],
  },
  {
    num: 9,
    type: 'code',
    indent: true,
    tokens: [
      { text: 'return ', className: 'text-rose-400' },
      { text: '<', className: 'text-amber-400' },
      { text: 'Component ', className: 'text-amber-400' },
      { text: '/>;', className: 'text-amber-400' },
    ],
  },
  {
    num: 10,
    type: 'code',
    tokens: [{ text: '}', className: 'text-amber-400' }],
  },
  { num: 11, type: 'empty' },
]

const DEFAULT_EXPLANATIONS: Record<number, string> = {
  5: 'Import your isolated components from the generated registry.',
  8: 'The default export acts as the entry point for the visualizer.',
  9: 'Return the component. We handle the hot-reloading context automatically.',
}

const DEFAULT_FEATURES: FeatureCard[] = [
  {
    id: 'runtime',
    title: 'Zero-runtime overhead',
    description:
      'Styles are statically extracted during the build step. We emit standard CSS files—no style injection, no client-side parsing, no layout thrashing.',
    icon: Activity,
    accent: 'text-emerald-400',
    glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(52,211,153,0.15)]',
    proof: {
      label: 'Build Output',
      lines: [
        { text: '✓ 124 components compiled', dim: true },
        { text: '✓ 0.0ms runtime injection', dim: false },
        { text: '↳ out/main.css (4.2kb brotli)', dim: true },
      ],
    },
  },
  {
    id: 'types',
    title: 'Strictly typed APIs',
    description:
      'Every interface is built from the ground up in TypeScript. Catch invalid prop combinations and layout collisions in your editor, long before they hit CI.',
    icon: ShieldCheck,
    accent: 'text-amber-400',
    glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(251,191,36,0.15)]',
    proof: {
      label: 'Editor Diagnostics',
      lines: [
        { text: "Type 'string' is not assignable", dim: true },
        { text: 'to type \'"solid" | "outline" | "ghost"\'.', dim: false },
        { text: 'ts(2322) [14, 5]', dim: true },
      ],
    },
  },
  {
    id: 'headless',
    title: 'Headless accessibility',
    description:
      'Bring your own DOM. We manage the complex state machines, ARIA attributes, and keyboard navigation routing via abstract React hooks.',
    icon: Cpu,
    accent: 'text-rose-400',
    glow: 'group-hover:shadow-[0_0_30px_-5px_rgba(251,113,133,0.15)]',
    proof: {
      label: 'DOM Inspector',
      lines: [
        { text: '<button', dim: true },
        { text: '  aria-expanded="true"', dim: false },
        { text: '  aria-controls="radix-:R1:"', dim: false },
        { text: '>', dim: true },
      ],
    },
  },
]

function accentColor(accent: string) {
  if (accent.includes('emerald')) return '#34d399'
  if (accent.includes('amber')) return '#fbbf24'
  return '#fb7185'
}

export type DevToolLandingPageProps = {
  header?: React.ReactNode
  badge?: string
  heroTitle?: string
  heroDescription?: string
  walkthroughLabel?: string
  explanations?: Record<number, string>
  walkthroughLines?: number[]
  demoCode?: DemoLine[]
  promptTabs?: PromptTab[]
  promptTabsByStep?: Record<number, PromptTab[]>
  defaultPromptTab?: PromptTabId
  defaultWalkthroughLine?: number
  fileName?: string
  onCopyValue?: string
  featuresTitle?: string
  featuresDescription?: string
  features?: FeatureCard[]
}

function InteractiveCodeHero({
  badge = 'Integration',
  heroTitle = 'Zero-config previews.',
  heroDescription = 'Drop your component into the directory. We parse the AST, generate the sandbox, and handle the dependencies. No configuration files required.',
  walkthroughLabel = 'Walkthrough',
  explanations = DEFAULT_EXPLANATIONS,
  walkthroughLines = [5, 8, 9],
  demoCode = DEFAULT_DEMO_CODE,
  promptTabs,
  promptTabsByStep,
  defaultPromptTab = 'cursor',
  defaultWalkthroughLine,
  fileName = 'demo.tsx',
  onCopyValue,
}: DevToolLandingPageProps) {
  const [hoveredLine, setHoveredLine] = useState<number | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<PromptTabId>(defaultPromptTab)
  const [selectedStep, setSelectedStep] = useState<number>(
    defaultWalkthroughLine ?? walkthroughLines[0] ?? 1,
  )

  const stepTabs = promptTabsByStep?.[selectedStep] ?? promptTabs
  const selectedTab = stepTabs?.find((tab) => tab.id === activeTab) ?? stepTabs?.[0] ?? null
  const lines = selectedTab?.lines ?? demoCode
  const shownFileName = selectedTab?.fileName ?? fileName
  const copyValue =
    selectedTab?.copyValue ??
    onCopyValue ??
    lines
      .map((line) => {
        if (line.type === 'comment') return line.text
        if (line.type === 'empty') return ''
        return line.tokens.map((token) => token.text).join('')
      })
      .join('\n')
  const highlightLine = promptTabsByStep ? selectedStep : hoveredLine
  const usesStepPrompts = Boolean(promptTabsByStep)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue)
      setIsCopied(true)
      window.setTimeout(() => setIsCopied(false), 2000)
    } catch {
      setIsCopied(false)
    }
  }

  return (
    <section className="flex min-h-screen items-center justify-center border-b border-zinc-800/50 p-6 md:p-12">
      <div className="grid w-full max-w-4xl grid-cols-1 items-center gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-5">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">
              <Terminal className="h-3.5 w-3.5" />
              <span>{badge}</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              {heroTitle}
            </h1>
            <p className="text-sm leading-relaxed text-zinc-400 md:text-base">{heroDescription}</p>
          </div>

          <div className="space-y-3">
            <p className="mb-4 text-xs font-medium tracking-wider text-zinc-500 uppercase">
              {walkthroughLabel}
            </p>
            {walkthroughLines.map((lineNum) => {
              const isSelected = highlightLine === lineNum
              return (
              <button
                key={lineNum}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  if (usesStepPrompts) {
                    setSelectedStep(lineNum)
                    setIsCopied(false)
                  } else {
                    setHoveredLine(lineNum)
                  }
                }}
                onMouseEnter={() => {
                  if (!usesStepPrompts) setHoveredLine(lineNum)
                }}
                onMouseLeave={() => {
                  if (!usesStepPrompts) setHoveredLine(null)
                }}
                className={`group w-full rounded-xl border p-4 text-left transition-all duration-300 ${
                  isSelected
                    ? 'border-zinc-700 bg-zinc-900/80 shadow-lg shadow-black/50'
                    : 'border-transparent bg-transparent hover:border-zinc-800 hover:bg-zinc-900/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition-colors ${
                      isSelected
                        ? 'border-rose-500 text-rose-400'
                        : 'border-zinc-700 text-zinc-500'
                    }`}
                  >
                    {lineNum}
                  </div>
                  <p
                    className={`text-sm transition-colors ${
                      isSelected ? 'text-zinc-200' : 'text-zinc-500'
                    }`}
                  >
                    {explanations[lineNum]}
                  </p>
                </div>
              </button>
              )
            })}
          </div>
        </div>

        <div className="group relative lg:col-span-7">
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-b from-zinc-800 to-zinc-900 opacity-30 blur transition duration-1000 group-hover:opacity-50" />
          <div className="relative overflow-hidden rounded-xl border border-zinc-800/80 bg-[#0d0d0f] shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 bg-[#111115] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-zinc-700/50" />
                  <div className="h-2.5 w-2.5 rounded-full bg-zinc-700/50" />
                  <div className="h-2.5 w-2.5 rounded-full bg-zinc-700/50" />
                </div>
                <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/50 px-2 py-1 font-mono text-xs text-zinc-400">
                  <FileCode2 className="h-3.5 w-3.5 text-zinc-500" />
                  {shownFileName}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {stepTabs && stepTabs.length > 0 ? (
                  <div
                    role="tablist"
                    aria-label="Prompt variant"
                    className="flex items-center gap-0.5 rounded-md border border-zinc-800 bg-zinc-900/60 p-0.5"
                  >
                    {PROMPT_TAB_ORDER.map((tabId) => {
                      const tab = stepTabs?.find((item) => item.id === tabId)
                      if (!tab) return null
                      const selected = selectedTab?.id === tab.id
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          onClick={() => {
                            setActiveTab(tab.id)
                            setIsCopied(false)
                          }}
                          className={`rounded px-1.5 py-1 text-[10px] font-medium tracking-wide transition-colors ${
                            selected
                              ? 'bg-zinc-800 text-zinc-100'
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {tab.label}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="p-1 text-zinc-500 transition-colors hover:text-zinc-300"
                  aria-label="Copy prompt"
                >
                  {isCopied ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="relative max-h-[28rem] overflow-auto p-4 font-mono text-sm leading-loose">
              {lines.map((line, idx) => {
                const isActive = !usesStepPrompts && hoveredLine === line.num
                const isDimmed = !usesStepPrompts && hoveredLine !== null && hoveredLine !== line.num
                return (
                  <motion.div
                    key={`${line.num}-${idx}`}
                    animate={{ opacity: isDimmed ? 0.3 : 1 }}
                    transition={{ duration: 0.2 }}
                    className="group/line relative flex"
                  >
                    <AnimatePresence>
                      {isActive ? (
                        <motion.div
                          layoutId="active-line-bg"
                          className="pointer-events-none absolute inset-y-0 -inset-x-4 border-l-2 border-rose-400 bg-zinc-800/40"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        />
                      ) : null}
                    </AnimatePresence>
                    <span className="relative z-10 w-8 flex-shrink-0 pr-4 text-right text-zinc-600 select-none">
                      {line.num}
                    </span>
                    <span className={`relative z-10 whitespace-pre ${line.type === 'code' && line.indent ? 'pl-4' : ''}`}>
                      {line.type === 'comment' ? (
                        <span className="text-zinc-500">{line.text}</span>
                      ) : null}
                      {line.type === 'code'
                        ? line.tokens.map((token, tokenIdx) => (
                            <span key={tokenIdx} className={token.className}>
                              {token.text}
                            </span>
                          ))
                        : null}
                      {line.type === 'empty' ? <span>{'\u00a0'}</span> : null}
                    </span>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ClaimAndProofFeatures({
  featuresTitle = 'Engineered for constraints.',
  featuresDescription = "We didn't build another component library to save you from writing CSS. We built it to enforce strict boundaries between logic, state, and presentation.",
  features = DEFAULT_FEATURES,
}: DevToolLandingPageProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <section className="flex min-h-screen items-center p-6 md:p-12 lg:p-24">
      <div className="mx-auto w-full max-w-5xl space-y-16">
        <div className="max-w-2xl space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {featuresTitle}
          </h2>
          <p className="leading-relaxed text-zinc-400">{featuresDescription}</p>
        </div>
        <div className="space-y-4">
          {features.map((feature) => (
            <div
              key={feature.id}
              onMouseEnter={() => setHoveredId(feature.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`group relative flex flex-col items-stretch overflow-hidden rounded-2xl border border-zinc-800/80 bg-[#111115] transition-all duration-500 hover:border-zinc-700 hover:bg-[#15151a] md:flex-row ${feature.glow}`}
            >
              <div className="relative z-10 flex flex-1 flex-col justify-center p-6 md:p-8">
                <div className="mb-4 flex items-center gap-4">
                  <div
                    className={`rounded-lg border border-zinc-800/50 bg-zinc-900 p-2 transition-colors duration-300 ${feature.accent}`}
                  >
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-medium text-zinc-100">{feature.title}</h3>
                </div>
                <p className="max-w-md text-sm leading-relaxed text-zinc-400 md:text-base">
                  {feature.description}
                </p>
                {feature.extra}
              </div>
              <div className="relative flex flex-col overflow-hidden border-t border-zinc-800/50 bg-[#0d0d0f] md:w-80 md:border-t-0 md:border-l">
                <div className="flex items-center justify-between border-b border-zinc-800/50 bg-[#111115] px-4 py-2">
                  <span className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
                    {feature.proof.label}
                  </span>
                  <div className="flex gap-1.5 opacity-50 transition-opacity group-hover:opacity-100">
                    <div className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                    <div className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                  </div>
                </div>
                <div className="relative flex flex-1 flex-col justify-center p-4 font-mono text-xs leading-relaxed">
                  <div className="absolute inset-4 flex flex-col justify-center opacity-100 transition-opacity duration-300 group-hover:opacity-0">
                    <div className="mb-3 h-2 w-3/4 rounded bg-zinc-800/50" />
                    <div className="mb-3 h-2 w-1/2 rounded bg-zinc-800/50" />
                    <div className="h-2 w-5/6 rounded bg-zinc-800/50" />
                  </div>
                  <div className="relative z-10 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    {feature.proof.lines.map((line, idx) => (
                      <motion.div
                        key={idx}
                        initial={false}
                        animate={{ color: line.dim ? '#71717a' : '#d4d4d8' }}
                        className="whitespace-pre"
                        style={!line.dim ? { color: accentColor(feature.accent) } : undefined}
                      >
                        {line.text}
                      </motion.div>
                    ))}
                  </div>
                  <AnimatePresence>
                    {hoveredId === feature.id ? (
                      <motion.div
                        initial={{ top: 0, opacity: 0 }}
                        animate={{ top: '100%', opacity: [0, 0.5, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5, ease: 'linear', repeat: Infinity }}
                        className="pointer-events-none absolute right-0 left-0 h-8 bg-gradient-to-b from-transparent to-white/5"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      />
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Component(props: DevToolLandingPageProps) {
  return (
    <div className="bg-[#09090b] font-sans text-zinc-300 selection:bg-rose-500/30">
      {props.header}
      <InteractiveCodeHero {...props} />
      <ClaimAndProofFeatures {...props} />
    </div>
  )
}

export default Component
