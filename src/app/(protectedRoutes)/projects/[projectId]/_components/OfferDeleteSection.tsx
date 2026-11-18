'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteOffer } from '@/actions/offers'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { guardAction } from '@/lib/clientActionErrors'

/** Delete: hides the offer and its links everywhere; orders and payments stay on record. */
export function OfferDeleteSection({ id, typeLabel, disabled }: { id: string; typeLabel: string; disabled?: boolean }) {
  const router = useRouter()
  const [deleting, startDeleting] = useTransition()
  const lower = typeLabel.toLowerCase()

  const remove = () =>
    startDeleting(guardAction(async () => {
      const result = await deleteOffer({ id })
      if (!result.ok) return void toast.error(result.error)
      toast.success(`${typeLabel} deleted`)
      router.replace('/projects')
      router.refresh()
    }))

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-destructive/40 bg-card px-5 py-4">
      <div>
        <h2 className="text-base font-semibold">Delete {lower}</h2>
        <p className="text-sm text-muted-foreground">
          Its links stop working and your AI stops recommending it. Orders and payments stay on record.
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={disabled || deleting}>
            {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {lower}?</AlertDialogTitle>
            <AlertDialogDescription>
              Share, pay and live links will stop working, and it leaves your business page and AI answers. Past
              orders and payments are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
