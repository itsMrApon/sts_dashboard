'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { Workspace, PublishProfile } from '@prisma/client'
import { useState, useTransition } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deleteTenant } from '@/actions/tenants'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Copy, ExternalLink } from 'lucide-react'

type TenantWithBiz = Workspace & { publishProfile: Pick<PublishProfile, 'id' | 'name'> | null }

type Props = {
  tenant: TenantWithBiz
  roomName?: string | null
}

export const TenantCard = ({ tenant, roomName }: Props) => {
  const router = useRouter()
  const [removeOpen, setRemoveOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteTenant(tenant.id)
      if (!result.success) {
        toast.error(result.error || 'Could not delete workspace')
        return
      }
      setRemoveOpen(false)
      toast.success('Workspace deleted')
      router.refresh()
    })
  }

  const copyText = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1500)
    } catch {
      toast.error('Copy failed')
    }
  }

  const status = String(tenant.contextStatus || 'DRAFT')
  const profileHref = tenant.publishProfileId
    ? `/tenants/publish?tenantId=${tenant.id}`
    : '/messages/publish'
  const publishedLabel = tenant.publishedAt
    ? new Date(tenant.publishedAt).toLocaleString()
    : null

  return (
    <Card className="w-full border-border/70 py-0">
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{tenant.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={isPending} onClick={() => handleDelete()}>
              {isPending ? 'Deleting…' : 'Delete workspace'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CardContent className="space-y-3 px-5 py-4">
        <div className="flex w-full flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-primary">{tenant.name}</p>
          {tenant.publishProfile && (
            <Badge variant="secondary" className="text-[11px]">
              {tenant.publishProfile.name}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={`
              text-[11px]
              ${
                status === 'PUBLISHED'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : status === 'STALE'
                    ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'
                    : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
              }
            `}
          >
            {status}
          </Badge>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href={profileHref}>Edit publish</Link>
            </Button>
            {roomName ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/messages/${encodeURIComponent(roomName)}`}>
                  Website & embed
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete workspace"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setRemoveOpen(true)
              }}
            >
              Delete
            </Button>
          </div>
        </div>

        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
              <span className="shrink-0 font-medium">Workspace ID</span>
            <span className="truncate font-mono">{tenant.id}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto h-6 w-6 shrink-0"
              onClick={() => void copyText(tenant.id, 'tenant')}
            >
              {copiedKey === 'tenant' ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          {tenant.publishProfileId? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
              <span className="shrink-0 font-medium">Publish ID</span>
              <span className="truncate font-mono">{tenant.publishProfileId}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto h-6 w-6 shrink-0"
                onClick={() => void copyText(tenant.publishProfileId!, 'business')}
              >
                {copiedKey === 'business' ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          ) : null}
        </div>

        {status === 'PUBLISHED' && (
          <p className="text-xs text-muted-foreground">
            {tenant.contextVersion ? `Version ${tenant.contextVersion}` : null}
            {tenant.contextVersion && publishedLabel ? ' · ' : null}
            {publishedLabel ? `Published ${publishedLabel}` : null}
            {tenant.compactTokenEstimate ? ` · ~${tenant.compactTokenEstimate} tokens` : null}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
