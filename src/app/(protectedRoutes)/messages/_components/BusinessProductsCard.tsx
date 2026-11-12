'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { setBusinessProducts } from '@/actions/services'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Project = { id: string; title: string; kind: 'PROJECT' | 'PRODUCT' }

/** Projects / products the AI can recommend (links appear in chat replies). */
export function BusinessProductsCard({ projects, linkedIds }: { projects: Project[]; linkedIds: string[] }) {
  const [selected, setSelected] = useState<string[]>(linkedIds)
  const [isPending, startTransition] = useTransition()
  const dirty = [...selected].sort().join() !== [...linkedIds].sort().join()

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))

  const save = () =>
    startTransition(async () => {
      const result = await setBusinessProducts(selected)
      if (result.ok) toast.success('Products updated')
      else toast.error(result.error)
    })

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Products & projects</h2>
          <p className="text-xs text-muted-foreground">Your AI can recommend these and share their links.</p>
        </div>
        <Button size="sm" onClick={save} disabled={!dirty || isPending}>
          {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Save
        </Button>
      </div>
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No projects yet.{' '}
          <Link href="/projects" className="text-primary underline-offset-4 hover:underline">
            Create one in Projects
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => toggle(project.id)}
              aria-pressed={selected.includes(project.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs',
                selected.includes(project.id) ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/60',
              )}
            >
              {project.title}
              <span className="ml-1 text-muted-foreground">· {project.kind === 'PRODUCT' ? 'Product' : 'Project'}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
