'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteBusiness } from '@/actions/business'
import { cn } from '@/lib/utils'

export type BusinessChip = { id: string; name: string }

type Props = {
  businesses: BusinessChip[]
  activeBusinessId: string | null
  /** Oldest / default business id for clean URL when selected */
  defaultBusinessId: string | null
}

export const BusinessSwitcher = ({
  businesses,
  activeBusinessId,
  defaultBusinessId,
}: Props) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (businesses.length === 0) return null

  const hrefFor = (id: string) =>
    defaultBusinessId && id === defaultBusinessId
      ? '/tenants/business-profile'
      : `/tenants/business-profile?businessId=${id}`

  const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (
      !confirm(
        `Delete “${name}”? Outreach channels and tenant links for this business will be unlinked or removed.`,
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await deleteBusiness(id)
      if (!result.ok) {
        alert(result.error)
        return
      }
      const remaining = businesses.filter((b) => b.id !== id)
      if (remaining.length === 0) {
        router.push('/tenants/business-profile')
      } else if (activeBusinessId === id) {
        const next = remaining[0]
        router.push(hrefFor(next.id))
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap gap-2 items-center text-sm">
      <span className="text-muted-foreground">Business:</span>
      {businesses.map((b) => {
        const active = b.id === activeBusinessId
        return (
          <div
            key={b.id}
            className={cn(
              'inline-flex items-stretch rounded-md border overflow-hidden',
              active ? 'border-primary bg-primary/10' : 'border-border bg-card',
            )}
          >
            <Link
              href={hrefFor(b.id)}
              className={cn(
                'px-3 py-1.5 text-sm flex items-center max-w-[200px] truncate',
                'hover:bg-muted/80',
              )}
            >
              {b.name}
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isPending}
              className="h-auto w-8 min-w-8 rounded-none border-l border-border shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              aria-label={`Delete ${b.name}`}
              onClick={(e) => handleDelete(e, b.id, b.name)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
