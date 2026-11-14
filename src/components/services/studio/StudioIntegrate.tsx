'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Check, Copy, ExternalLink, Globe2, KeyRound, Link2, Terminal } from 'lucide-react'
import { toast } from 'sonner'
import { EmbedSetupCard } from '@/components/services/EmbedSetupCard'
import { cn } from '@/lib/utils'
import { StudioWindow } from './StudioPrimitives'

export type IntegrateProps = {
  serviceName: string
  roomName: string
  /** The service's component for the creator's site (step 3). */
  snippet: string
  /** File name shown above the snippet, e.g. "components/ChatPopup.tsx". */
  snippetFile: string
  /** The hosted page anyone can open without a website. */
  hostedHref?: string
  /** Shown when the service is off, so the SDK would refuse it. */
  offNotice?: string | null
  extra?: ReactNode
}

type Step = { id: 1 | 2 | 3; title: string; body: string; file: string; code: string }

function CodeLines({ code }: { code: string }) {
  const lines = code.split('\n')
  return (
    <div className="max-h-[460px] overflow-auto py-3 font-mono text-[12px] leading-6">
      {lines.map((line, index) => (
        <div key={index} className="flex px-3">
          <span className="w-8 shrink-0 select-none pr-3 text-right text-muted-foreground/50">{index + 1}</span>
          <span
            className={cn(
              'whitespace-pre',
              line.trim().startsWith('//') || line.trim().startsWith('#') ? 'text-muted-foreground' : 'text-foreground/90',
            )}
          >
            {line || ' '}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Integrate tab: a 3-step walkthrough with the code for each step, plus the site key and hosted link. */
export function StudioIntegrate({ serviceName, roomName, snippet, snippetFile, hostedHref, offNotice, extra }: IntegrateProps) {
  const [active, setActive] = useState<Step['id']>(3)
  const [copied, setCopied] = useState(false)
  const origin = typeof window === 'undefined' ? 'https://your-sts-ai.com' : window.location.origin

  const steps: Step[] = useMemo(
    () => [
      {
        id: 1,
        title: 'Allow your website and copy the site key',
        body: 'One key covers every service. It only works on the website you allow below.',
        file: '.env.local',
        code: `# Your website's environment (never commit the key)\nNEXT_PUBLIC_STS_AI_URL=${origin}\nNEXT_PUBLIC_STS_SITE_KEY=sts_pk_live_...`,
      },
      {
        id: 2,
        title: 'Install the SDK and wrap your site once',
        body: 'npm install @sts-ai/sdk, then add the provider to your root layout.',
        file: 'app/layout.tsx',
        code: `// npm install @sts-ai/sdk\nimport { StsProvider } from '@sts-ai/sdk/react'\n\nexport default function RootLayout({ children }) {\n  return (\n    <StsProvider\n      apiBase={process.env.NEXT_PUBLIC_STS_AI_URL!}\n      siteKey={process.env.NEXT_PUBLIC_STS_SITE_KEY!}\n    >\n      {children}\n    </StsProvider>\n  )\n}`,
      },
      {
        id: 3,
        title: `Add ${serviceName} where you want it`,
        body: 'Headless: the hook gives state and actions, your designer builds the look.',
        file: snippetFile,
        code: snippet,
      },
    ],
    [origin, serviceName, snippet, snippetFile],
  )
  const step = steps.find((item) => item.id === active) ?? steps[2]

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${label} copied`)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy')
    }
  }
  const hostedUrl = hostedHref ? `${origin}${hostedHref}` : null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-5">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Terminal className="h-3.5 w-3.5" aria-hidden />
              {serviceName} · SDK
            </span>
            <h2 className="text-2xl font-semibold tracking-tight">Your design, our AI.</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Three steps for your website developer. Pick a step to see its code, copy it, done. No website? Share the
              hosted page below.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Walkthrough</p>
            {steps.map((item) => {
              const selected = item.id === active
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setActive(item.id)
                    setCopied(false)
                  }}
                  className={cn(
                    'w-full rounded-xl border p-4 text-left transition-all',
                    selected ? 'border-border bg-card shadow-lg shadow-black/5' : 'border-transparent hover:border-border/70 hover:bg-muted/30',
                  )}
                >
                  <span className="flex items-start gap-3">
                    <span
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]',
                        selected ? 'border-rose-500 text-rose-500' : 'border-border text-muted-foreground',
                      )}
                    >
                      {item.id}
                    </span>
                    <span>
                      <span className={cn('block text-sm font-medium', !selected && 'text-muted-foreground')}>{item.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{item.body}</span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <StudioWindow
          className="xl:col-span-7"
          title={step.file}
          actions={
            <button
              type="button"
              onClick={() => void copy(step.code, step.file)}
              aria-label={`Copy ${step.file}`}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          }
        >
          <CodeLines code={step.code} />
        </StudioWindow>
      </div>

      {offNotice ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">{offNotice}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-lg border border-border/60 bg-muted/60 p-2 text-amber-600 dark:text-amber-400">
              <KeyRound className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h3 className="text-base font-medium">Site key</h3>
              <p className="text-sm text-muted-foreground">Step 1: the website allowed to use your services.</p>
            </div>
          </div>
          <EmbedSetupCard roomName={roomName} keyOnly />
        </div>

        {hostedUrl ? (
          <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-lg border border-border/60 bg-muted/60 p-2 text-emerald-600 dark:text-emerald-400">
                <Globe2 className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h3 className="text-base font-medium">Hosted page</h3>
                <p className="text-sm text-muted-foreground">No website needed. Share it in bios, ads or WhatsApp.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-xs">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{hostedUrl}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copy(hostedUrl, 'Link')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Copy link
              </button>
              <a
                href={hostedHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted/60"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Open
              </a>
            </div>
          </div>
        ) : null}
      </div>
      {extra}
    </div>
  )
}
