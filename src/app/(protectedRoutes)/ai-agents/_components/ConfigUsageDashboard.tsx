'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import {
  AudioLines,
  Building2,
  FolderKanban,
  MessageSquare,
  Mic,
  Radio,
  Users,
  Volume2,
} from 'lucide-react'
import { getConfigAgentUsage } from '@/actions/providerUsage'
import type { ProviderUsageDashboard, UsageVoiceRow } from '@/lib/usage/types'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

const POLL_MS = 8000

const chartConfig = {
  llmRequests: { label: 'LLM', color: 'var(--chart-1)' },
  sttRequests: { label: 'STT', color: 'var(--chart-2)' },
  ttsRequests: { label: 'TTS', color: 'var(--chart-3)' },
} satisfies ChartConfig

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Claude',
  deepseek: 'DeepSeek',
  kimi: 'Kimi',
  deepgram: 'Deepgram',
  fish: 'Fish Audio',
  vapi: 'Vapi',
  livekit: 'LiveKit',
}

const LLM_SURFACE_META = [
  {
    surface: 'messages',
    label: 'Messages',
    hint: 'Chat, Telegram, Slack, Discord',
    Icon: MessageSquare,
  },
  {
    surface: 'leads',
    label: 'Leads',
    hint: 'Scoring, research, meeting chat',
    Icon: Users,
  },
  {
    surface: 'projects',
    label: 'Projects',
    hint: 'LiveKit voice on webinars',
    Icon: FolderKanban,
  },
  {
    surface: 'tenants',
    label: 'Tenants',
    hint: 'Workspace assistant',
    Icon: Building2,
  },
] as const

const VOICE_META = [
  {
    provider: 'fish',
    label: 'Fish Audio',
    hint: 'TTS',
    Icon: Volume2,
  },
  {
    provider: 'vapi',
    label: 'Vapi',
    hint: 'Voice sessions',
    Icon: Radio,
  },
  {
    provider: 'deepgram',
    label: 'Deepgram',
    hint: 'STT / TTS',
    Icon: Mic,
  },
  {
    provider: 'livekit',
    label: 'LiveKit',
    hint: 'Session audio',
    Icon: AudioLines,
  },
] as const

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(Math.round(value))
}

function formatMinutes(ms: number): string {
  const minutes = ms / 60_000
  if (minutes <= 0) return '0 min'
  if (minutes < 1) return `${Math.round(ms / 1000)}s`
  return `${minutes.toFixed(1)} min`
}

function kindLabel(kind: string): string {
  if (kind === 'stt') return 'Speech to text'
  if (kind === 'tts') return 'Text to speech'
  return 'Language model'
}

function providerUnits(kind: string, inputUnits: number, outputUnits: number): string {
  if (kind === 'stt') return formatMinutes(inputUnits)
  if (kind === 'tts') return `${formatCompact(inputUnits)} chars`
  return `${formatCompact(inputUnits + outputUnits)} tokens`
}

function voicePrimary(row: UsageVoiceRow): { value: string; detail: string } {
  if (row.provider === 'fish') {
    return {
      value: formatCompact(row.ttsChars),
      detail: `chars · ${row.requests} sessions`,
    }
  }
  if (row.provider === 'vapi') {
    return {
      value: String(row.requests),
      detail: row.sttMs > 0 ? formatMinutes(row.sttMs) : 'sessions',
    }
  }
  if (row.provider === 'livekit') {
    return {
      value: formatMinutes(row.sttMs),
      detail: `${row.requests} sessions`,
    }
  }
  return {
    value: formatMinutes(row.sttMs),
    detail:
      row.ttsChars > 0
        ? `${formatCompact(row.ttsChars)} TTS chars · ${row.requests} sessions`
        : `${row.requests} sessions`,
  }
}

