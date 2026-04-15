'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { Tenant, Business } from '@prisma/client'
import { X } from 'lucide-react'
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

type TenantWithBiz = Tenant & { business: Pick<Business, 'id' | 'name'> | null }

type Props = {
  tenant: TenantWithBiz
}

export const TenantCard = ({ tenant }: Props) => {
  const router = useRouter()
  const [removeOpen, setRemoveOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteTenant(tenant.id)
      if (!result.success) {
        toast.error(result.error || 'Could not delete tenant')
        return
      }
      setRemoveOpen(false)
      toast.success('Tenant deleted')
      router.refresh()
    })
  }

  return (
    <div className="relative border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-9 w-9 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="Delete tenant"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setRemoveOpen(true)
        }}
      >
        <X className="h-4 w-4" aria-hidden />
      </Button>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this tenant?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{tenant.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={isPending} onClick={() => handleDelete()}>
              {isPending ? 'Deleting…' : 'Delete tenant'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-primary truncate">{tenant.name}</p>
      </div>
      {tenant.business && (
        <p className="text-xs text-muted-foreground">Business: {tenant.business.name}</p>
      )}
      <Button variant="outline" size="sm" className="w-fit" onClick={() => router.push(`/tenants/${tenant.id}`)}>
        View
      </Button>
    </div>
  )
}
