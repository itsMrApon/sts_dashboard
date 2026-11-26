'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import Riffle from '@/components/ui/hairline-riffle'
import { countByKind, KIND_HINT, SEGMENT_LABEL, SOCIAL_LIBRARY, type KindSegment } from '@/lib/social/library'
import { useSocialSaves } from '../_lib/useSocialPrefs'

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

/** /social: the same folder tray as /lead, and nothing else. Each folder opens its part of the library. */
export function SocialFolders() {
  const router = useRouter()
  const { ids: saved } = useSocialSaves()
  const [pulled, setPulled] = useState<Folder | null>(null)
  const counts = countByKind()

  const count = (folder: Folder) => (folder === 'saved' ? saved.length : counts[KIND_OF[folder]])
  const hint = (folder: Folder) => (folder === 'saved' ? 'the cards you saved on this device' : KIND_HINT[KIND_OF[folder]])
  const open = (folder: Folder) => router.push(`/social/${folder}`)

  return (
    <div className="flex h-full min-h-0 flex-col items-center overflow-y-auto overscroll-contain pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-full max-w-xl flex-col items-center">
        <Riffle
          aria-label="The Social library, as folders. Hover or use the arrow keys to pull one, then click or press Enter to open it."
          labels={FOLDERS.map((f) => SEGMENT_LABEL[f])}
          className="text-foreground w-full max-w-[min(28rem,50dvh)]"
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
    </div>
  )
}