export default function ConfigUsageDashboard() {
  const [rangeDays, setRangeDays] = useState<'7' | '14' | '30'>('14')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ProviderUsageDashboard | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async (days: number, silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await getConfigAgentUsage(days)
      if (res.success) {
        setData(res.data)
        setUpdatedAt(new Date())
      } else if (!silent) {
        setData(null)
      }
    } catch {
      if (!silent) setData(null)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(Number(rangeDays))
  }, [load, rangeDays])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load(Number(rangeDays), true)
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [load, rangeDays])

  const hasUsage = useMemo(() => {
    if (!data) return false
    return (
      data.totals.llm.requests +
        data.totals.stt.requests +
        data.totals.tts.requests +
        data.byVoiceProvider.reduce((sum, row) => sum + row.requests, 0) >
      0
    )
  }, [data])

  const chartData = useMemo(
    () =>
      (data?.series || []).map((point) => ({
        ...point,
        label: point.day.slice(5),
      })),
    [data],
  )

  const llmBySurface = useMemo(() => {
    const map = new Map((data?.byLlmSurface || []).map((row) => [row.surface, row]))
    return LLM_SURFACE_META.map((meta) => ({
      ...meta,
      requests: map.get(meta.surface)?.requests || 0,
      tokens: map.get(meta.surface)?.tokens || 0,
    }))
  }, [data])

  const voiceByProvider = useMemo(() => {
    const map = new Map((data?.byVoiceProvider || []).map((row) => [row.provider, row]))
    return VOICE_META.map((meta) => {
      const row = map.get(meta.provider) || {
        provider: meta.provider,
        requests: 0,
        sttMs: 0,
        ttsChars: 0,
      }
      return { ...meta, ...row, ...voicePrimary(row) }
    })
  }, [data])

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight">Usage</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            LLM by product surface, and voice STT/TTS by Fish, Vapi, Deepgram, and
            LiveKit. Updates every few seconds from new traffic.
            {updatedAt
              ? ` Last sync ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`
              : ''}
          </p>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={rangeDays}
          onValueChange={(value) => {
            if (value === '7' || value === '14' || value === '30') setRangeDays(value)
          }}
          aria-label="Usage range"
        >
          <ToggleGroupItem value="7">7d</ToggleGroupItem>
          <ToggleGroupItem value="14">14d</ToggleGroupItem>
          <ToggleGroupItem value="30">30d</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : null}

      {data ? (
        <>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">LLM</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {llmBySurface.map((row) => (
                <Card className="py-4" key={row.surface}>
                  <CardHeader className="px-4 pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <row.Icon className="size-3.5" aria-hidden />
                      {row.label}
                    </CardDescription>
                    <CardTitle className="text-2xl tabular-nums">
                      {formatCompact(row.tokens)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 text-xs text-muted-foreground">
                    tokens · {row.requests} requests
                    <span className="mt-1 block text-[11px] opacity-80">{row.hint}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Voice STT / TTS
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {voiceByProvider.map((row) => (
                <Card className="py-4" key={row.provider}>
                  <CardHeader className="px-4 pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <row.Icon className="size-3.5" aria-hidden />
                      {row.label}
                    </CardDescription>
                    <CardTitle className="text-2xl tabular-nums">{row.value}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 text-xs text-muted-foreground">
                    {row.detail}
                    <span className="mt-1 block text-[11px] opacity-80">{row.hint}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Requests over time</CardTitle>
          <CardDescription>LLM, speech-to-text, and text-to-speech calls</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasUsage && !loading ? (
            <Empty className="border-0 py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AudioLines />
                </EmptyMedia>
                <EmptyTitle>No usage yet</EmptyTitle>
                <EmptyDescription>
                  New chat, lead scoring, tenant assistant, and voice sessions
                  show up here live. Older traffic before tracking started is
                  not backfilled.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
              <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="llmRequests"
                  type="monotone"
                  fill="var(--color-llmRequests)"
                  fillOpacity={0.35}
                  stroke="var(--color-llmRequests)"
                  stackId="requests"
                />
                <Area
                  dataKey="sttRequests"
                  type="monotone"
                  fill="var(--color-sttRequests)"
                  fillOpacity={0.35}
                  stroke="var(--color-sttRequests)"
                  stackId="requests"
                />
                <Area
                  dataKey="ttsRequests"
                  type="monotone"
                  fill="var(--color-ttsRequests)"
                  fillOpacity={0.35}
                  stroke="var(--color-ttsRequests)"
                  stackId="requests"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {data && data.byProvider.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">By provider</CardTitle>
            <CardDescription>Keys and runtimes that actually ran in this range</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byProvider.map((row) => (
                  <TableRow key={`${row.provider}-${row.kind}`}>
                    <TableCell className="font-medium">
                      {PROVIDER_LABELS[row.provider] || row.provider}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{kindLabel(row.kind)}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.requests}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {providerUnits(row.kind, row.inputUnits, row.outputUnits)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}
