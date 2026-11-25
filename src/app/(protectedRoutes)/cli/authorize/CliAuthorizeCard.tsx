'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { decideCliLoginAction } from '@/actions/cli'
import { guardAction } from '@/lib/clientActionErrors'

const CAN_READ = [
  'Your business profile, offers and prices',
  'Your links: business page, booking and order pages',
  'Your social accounts and approved customer reviews',
]

export function CliAuthorizeCard({
  userCode,
  found,
  clientLabel: initialLabel,
  deviceName,
}: {
  userCode: string | null
  found: boolean
  clientLabel: string
  deviceName: string | null
}) {
  const [state, setState] = useState<'ask' | 'approved' | 'denied'>('ask')
  // The page re-renders after the decision (the request is no longer pending); keep the first label.
  const [clientLabel] = useState(initialLabel)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function decide(approve: boolean) {
    if (!userCode) return
    setError(null)
    startTransition(
      guardAction(async () => {
        const res = await decideCliLoginAction({ userCode, approve })
        if (!res.ok) {
          setError(res.error)
          return
        }
        setState(approve ? 'approved' : 'denied')
      }),
    )
  }

  if (state !== 'ask') {
    return (
      <section className="w-full max-w-md space-y-3 rounded-xl border border-border p-6 text-center">
        <h1 className="text-lg font-semibold">{state === 'approved' ? 'Connected' : 'Refused'}</h1>
        <p className="text-muted-foreground text-sm">
          {state === 'approved'
            ? `Go back to your terminal. ${clientLabel} can now read your business brain.`
            : 'Nothing was connected. You can close this page.'}
        </p>
        <Link href="/social" className="text-sm underline">
          Open Social
        </Link>
      </section>
    )
  }

  if (!userCode || !found) {
    return (
      <section className="w-full max-w-md space-y-3 rounded-xl border border-border p-6">
        <h1 className="text-lg font-semibold">This code isn’t valid any more</h1>
        <p className="text-muted-foreground text-sm">
          Codes last 10 minutes and work once. Run the command again in your project folder:
        </p>
        <code className="bg-muted block rounded-md px-3 py-2 font-mono text-xs">npx --yes @sts-ai/cli@1.0 init --client claude --write</code>
      </section>
    )
  }

  return (
    <section className="w-full max-w-md space-y-5 rounded-xl border border-border p-6">
      <div className="space-y-1">
        <p className="text-primary text-xs font-medium tracking-widest uppercase">sts-ai CLI</p>
        <h1 className="text-lg font-semibold">Connect {clientLabel}?</h1>
        <p className="text-muted-foreground text-sm">
          {deviceName ? `On ${deviceName}. ` : ''}Check that your terminal shows this code:
        </p>
      </div>
      <div className="bg-muted rounded-lg py-3 text-center font-mono text-2xl font-semibold tracking-[0.2em]">{userCode}</div>
      <div>
        <p className="mb-2 text-sm font-medium">It will be able to read:</p>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
          {CAN_READ.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-2 text-xs">
          It can’t change anything, see payments or customers’ contact details. Disconnect it any time in Social.
        </p>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" disabled={pending} onClick={() => decide(false)}>
          Refuse
        </Button>
        <Button className="flex-1" disabled={pending} onClick={() => decide(true)}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Approve
        </Button>
      </div>
    </section>
  )
}
