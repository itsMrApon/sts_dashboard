'use client'

import type { ReactNode } from 'react'
import {
  Calendar,
  Mail,
  MessageCircle,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Workflow,
  Wrench,
} from 'lucide-react'

const CATEGORY_ICONS: Record<string, typeof ShoppingBag> = {
  gmail: Mail,
  google_calendar: Calendar,
  medusa: ShoppingBag,
  n8n: Workflow,
  erpnext: Package,
  chatwoot: MessageCircle,
  search: Search,
  memory: Sparkles,
  executor: Wrench,
  handoff: Sparkles,
}

export function formatToolName(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function getToolCategoryIcon(
  category: string,
  size: { width: number; height: number },
  iconUrl?: string,
): ReactNode {
  if (iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconUrl}
        alt=""
        width={size.width}
        height={size.height}
        className="min-h-8 min-w-8 rounded-lg object-cover"
      />
    )
  }

  const Icon = CATEGORY_ICONS[category] ?? Wrench
  return (
    <div className="flex min-h-8 min-w-8 items-center justify-center rounded-lg bg-zinc-200 p-1 text-zinc-600 backdrop-blur dark:bg-zinc-800 dark:text-zinc-400">
      <Icon style={{ width: size.width, height: size.height }} />
    </div>
  )
}
