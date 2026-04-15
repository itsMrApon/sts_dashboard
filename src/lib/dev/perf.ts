type PerfMeta = Record<string, string | number | boolean | null | undefined>

export const isDevPerfEnabled = false

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

function toMetaString(meta?: PerfMeta) {
  if (!meta) return ''
  const parts = Object.entries(meta)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)

  return parts.length ? ` ${parts.join(' ')}` : ''
}

export function logDevPerf(label: string, durationMs: number, meta?: PerfMeta) {
  void label
  void durationMs
  void meta
  return
}

export function startPerf(label: string, meta?: PerfMeta) {
  const started = nowMs()
  return {
    end(extraMeta?: PerfMeta) {
      logDevPerf(label, nowMs() - started, { ...meta, ...extraMeta })
    },
  }
}

export async function timeAsync<T>(
  label: string,
  operation: () => Promise<T>,
  meta?: PerfMeta,
): Promise<T> {
  const timer = startPerf(label, meta)
  try {
    return await operation()
  } finally {
    timer.end()
  }
}
