'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Copy, Check, ExternalLink, Home, Loader2 } from 'lucide-react'
import { setHomeFeaturedRoom } from '@/actions/publishProfiles'
import { toast } from 'sonner'

type Props = {
  roomName: string
  isHomeFeatured?: boolean
  canSetHomeFeatured?: boolean
}

export const WebChatCard = ({
  roomName,
  isHomeFeatured = false,
  canSetHomeFeatured = false,
}: Props) => {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const relativeChatPath = `/chat/${encodeURIComponent(roomName)}`

  const copyLink = () => {
    const fullUrl =
      typeof window !== 'undefined' ? `${window.location.origin}${relativeChatPath}` : relativeChatPath
    navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSetHomeFeatured = () => {
    startTransition(async () => {
      const result = await setHomeFeaturedRoom(roomName)
      if (!result.ok) {
        toast.error(result.error || 'Could not update homepage room')
        return
      }
      toast.success('This room is now shown on your homepage')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Share this link with anyone — they can chat with your AI directly in their browser. No setup needed.
      </p>

      <div className="rounded-lg bg-muted p-3">
        <p className="text-xs text-muted-foreground mb-1 font-medium">Shareable link</p>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-background px-2 py-1 rounded flex-1 break-all">
            {relativeChatPath}
          </code>
          <Button variant="ghost" size="sm" onClick={copyLink}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      <a href={relativeChatPath} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm" className="gap-1">
          <ExternalLink className="h-3 w-3" />
          Open Chat
        </Button>
      </a>

      <div className="rounded-lg border border-border/70 bg-background/40 p-3">
        <p className="text-xs text-muted-foreground mb-2 font-medium">Homepage preview</p>
        {isHomeFeatured ? (
          <div className="flex items-center gap-2 text-xs text-primary">
            <Home className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>This room powers the AI Support preview on your Home page.</span>
          </div>
        ) : canSetHomeFeatured ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={isPending}
            onClick={handleSetHomeFeatured}
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Home className="h-3 w-3" />
            )}
            Use on homepage
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Link this room to a business hub (Messages → New room) to feature it on your Home page.
          </p>
        )}
      </div>
    </div>
  )
}
