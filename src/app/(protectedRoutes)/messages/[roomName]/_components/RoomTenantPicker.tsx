'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Building2 } from 'lucide-react'
import { updateChannelTenant } from '@/actions/messages'
import { toast } from 'sonner'

/** Business profile row; pitch is stored on MessageChannel as tenantId. */
export type BusinessProfilePitchOption = {
  businessId: string
  name: string
  pitchTenantId: string | null
}

type Props = {
  roomName: string
  /** Channel field — which tenant pitch is active */
  currentPitchTenantId: string | null
  /** Tenant with pitch but no Business profile link (legacy) */
  legacyPitchTenant: { id: string; name: string } | null
  profiles: BusinessProfilePitchOption[]
  variant?: 'standalone' | 'withBusinessProducts'
}

export function RoomTenantPicker({
  roomName,
  currentPitchTenantId,
  legacyPitchTenant,
  profiles,
  variant = 'standalone',
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [pitchTenantId, setPitchTenantId] = useState(currentPitchTenantId || '')

  useEffect(() => {
    setPitchTenantId(currentPitchTenantId || '')
  }, [currentPitchTenantId])

  const dirty = pitchTenantId !== (currentPitchTenantId || '')

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateChannelTenant(roomName, pitchTenantId || null)
      if (!result.ok) {
        toast.error(result.error || 'Could not update business link')
        return
      }
      toast.success('Business link saved')
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium">Business profile pitch (optional)</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {variant === 'withBusinessProducts'
              ? 'Product copy and links come from the projects linked above. Pick a business profile to reuse its pitch in the AI context.'
              : 'Choose a business profile to reuse its pitch when replying.'}
          </p>
        </div>
      </div>

      <select
        className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
        value={pitchTenantId}
        onChange={(e) => setPitchTenantId(e.target.value)}
        disabled={isPending}
      >
        <option value="">None</option>
        {legacyPitchTenant && (
          <option value={legacyPitchTenant.id}>
            {legacyPitchTenant.name} (pitch not on a profile)
          </option>
        )}
        {profiles.map((p) =>
          p.pitchTenantId ? (
            <option key={p.businessId} value={p.pitchTenantId}>
              {p.name}
            </option>
          ) : (
            <option key={p.businessId} value={`_no_pitch_${p.businessId}`} disabled>
              {p.name} — add pitch under Tenants
            </option>
          ),
        )}
      </select>

      {profiles.length === 0 && !legacyPitchTenant && (
        <p className="text-xs text-muted-foreground">
          No business profiles yet. Add one under Tenants → Business profile, add a pitch on the
          Tenants page, then return here.
        </p>
      )}

      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={handleSave}
        disabled={isPending || !dirty}
        className="w-fit gap-1"
      >
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Save business link
      </Button>
    </div>
  )
}
