'use client'

import { useTransition, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { connectPlatform, disconnectPlatform } from '@/actions/messages'
import type { Platform, MessageChannel } from '@prisma/client'

type CredentialField = {
  key: string
  label: string
  placeholder: string
  type?: 'text' | 'password'
}

type Props = {
  roomName: string
  platform: Platform
  channel: MessageChannel | null
  description: string
  fields: CredentialField[]
  labelField?: string
}

export const GenericPlatformCard = ({
  roomName,
  platform,
  channel,
  description,
  fields,
  labelField,
}: Props) => {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const isActive = channel?.status === 'ACTIVE'

  const handleConnect = (formData: FormData) => {
    setError('')
    const credentials: Record<string, string> = {}
    for (const field of fields) {
      const value = formData.get(field.key) as string
      if (!value) {
        setError(`${field.label} is required`)
        return
      }
      credentials[field.key] = value
    }
    const label = labelField ? (formData.get('accountLabel') as string) || undefined : undefined

    startTransition(async () => {
      const result = await connectPlatform(roomName, platform, credentials, label)
      if (!result.ok) setError(result.error)
    })
  }

  const handleDisconnect = () => {
    setError('')
    startTransition(async () => {
      const result = await disconnectPlatform(roomName, platform)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">{description}</p>

      <form className="flex flex-col gap-2" action={handleConnect}>
        {labelField && (
          <div>
            <Label className="text-xs">{labelField}</Label>
            <Input
              name="accountLabel"
              type="text"
              placeholder="e.g. My Business Account"
              disabled={isPending}
              defaultValue={channel?.accountLabel || ''}
            />
          </div>
        )}
        {fields.map((field) => (
          <div key={field.key}>
            <Label className="text-xs">{field.label}</Label>
            <Input
              name={field.key}
              type={field.type || 'password'}
              placeholder={field.placeholder}
              disabled={isPending}
            />
          </div>
        ))}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            {isActive ? 'Update' : 'Connect'}
          </Button>
          {isActive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          )}
        </div>
      </form>

      {isActive && channel?.accountLabel && (
        <p className="text-xs text-muted-foreground">
          Connected as <span className="font-medium">{channel.accountLabel}</span>
        </p>
      )}
    </div>
  )
}
