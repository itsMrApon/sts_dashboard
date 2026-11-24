'use client'

import { CalendarDays, Clapperboard, List, PlugZap, Workflow } from 'lucide-react'
import Content16, { CONTENT16_POSITIONS, type ProblemCard } from '@/components/ui/content-16'

/** /lead: the Lead sections as cards that fly in, each opening its own page. */
const LEAD_CARDS: ProblemCard[] = [
  {
    id: 'intel',
    href: '/lead/intel',
    title: 'Bring leads in from Sellbird, n8n, Fathom, a CSV or Google Drive',
    metricValue: 'Open intel',
    metricTrend: 'go',
    badgeText: 'Imports',
    icon: PlugZap,
    barColor: 'bg-amber-500',
    iconColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    metricColor: 'text-amber-600 dark:text-amber-400',
    positionClass: CONTENT16_POSITIONS[0],
    initialOffset: { x: -70, y: -40, rotate: -4 },
  },
  {
    id: 'calendar',
    href: '/lead/calendar',
    title: 'Outreach batches, meetings and follow-ups on one week view',
    metricValue: 'Open calendar',
    metricTrend: 'go',
    badgeText: 'Meet · Fathom · Follow-ups',
    icon: CalendarDays,
    barColor: 'bg-violet-500',
    iconColor: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    metricColor: 'text-violet-600 dark:text-violet-400',
    positionClass: CONTENT16_POSITIONS[1],
    initialOffset: { x: 70, y: -35, rotate: 3 },
  },
  {
    id: 'list',
    href: '/lead/list',
    title: 'Every lead with its score, source and next step',
    metricValue: 'Open list',
    metricTrend: 'go',
    badgeText: 'Scores · Research',
    icon: List,
    barColor: 'bg-cyan-500',
    iconColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    metricColor: 'text-cyan-600 dark:text-cyan-400',
    positionClass: CONTENT16_POSITIONS[2],
    initialOffset: { x: -80, y: 50, rotate: -3 },
  },
  {
    id: 'video',
    href: '/lead/video',
    title: 'Videos made for your leads and outreach',
    metricValue: 'Open video',
    metricTrend: 'go',
    badgeText: 'New',
    icon: Clapperboard,
    barColor: 'bg-rose-500',
    iconColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    metricColor: 'text-rose-600 dark:text-rose-400',
    positionClass: CONTENT16_POSITIONS[3],
    initialOffset: { x: 80, y: 45, rotate: 4 },
  },
  {
    id: 'diagram',
    href: '/lead/diagram',
    title: 'Map how a lead moves from first touch to paid',
    metricValue: 'Open diagram',
    metricTrend: 'go',
    badgeText: 'New',
    icon: Workflow,
    barColor: 'bg-green-500',
    iconColor: 'bg-green-500/10 text-green-600 dark:text-green-400',
    metricColor: 'text-green-600 dark:text-green-400',
    positionClass: CONTENT16_POSITIONS[4],
    initialOffset: { x: 0, y: 70, rotate: -2 },
  },
]

export function LeadHub() {
  return (
    <Content16
      autoPlay
      badgeText="Leads"
      title="Find them, follow up,"
      highlight="and turn them into buyers."
      cards={LEAD_CARDS}
    />
  )
}
