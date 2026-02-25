import { ChevronDown } from 'lucide-react'
import React from 'react'

type Props = {
  value: string
  placeholder?: string
}

const DropdownSelect = ({ value, placeholder }: Props) => {
  const displaytext = value || placeholder
  const textclass = value ? '' : 'text-neutral-400'
  return (
    <div className="relative">
      <div className="flex items-center justify-between border border-neutral-700 rounded-md px-3 py-2 bg-primary/10 min-h-10">
        <span className={textclass}>{displaytext}</span>
        <ChevronDown className="h-4 w-4 text-neutral-400" />
      </div>
    </div>
  )
}

export default DropdownSelect