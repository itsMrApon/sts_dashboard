'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardPaste,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { removeProviderKey, saveProviderKey, testProviderKey } from '@/actions/voiceCredentials'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type {
  ConfigProviderItem,
  ProviderKeyCheck,
  ProviderKeyStatus,
} from '@/lib/usage/configProviders'
import { cn } from '@/lib/utils'
import { capabilityLabel, ProviderTile, StatusPill, relativeTime } from './providerUi'
import { guardAction } from '@/lib/clientActionErrors'

type CheckState = { check: ProviderKeyCheck; subject: 'candidate' | 'current' } | null

function CheckResult({ state }: { state: NonNullable<CheckState> }) {
  const { check } = state
  return (
    <div
      role="status"
      className={cn(
        'rounded-lg border p-3 text-xs',
        check.valid
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-rose-500/30 bg-rose-500/10 text-rose-300',
      )}
    >
      <p className="flex items-center gap-1.5 font-medium">
        {check.valid ? <CheckCircle2 className="size-3.5" aria-hidden /> : <XCircle className="size-3.5" aria-hidden />}
        {state.subject === 'candidate' ? 'Pasted key: ' : 'Current key: '}
        {check.message}
      </p>
      {check.details?.length ? (
        <ul className="mt-1.5 space-y-0.5 pl-5 text-[11px] opacity-90">
          {check.details.map((detail) => (
            <li key={detail} className="list-disc">
              {detail}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function ProviderKeySheet({
  provider,
  status,
  usedFor,
  open,
  onOpenChange,
  onChanged,
}: {
  provider: ConfigProviderItem | null
  status: ProviderKeyStatus | null
  usedFor: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => Promise<void>
}) {
  const [keyValue, setKeyValue] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [checkState, setCheckState] = useState<CheckState>(null)
  const [rejectedSave, setRejectedSave] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [busy, setBusy] = useState<'test' | 'save' | 'retest' | 'remove' | null>(null)
  const [, startTransition] = useTransition()

  // Reset local state whenever a different provider opens.
  useEffect(() => {
    setKeyValue('')
    setRevealed(false)
    setCheckState(null)
    setRejectedSave(false)
    setConfirmRemove(false)
  }, [provider?.id])

  if (!provider || !status) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-md" />
      </Sheet>
    )
  }

  const trimmed = keyValue.trim()
  const prefixMismatch = Boolean(provider.keyPrefix && trimmed && !trimmed.startsWith(provider.keyPrefix))
  const verifiedAgo = relativeTime(status.validatedAt)

  const run = (kind: NonNullable<typeof busy>, task: () => Promise<void>) => {
    setBusy(kind)
    startTransition(guardAction(async () => {
      try {
        await task()
      } finally {
        setBusy(null)
      }
    }))
  }

  const testCandidate = () =>
    run('test', async () => {
      const res = await testProviderKey(provider.id, trimmed)
      if (!res.ok) return void toast.error(res.error)
      setCheckState({ check: res.check, subject: 'candidate' })
    })

  const save = (force: boolean) =>
    run('save', async () => {
      const res = await saveProviderKey({ provider: provider.id, apiKey: trimmed, force })
      if (!res.ok) return void toast.error(res.error)
      setCheckState({ check: res.check, subject: 'candidate' })
      if (!res.saved) {
        setRejectedSave(true)
        return
      }
      setRejectedSave(false)
      setKeyValue('')
      setRevealed(false)
      toast.success(res.check.valid ? `${provider.name} key saved and verified.` : `${provider.name} key saved.`)
      await onChanged()
    })

  const retest = () =>
    run('retest', async () => {
      const res = await testProviderKey(provider.id)
      if (!res.ok) return void toast.error(res.error)
      setCheckState({ check: res.check, subject: 'current' })
      await onChanged()
    })

  const remove = () =>
    run('remove', async () => {
      const res = await removeProviderKey(provider.id)
      if (!res.ok) return void toast.error(res.error)
      setConfirmRemove(false)
      setCheckState(null)
      toast.success(`${provider.name} key removed.`)
      await onChanged()
    })

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) {
        setKeyValue(text.trim())
        setCheckState(null)
        setRejectedSave(false)
      }
    } catch {
      toast.error('Clipboard access was blocked. Paste with ⌘V instead.')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b border-border p-5">
          <div className="flex items-center gap-3 pr-6">
            <ProviderTile provider={provider} size="lg" />
            <div className="min-w-0">
              <SheetTitle className="text-base">{provider.name}</SheetTitle>
              <SheetDescription className="text-xs">{capabilityLabel(provider)}</SheetDescription>
            </div>
            <StatusPill status={status} className="ml-auto" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{provider.tagline}</p>
        </SheetHeader>

        <div className="space-y-6 p-5">
          <section className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Key in use</h3>
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              {status.hasKey ? (
                <>
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-4 text-muted-foreground" aria-hidden />
                    <code className="font-mono text-sm tracking-wide">{status.masked}</code>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {`Saved here, encrypted.${verifiedAgo ? ` Verified ${verifiedAgo}.` : ' Not verified yet.'}`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={retest} disabled={busy !== null}>
                      {busy === 'retest' ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                      Test again
                    </Button>
                    {status.source === 'database' ? (
                      confirmRemove ? (
                        <>
                          <Button size="sm" variant="destructive" onClick={remove} disabled={busy !== null}>
                            {busy === 'remove' ? <Loader2 className="animate-spin" /> : <Trash2 />}
                            Yes, remove it
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)} disabled={busy !== null}>
                            Keep it
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-rose-400"
                          onClick={() => setConfirmRemove(true)}
                          disabled={busy !== null}
                        >
                          <Trash2 />
                          Remove saved key
                        </Button>
                      )
                    ) : null}
                  </div>
                  {confirmRemove ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Anything that uses {provider.name} stops working until you add a key again.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No key saved. Anything that uses {provider.name} will fail until you add your own key below.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="provider-api-key" className="text-xs font-medium text-muted-foreground">
                {status.source === 'database' ? 'Replace key' : 'Add key'}
              </Label>
              <a
                href={provider.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
              >
                Get a {provider.name} key
                <ArrowUpRight className="size-3" aria-hidden />
              </a>
            </div>
            <InputGroup>
              <InputGroupInput
                id="provider-api-key"
                type={revealed ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                placeholder={provider.placeholder}
                className="font-mono"
                value={keyValue}
                onChange={(event) => {
                  setKeyValue(event.target.value)
                  setCheckState(null)
                  setRejectedSave(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && trimmed && busy === null) save(false)
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label={revealed ? 'Hide key' : 'Show key'}
                  onClick={() => setRevealed((value) => !value)}
                >
                  {revealed ? <EyeOff /> : <Eye />}
                </InputGroupButton>
                <InputGroupButton size="icon-xs" aria-label="Paste from clipboard" onClick={() => void paste()}>
                  <ClipboardPaste />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {prefixMismatch ? (
              <p className="text-[11px] text-amber-400">
                {provider.name} keys usually start with <code className="font-mono">{provider.keyPrefix}</code>. Test it
                to be sure.
              </p>
            ) : null}

            {checkState ? <CheckResult state={checkState} /> : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={testCandidate} disabled={!trimmed || busy !== null}>
                {busy === 'test' ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                Test key
              </Button>
              {rejectedSave ? (
                <Button size="sm" variant="destructive" onClick={() => save(true)} disabled={!trimmed || busy !== null}>
                  {busy === 'save' ? <Loader2 className="animate-spin" /> : null}
                  Save anyway
                </Button>
              ) : (
                <Button size="sm" onClick={() => save(false)} disabled={!trimmed || busy !== null}>
                  {busy === 'save' ? <Loader2 className="animate-spin" /> : null}
                  {busy === 'save' ? 'Checking…' : 'Verify & save'}
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Saving checks the key with {provider.name} first. Keys are encrypted and never shown in full again.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Powers</h3>
            <ul className="space-y-1.5">
              {usedFor.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
