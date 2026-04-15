import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

type Props = {
  role: 'user' | 'assistant' | 'error'
  content: string
  timestamp?: string
  errorCode?: string
}

export const ConversationBubble = ({ role, content, timestamp, errorCode }: Props) => {
  const isUser = role === 'user'
  const isError = role === 'error'

  if (isError) {
    return (
      <div className="flex w-full justify-center my-2">
        <div className="max-w-[90%] rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <span className="font-medium text-red-500">
              {errorCode === 'NO_API_KEY' && 'Missing API Key'}
              {errorCode === 'INVALID_API_KEY' && 'Invalid API Key'}
              {errorCode === 'QUOTA_EXCEEDED' && 'Quota Exceeded'}
              {errorCode === 'MODEL_ERROR' && 'Model Unavailable'}
              {errorCode === 'UNKNOWN' && 'AI Error'}
              {!errorCode && 'Error'}
            </span>
          </div>
          <p className="whitespace-pre-wrap break-words text-red-400/90 text-xs">{content}</p>
          {timestamp && (
            <p className="mt-1 text-[10px] uppercase tracking-wide text-red-400/60">
              {timestamp}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex w-full gap-2',
        isUser ? 'justify-end text-right' : 'justify-start text-left',
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{content}</p>
        {timestamp ? (
          <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/80">
            {timestamp}
          </p>
        ) : null}
      </div>
    </div>
  )
}
