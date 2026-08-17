import { ScrollArea } from '@/components/ui/scroll-area'
import { Settings } from 'lucide-react'
import React from 'react'
import ModelConfiguration from './ModelConfiguration'

type Props = {}

const ModelSelection = (props: Props) => {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-8">
      <div className="mb-4 flex shrink-0 items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs">
          <Settings />
        </span>
        <span className="text-sm font-medium uppercase">MODEL</span>
      </div>

      <ScrollArea className="min-h-0 flex-1 overflow-hidden">
        <ModelConfiguration />
      </ScrollArea>
    </div>
  )
}

export default ModelSelection