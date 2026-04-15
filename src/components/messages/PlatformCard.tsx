import { cn } from '@/lib/utils'

type Props = {
  title: string
  icon: React.ReactNode
  status?: 'active' | 'inactive' | 'error'
  comingSoon?: boolean
  children?: React.ReactNode
}

export const PlatformCard = ({ title, icon, status, comingSoon, children }: Props) => {
  const statusLabel =
    status === 'active' ? 'Connected' : status === 'error' ? 'Error' : 'Not connected'

  const statusColor =
    status === 'active'
      ? 'bg-emerald-500'
      : status === 'error'
        ? 'bg-destructive'
        : 'bg-muted-foreground'

  return (
    <div className="relative w-full rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
      {comingSoon && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground">
            Coming soon
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
          <div className="flex flex-col">
            <p className="font-medium">{title}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className={cn('h-1.5 w-1.5 rounded-full', statusColor)} />
              <span>{statusLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={cn('pt-2', comingSoon && 'pointer-events-none opacity-60')}>
        {children}
      </div>
    </div>
  )
}

