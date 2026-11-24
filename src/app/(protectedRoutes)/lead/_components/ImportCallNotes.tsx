'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { guardAction } from '@/lib/clientActionErrors'
import { importLeadCallNotes } from '@/actions/callIntel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const today = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * "Import call notes": for calls recorded without a bot. Drop a Yogurt (or Granola, Otter…)
 * Markdown export, or type what was said. The call is saved on the lead and reviewed against the
 * business straight away.
 */
export function ImportCallNotes({ leadId, businessName }: { leadId: string; businessName: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [date, setDate] = useState(today)
  const [dragging, setDragging] = useState(false)
  const [pending, startTransition] = useTransition()

  const readFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 2_000_000) {
      toast.error('That file is too big. Export the summary instead.')
      return
    }
    setText(await file.text())
    setFileName(file.name)
  }

  const reset = () => {
    setText('')
    setFileName(null)
    setDate(today())
  }

  const submit = () =>
    startTransition(
      guardAction(async () => {
        const result = await importLeadCallNotes({ leadId, text, date })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        if (result.data?.reviewError) toast.error(`Call added, but not reviewed: ${result.data.reviewError}`)
        else toast.success('Call added and reviewed')
        setOpen(false)
        reset()
        router.refresh()
      }),
    )

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Import call notes
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return
          setOpen(next)
        }}
      >
        <DialogContent
          className={cn(
            'gap-0 overflow-hidden p-0 sm:max-w-xl',
            dragging && 'ring-2 ring-violet-400/60',
          )}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            void readFile(event.dataTransfer.files?.[0])
          }}
        >
          <DialogTitle className="px-5 pt-5 font-mono text-[10px] font-normal tracking-[0.18em] text-muted-foreground uppercase">
            New call
          </DialogTitle>
          <DialogDescription className="sr-only">
            Type what was said on the call, or drop a Yogurt export. It is reviewed against {businessName}.
          </DialogDescription>

          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type what was said, or drop a Yogurt export here."
            aria-label="Call notes"
            autoFocus
            className="min-h-[42vh] w-full resize-none bg-transparent px-5 py-3 text-base leading-relaxed outline-none placeholder:text-muted-foreground/50 sm:min-h-[300px]"
          />
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            className="hidden"
            onChange={(event) => {
              void readFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />

          <div className="flex items-center gap-4 border-t border-border/60 px-5 py-3 text-sm">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="max-w-[40%] truncate text-muted-foreground hover:text-foreground"
            >
              {fileName ?? 'Open file'}
            </button>
            <input
              type="date"
              value={date}
              max={today()}
              onChange={(event) => setDate(event.target.value)}
              aria-label="Call date"
              className="bg-transparent text-muted-foreground outline-none [color-scheme:dark] hover:text-foreground"
            />
            <div className="ml-auto">
              <Button size="sm" disabled={pending || text.trim().length < 20} onClick={submit}>
                {pending ? 'Reviewing…' : 'Add'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
