'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type HugeiconsIconProps = {
  icon: LucideIcon
  size?: number
  className?: string
}

export function HugeiconsIcon({ icon: Icon, size = 18, className }: HugeiconsIconProps) {
  return <Icon className={cn(className)} style={{ width: size, height: size }} aria-hidden />
}

export { ChevronDown as ArrowDown01Icon, Wrench as ToolsIcon } from 'lucide-react'
