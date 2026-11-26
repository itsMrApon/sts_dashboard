'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { decideCliLoginAction } from '@/actions/cli'
import { guardAction } from '@/lib/clientActionErrors'

const CAN_READ = [
  'Read your business: profile, offers, prices, links, reviews and answers',
  'Use the Social library, your partner apps (n8n, Medusa, ERPNext, OpenSEO) and your leads',
  'Set up your website: make its key and turn Chat, Voice or Form on or off',
  'Write answers, your description and message drafts (you always click Send)',
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
            ? `Go back to your terminal. ${clientLabel} is connected; changes it asks for will wait in Lead → Approval.`
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
        <code className="bg-muted block rounded-md px-3 py-2 font-mono text-xs">npx @sts-ai/cli init</code>
      </section>
    )
  }

  return (
    <section className="w-full max-w-md space-y-5 rounded-xl border border-border p-6">
      <div className="space-y-1">
        <p className="text-primary text-xs font-medium tracking-widest uppercase">sts-ai CLI</p>
        <h1 className="text-lg font-semibold">Connect this computer?</h1>
        <p className="text-muted-foreground text-sm">
          {deviceName ? `On ${deviceName}. ` : ''}Check that your terminal shows this code:
        </p>
      </div>
      <div className="bg-muted rounded-lg py-3 text-center font-mono text-2xl font-semibold tracking-[0.2em]">{userCode}</div>
      <div>
        <p className="mb-2 text-sm font-medium">It will be able to:</p>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
          {CAN_READ.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-2 text-xs">
          For {clientLabel} and the website set up from this computer. New connections and n8n imports wait for
          you in Lead → Approval. It never sees payments or customers’ contact details. Disconnect it any time with{' '}
          <code className="font-mono">npx @sts-ai/cli logout</code>.
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
