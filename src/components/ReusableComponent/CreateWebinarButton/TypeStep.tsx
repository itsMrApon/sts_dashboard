'use client'

import React from 'react'
import { useStsStore } from '@/store/useStsStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TypeStep = () => {
  const { formData, updateBasicInfoField } = useStsStore()
  const kind = formData.basicInfo.kind || 'project'

  const handleSelect = (value: 'project' | 'product') => {
    updateBasicInfoField('kind', value)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose what you want to create.
      </p>
      <div className="space-y-3">
        <Button
          type="button"
          variant={kind === 'project' ? 'default' : 'outline'}
          className={cn(
            'w-full justify-start flex-col items-start gap-1 border border-border',
            kind === 'project' && 'bg-primary/20',
          )}
          onClick={() => handleSelect('project')}
        >
          <span className="text-sm font-medium">Webinar</span>
        </Button>
        <p className="text-xs text-muted-foreground pl-1">
          Live webinar-style experience with scheduled time and video.
        </p>
        <Button
          type="button"
          variant={kind === 'product' ? 'default' : 'outline'}
          className={cn(
            'w-full justify-start flex-col items-start gap-1 border border-border',
            kind === 'product' && 'bg-primary/20',
          )}
          onClick={() => handleSelect('product')}
        >
          <span className="text-sm font-medium">Product</span>
        </Button>
        <p className="text-xs text-muted-foreground pl-1">
          Always-on AI sales page with Buy Now checkout, no schedule.
        </p>
      </div>
    </div>
  )
}

export default TypeStep

