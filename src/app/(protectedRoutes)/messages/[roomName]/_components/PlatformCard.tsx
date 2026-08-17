 'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ArrowUpRightIcon, Settings2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  title: string
  icon: React.ReactNode
  status?: 'active' | 'inactive' | 'error'
  comingSoon?: boolean
  description?: string
  openLink?: string
  linkLabel?: string
  children?: React.ReactNode
}

export const PlatformCard = ({
  title,
  icon,
  status,
  comingSoon,
  description,
  openLink,
  linkLabel = 'Platform link',
  children,
}: Props) => {
  const statusLabel =
    status === 'active' ? 'Connected' : status === 'error' ? 'Error' : 'Not connected'

  const statusVariant = status === 'active' ? 'default' : status === 'error' ? 'destructive' : 'secondary'

  return (
    <Sheet>
      <div
        className={cn(
          'w-full rounded-xl border border-border/70 bg-card/95 px-4 py-3 shadow-sm',
          comingSoon && 'opacity-70',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              {icon}
            </div>
            <p className="truncate text-sm font-medium">{title}</p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={statusVariant} className="text-[11px]">
              {statusLabel}
            </Badge>

            {openLink ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Badge asChild variant="outline" className="cursor-pointer">
                    <button type="button">
                      Open Link <ArrowUpRightIcon data-icon="inline-end" className="h-3 w-3" />
                    </button>
                  </Badge>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{linkLabel}</DialogTitle>
                    <DialogDescription>
                      Open or copy this link for {title.toLowerCase()} setup.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input value={openLink} readOnly />
                    <a href={openLink} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full">
                        Open in new tab
                      </Button>
                    </a>
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}

            <SheetTrigger asChild disabled={comingSoon}>
              <Badge asChild className="cursor-pointer">
                <button type="button">
                  Configure <Settings2 data-icon="inline-end" className="h-3 w-3" />
                </button>
              </Badge>
            </SheetTrigger>
          </div>
        </div>
      </div>

      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              {icon}
            </span>
            {title}
          </SheetTitle>
          <SheetDescription>
            {description || `Configure ${title.toLowerCase()} channel settings.`}
          </SheetDescription>
        </SheetHeader>
        <div className={cn(comingSoon && 'pointer-events-none opacity-60')}>{children}</div>
      </SheetContent>
    </Sheet>
  )
}
