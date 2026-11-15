'use client'

import { submitHostedForm } from '@/actions/publicServices'
import { FormFlow } from '@/components/services/form/FormFlow'
import type { FormServiceConfig } from '@/lib/services/types'
import { cn } from '@/lib/utils'

type Props = {
  roomName: string
  businessName: string
  config: FormServiceConfig
  /** Country preselected for phone questions (e.g. BD for Bangla businesses). */
  defaultCountry: string
  /** The business's chat page, when Chat AI is on ("Chat with us" after sending). */
  chatHref?: string
}

/** Hosted form: a blank full screen, one question at a time, answers emailed to the business. */
export function FormRoom({ roomName, businessName, config, defaultCountry, chatHref }: Props) {
  return (
    <FormFlow
      frame="page"
      config={config}
      defaultCountry={defaultCountry}
      chatHref={chatHref}
      corner={<BusinessMark name={businessName} theme={config.theme} />}
      onSubmit={(values, consent) => submitHostedForm({ roomName, values, consent })}
    />
  )
}

export function BusinessMark({ name, theme }: { name: string; theme: FormServiceConfig['theme'] }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium">
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold',
          theme === 'light' ? 'bg-zinc-900 text-white' : 'bg-white/10 text-white',
        )}
      >
        {name.trim().charAt(0).toUpperCase() || 'S'}
      </span>
      {name}
    </p>
  )
}
