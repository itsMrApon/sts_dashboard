'use client'

import React from 'react'
import { useStsStore } from '@/store/useStsStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { VARIANT_META, WEBINAR_LINK_VARIANTS } from '@/lib/webinarLinkVariants'

const TypeStep = () => {
  const { formData, setSelectedVariants, getStepValidationErrors } = useStsStore()
  const selected = formData.basicInfo.selectedVariants || []
  const errors = getStepValidationErrors('basicInfo')

  const handleToggle = (value: (typeof WEBINAR_LINK_VARIANTS)[number]) => {
    const exists = selected.includes(value)
    if (exists && selected.length === 1) return
    const next = exists ? selected.filter((item) => item !== value) : [...selected, value]
    setSelectedVariants(next)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select one or more link options for this project.
      </p>
      <div className="space-y-3">
        {WEBINAR_LINK_VARIANTS.map((variant) => {
          const active = selected.includes(variant)
          const meta = VARIANT_META[variant]
          return (
            <Button
              key={variant}
              type="button"
              variant={active ? 'default' : 'outline'}
              className={cn(
                'w-full justify-start flex-col items-start gap-1 border border-border',
                active && 'bg-primary/20',
              )}
              onClick={() => handleToggle(variant)}
            >
              <span className="text-sm font-medium">{meta.label}</span>
            </Button>
          )
        })}
        <p className="text-xs text-muted-foreground pl-1">
          You can select 1-4 links. For Book a Call options, both AI agent and Stripe product are required.
        </p>
        {errors.selectedVariants && (
          <p className="text-sm text-red-400">{errors.selectedVariants}</p>
        )}
      </div>
    </div>
  )
}

export default TypeStep

