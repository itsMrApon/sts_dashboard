import { ScrollArea } from '@/components/ui/scroll-area'
import { Settings } from 'lucide-react'
import React from 'react'
import ModelConfiguration from './ModelConfiguration'

type Props = {}

const ModelSelection = (props: Props) => {
  return (
    <div className="p-4 sm:p-8 flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <span className="h-5 w-5 rounded-full flex items-center justify-center text-xs">
          <Settings />
        </span>
        <span className="uppercase text-sm font-medium">MODEL</span>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <ModelConfiguration />
      </ScrollArea>
    </div>
  )
}

export default ModelSelection