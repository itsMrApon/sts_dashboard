'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPublishProfile, updatePublishProfile } from '@/actions/publishProfiles'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Check, Loader2 } from 'lucide-react'
import type { BusinessProfilePitchOption } from '../_lib/businessProfileOptions'

type Agent = { id: string; name: string; roomName: string }
type Product = { id: string; title: string; kind: string }

type Props = {
  agents: Agent[]
  products: Product[]
  businessProfiles: BusinessProfilePitchOption[]
  preferredBusinessProfileId?: string
}

export const CreateBusinessModal = ({
  agents,
  products,
  businessProfiles,
  preferredBusinessProfileId,
}: Props) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([])
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  /** Selected publish profile id — pitch comes from that profile's linked workspace */
  const [selectedBusinessProfileId, setSelectedBusinessProfileId] = useState('')

  const resetForm = useCallback(() => {
    setStep(1)
    setError('')
    setName('')
    setDescription('')
    setSelectedAgentIds([])
    setSelectedProductIds([])
    setSelectedBusinessProfileId(preferredBusinessProfileId || '')
  }, [preferredBusinessProfileId])

  useEffect(() => {
    if (!open) return
    if (preferredBusinessProfileId) {
      setSelectedBusinessProfileId(preferredBusinessProfileId)
    }
  }, [open, preferredBusinessProfileId])

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) resetForm()
  }

  const handleSubmit = () => {
    setError('')
    startTransition(async () => {
      const chosen = businessProfiles.find((p) => p.publishProfileId === selectedBusinessProfileId)
      const pitchTenantId = chosen?.pitchTenantId
      if (selectedBusinessProfileId && !pitchTenantId) {
        setError('That publish profile has no pitch yet. Add one under Workspaces.')
        return
      }

      if (businessProfiles.length > 0) {
        if (!chosen) {
          setError('Select a Publish Profile. Rooms no longer auto-create new profiles.')
          return
        }
        const updateResult = await updatePublishProfile(chosen.publishProfileId, {
          agentIds: selectedAgentIds,
          productIds: selectedProductIds,
          primaryAgentId: selectedAgentIds[0],
          primaryProductId: selectedProductIds[0],
          tenantId: pitchTenantId || null,
        })
        if (!updateResult.ok) {
          setError(updateResult.error)
          return
        }
      } else {
        const result = await createPublishProfile({
          name,
          description: description || undefined,
          agentIds: selectedAgentIds,
          productIds: selectedProductIds,
          tenantId: pitchTenantId || undefined,
        })

        if (!result.ok) {
          setError(result.error)
          return
        }
      }

      setOpen(false)
      resetForm()

      const primaryRoomName = agents.find((a) => a.id === selectedAgentIds[0])?.roomName
      if (primaryRoomName) {
        router.push(`/messages/${primaryRoomName}`)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-10 gap-1">
          <Plus className="h-4 w-4" />
          New Room
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Room</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 py-2">
          {([1, 2, 3, 4] as const).map((s) => (
            <div
              key={s}
              className={`h-2 w-2 rounded-full transition-colors ${
                s === step ? 'bg-primary' : s < step ? 'bg-primary/50' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {businessProfiles.length > 0 ? 'Room label (optional)' : 'Business Name *'}
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  businessProfiles.length > 0
                    ? 'e.g. Telegram Sales Room'
                    : 'e.g. Acme Digital Agency'
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description of your business"
              />
            </div>
            <Button
              onClick={() => setStep(2)}
              disabled={businessProfiles.length === 0 && !name.trim()}
              className="w-full"
            >
              Next — Select AI Agents
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Choose which AI agents belong to this business. The first selected becomes the
              primary agent for messaging channels.
            </p>

            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No AI agents found. Create one in{' '}
                <span className="text-primary font-medium">AI Agents</span> first.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                {agents.map((agent) => {
                  const selected = selectedAgentIds.includes(agent.id)
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => toggleAgent(agent.id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                          selected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                        }`}
                      >
                        {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{agent.name}</p>
                        <p className="text-xs text-muted-foreground truncate">@{agent.roomName}</p>
                      </div>
                      {selectedAgentIds[0] === agent.id && selectedAgentIds.length > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          Primary
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={selectedAgentIds.length === 0}
                className="flex-1"
              >
                Next — Select Products
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Link products or webinars to this business. The AI will use their details and links
              when chatting — you won&apos;t need to pick them again on the room page.
            </p>

            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No products found. You can add them later from{' '}
                <span className="text-primary font-medium">Projects</span>.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                {products.map((product) => {
                  const selected = selectedProductIds.includes(product.id)
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggleProduct(product.id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        selected
                          ? 'border-emerald-500 bg-emerald-500/5'
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                          selected
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-muted-foreground/30'
                        }`}
                      >
                        {selected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{product.title}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {product.kind}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep(4)} className="flex-1">
                Next — Publish profile (optional)
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Choose the Publish Profile this room should use. This prevents global channel/link
              bleed and keeps data scoped per profile.
            </p>

            {businessProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No publish profiles yet. Skip this step and add one under{' '}
                <span className="text-primary font-medium">Workspaces → Publish</span>, then
                add a pitch from <span className="text-primary font-medium">Workspaces</span>.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                {businessProfiles.map((p) => {
                  const selected = selectedBusinessProfileId === p.publishProfileId
                  const canSelect = Boolean(p.pitchTenantId)
                  if (!canSelect) {
                    return (
                      <div
                        key={p.publishProfileId}
                        className="flex items-center gap-3 rounded-xl border border-dashed border-muted-foreground/25 p-3 text-left opacity-70"
                      >
                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            No pitch yet — add under Workspaces
                          </p>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <button
                      key={p.publishProfileId}
                      type="button"
                      onClick={() => setSelectedBusinessProfileId(p.publishProfileId)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <div
                        className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selected ? 'border-primary' : 'border-muted-foreground/40'
                        }`}
                      >
                        {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                      <span className="text-sm font-medium truncate">{p.name}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isPending}
                className="flex-1 gap-1"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create room
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
