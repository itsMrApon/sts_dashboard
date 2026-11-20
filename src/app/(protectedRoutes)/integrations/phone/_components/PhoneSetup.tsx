'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from '@/lib/toast'
import { guardAction } from '@/lib/clientActionErrors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { connectPhoneLine, disconnectPhoneLine, listPhoneNumbers, type PhoneSetupStatus } from '@/actions/phone'
import type { TwilioNumber } from '@/lib/phone/twilioApi'
import { PartnerLogo } from '../../_components/PartnerLogos'

type Props = { initialStatus: PhoneSetupStatus }

const TWILIO_CONSOLE = 'https://console.twilio.com'
const TWILIO_BUY_NUMBER = 'https://console.twilio.com/us1/develop/phone-numbers/manage/search'

function Step({ number, title, done, children }: { number: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-3">
        <span
          className={
            done
              ? 'grid size-7 place-items-center rounded-full bg-primary text-sm font-medium text-primary-foreground'
              : 'grid size-7 place-items-center rounded-full border text-sm font-medium'
          }
        >
          {done ? '✓' : number}
        </span>
        <h2 className="font-medium">{title}</h2>
      </div>
      <div className="space-y-3 pl-10 text-sm">{children}</div>
    </section>
  )
}

export function PhoneSetup({ initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [numbers, setNumbers] = useState<TwilioNumber[] | null>(null)
  const [numberSid, setNumberSid] = useState('')
  const [pending, startTransition] = useTransition()
  const line = status.line

  const findNumbers = () =>
    startTransition(
      guardAction(async () => {
        const result = await listPhoneNumbers({ accountSid, authToken })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setNumbers(result.numbers)
        const free = result.numbers.find((number) => !number.trunkSid)
        setNumberSid(free?.sid ?? '')
      }),
    )

  const connect = () =>
    startTransition(
      guardAction(async () => {
        const result = await connectPhoneLine({ accountSid, authToken, numberSid })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setStatus(result.status)
        setAuthToken('')
        setNumbers(null)
        toast.success('Your number is live. Call it to try.')
      }),
    )

  const disconnect = () =>
    startTransition(
      guardAction(async () => {
        const result = await disconnectPhoneLine()
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setStatus((current) => ({ ...current, line: null }))
        toast.success('Phone line disconnected')
      }),
    )

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-10">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/integrations" className="hover:text-foreground">
          Integrations
        </Link>
        <span>/</span>
        <span className="text-foreground">Phone</span>
      </div>

      <header className="flex items-start gap-4">
        <div className="size-12 shrink-0 *:size-12">
          <PartnerLogo kind="twilio" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Phone</h1>
          <p className="text-muted-foreground">
            Your Voice AI answers calls to your own Twilio number, with the same assistant, voice and knowledge as on
            your website. Twilio bills the call minutes to your account.
          </p>
        </div>
      </header>

      {!status.sipReady ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Phone calls aren&apos;t switched on for this app yet. The admin needs to set LIVEKIT_SIP_URI (LiveKit →
          Settings → SIP URI).
        </p>
      ) : null}

      {line ? (
        <Step number={1} title="Your number is live" done>
          <p className="text-2xl font-semibold tracking-wide">{line.phoneNumber}</p>
          {line.voiceReady ? (
            <p className="text-muted-foreground">Call it from your phone to hear your assistant pick up.</p>
          ) : (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              Calls can&apos;t be answered yet: your voice engine is missing a key.{' '}
              <Link href="/ai-agents/config" className="font-medium underline">
                Add it in AI Agents → Config
              </Link>
              .
            </p>
          )}
          <p className="text-muted-foreground">
            The assistant and its style come from{' '}
            <Link href="/services/speak" className="font-medium text-primary underline">
              Services → Voice AI
            </Link>
            . Each call&apos;s transcript is saved with your other voice calls.
          </p>
          <div className="flex justify-end border-t pt-4">
            <Button variant="ghost" size="sm" className="text-destructive" onClick={disconnect} disabled={pending}>
              Disconnect {line.phoneNumber}
            </Button>
          </div>
        </Step>
      ) : (
        <>
          <Step number={1} title="Sign in to Twilio" done={Boolean(numbers)}>
            <p className="text-muted-foreground">
              Copy the Account SID and Auth Token from the home page of the{' '}
              <a href={TWILIO_CONSOLE} target="_blank" rel="noreferrer" className="font-medium text-primary underline">
                Twilio console
              </a>
              .
            </p>
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault()
                findNumbers()
              }}
            >
              <Input
                placeholder="Account SID (AC…)"
                autoComplete="off"
                value={accountSid}
                onChange={(event) => setAccountSid(event.target.value)}
                aria-label="Twilio Account SID"
              />
              <Input
                type="password"
                placeholder="Auth Token"
                autoComplete="off"
                value={authToken}
                onChange={(event) => setAuthToken(event.target.value)}
                aria-label="Twilio Auth Token"
              />
              <div className="flex justify-end">
                <Button type="submit" variant="outline" disabled={pending || !accountSid.trim() || !authToken.trim()}>
                  {pending && !numbers ? 'Looking…' : 'Find my numbers'}
                </Button>
              </div>
            </form>
          </Step>

          <Step number={2} title="Pick the number">
            {!numbers ? (
              <p className="text-muted-foreground">Your Twilio numbers show up here.</p>
            ) : numbers.length === 0 ? (
              <p className="text-muted-foreground">
                This account has no numbers yet.{' '}
                <a href={TWILIO_BUY_NUMBER} target="_blank" rel="noreferrer" className="font-medium text-primary underline">
                  Buy one in Twilio
                </a>
                , then press Find my numbers again.
              </p>
            ) : (
              <>
                <div role="radiogroup" aria-label="Twilio numbers" className="space-y-2">
                  {numbers.map((number) => {
                    const busy = Boolean(number.trunkSid)
                    return (
                      <label
                        key={number.sid}
                        className={
                          busy
                            ? 'flex cursor-not-allowed items-center gap-3 rounded-lg border p-3 opacity-50'
                            : 'flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/10'
                        }
                      >
                        <input
                          type="radio"
                          name="twilio-number"
                          value={number.sid}
                          checked={numberSid === number.sid}
                          disabled={busy}
                          onChange={() => setNumberSid(number.sid)}
                          className="accent-primary"
                        />
                        <span className="font-medium">{number.phoneNumber}</span>
                        <span className="truncate text-muted-foreground">
                          {busy ? 'Already on a SIP trunk' : number.friendlyName !== number.phoneNumber ? number.friendlyName : ''}
                        </span>
                      </label>
                    )
                  })}
                </div>
                <p className="text-muted-foreground">
                  While connected, calls to this number go to your AI instead of its current Twilio call settings.
                  Disconnect any time to put it back.
                </p>
                <div className="flex justify-end">
                  <Button onClick={connect} disabled={pending || !numberSid || !status.sipReady}>
                    {pending ? 'Connecting…' : 'Connect this number'}
                  </Button>
                </div>
              </>
            )}
          </Step>
        </>
      )}
    </div>
  )
}
