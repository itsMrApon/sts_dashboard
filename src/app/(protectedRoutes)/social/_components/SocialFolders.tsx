'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import Riffle from '@/components/ui/hairline-riffle'
import { SocialDiagram } from '@/components/social/SocialDiagram'
import { diagramThemeClass } from '@/components/social/fonts'
import { countByKind, KIND_HINT, KIND_LABEL, SEGMENT_LABEL, SOCIAL_LIBRARY, type KindSegment } from '@/lib/social/library'
import { useSocialSaves } from '../_lib/useSocialPrefs'
import { CliCommand } from './CliCommand'
import type { ConnectedAgent } from './ConnectedAgents'

/** The tray holds six folders, front first. */
const FOLDERS = ['skills', 'prompts', 'workflows', 'plugins', 'reports', 'saved'] as const satisfies readonly KindSegment[]
type Folder = (typeof FOLDERS)[number]

const KIND_OF: Record<Exclude<Folder, 'saved'>, keyof typeof KIND_HINT> = {
  skills: 'skill',
  prompts: 'prompt',
  workflows: 'workflow',
  plugins: 'plugin',
  reports: 'report',
}

const FEATURED = ['plugin-sts-brain', 'prompt-ugc-ad-higgsfield', 'skill-short-form-edit'] as const

/**
 * /social: the same folder tray as Lead → Intel. Each folder opens its part of the library;
 * under it, the one command that connects the creator's agent, and three cards to start with.
 */
export function SocialFolders({ agents }: { agents: ConnectedAgent[] }) {
  const router = useRouter()
  const { ids: saved } = useSocialSaves()
  const [pulled, setPulled] = useState<Folder | null>(null)
  const counts = countByKind()

  const count = (folder: Folder) => (folder === 'saved' ? saved.length : counts[KIND_OF[folder]])
  const hint = (folder: Folder) => (folder === 'saved' ? 'the cards you saved on this device' : KIND_HINT[KIND_OF[folder]])
  const open = (folder: Folder) => router.push(`/social/${folder}`)
  const featured = FEATURED.map((id) => SOCIAL_LIBRARY.find((item) => item.id === id)).filter((item) => item !== undefined)

  return (
    <div className="flex flex-col items-center pb-10">
      <div className="flex w-full max-w-xl flex-col items-center">
        <Riffle
          aria-label="The Social library, as folders. Hover or use the arrow keys to pull one, then click or press Enter to open it."
          labels={FOLDERS.map((f) => SEGMENT_LABEL[f])}
          className="text-foreground w-full max-w-md"
          onRead={(text) => {
            const n = Number(text)
            setPulled(Number.isInteger(n) && n >= 1 ? (FOLDERS[n - 1] ?? null) : null)
          }}
          onPick={(card) => {
            const folder = FOLDERS[card - 1]
            if (folder) open(folder)
          }}
        />

        <p className="text-muted-foreground -mt-2 min-h-5 text-center text-sm" aria-hidden="true">
          {pulled ? (
            <>
              <span className="text-foreground font-medium">{SEGMENT_LABEL[pulled]}</span> · {count(pulled)} · {hint(pulled)}
            </>
          ) : (
            `Pull a folder: ${SOCIAL_LIBRARY.length} cards your agent can build from`
          )}
        </p>

        {/* The same folders as buttons, for touch and keyboard. */}
        <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Library sections">
          {FOLDERS.map((folder) => (
            <li key={folder}>
              <Link
                href={`/social/${folder}`}
                onMouseEnter={() => setPulled(folder)}
                className={cn(
                  'border-border bg-background hover:bg-muted inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                  'focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
                  pulled === folder && 'border-foreground/40',
                )}
              >
                {SEGMENT_LABEL[folder]}
                <span className="text-muted-foreground text-xs tabular-nums">{count(folder)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <CliCommand className="mt-9 max-w-2xl" agents={agents} />

      <div className="mt-9 w-full max-w-5xl">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Start here</h2>
          <Link href="/social/all" className="text-muted-foreground hover:text-foreground text-xs">
            See all {SOCIAL_LIBRARY.length}
          </Link>
        </div>
        <ul className="grid gap-5 sm:grid-cols-3">
          {featured.map((item) => (
            <li key={item.id}>
              <Link href={`/social/all?item=${item.id}`} className="group block space-y-2 focus-visible:outline-none">
                <div
                  className={cn(
                    diagramThemeClass,
                    'aspect-[16/10] overflow-hidden rounded-lg border border-border transition-colors group-hover:border-ring group-focus-visible:ring-[3px] group-focus-visible:ring-ring/40',
                  )}
                >
                  <SocialDiagram diagram={item.diagram} uid={`featured-${item.id}`} title={item.title} caption={KIND_LABEL[item.kind]} className="h-full w-full" />
                </div>
                <div className="px-0.5">
                  <div className="truncate text-sm font-medium">{item.title}</div>
                  <div className="text-muted-foreground truncate text-xs">{item.summary}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
