'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { AgentClient } from '@/lib/social/library/types'

/**
 * What a creator keeps on this device in the Social library: saved cards and the agent the
 * prompts are written for. Stored in localStorage (no account data, nothing secret) and kept in
 * sync across components and tabs.
 */
const SAVES_KEY = 'sts-social-saves'
const CLIENT_KEY = 'sts-social-client'
const EVENT = 'sts-social-prefs'

const EMPTY: readonly string[] = Object.freeze([])
let savesCache: { raw: string | null; ids: readonly string[] } = { raw: null, ids: EMPTY }

function readSaves(): readonly string[] {
  const raw = window.localStorage.getItem(SAVES_KEY)
  if (raw === savesCache.raw) return savesCache.ids
  let ids: readonly string[] = EMPTY
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    ids = EMPTY
  }
  savesCache = { raw, ids }
  return ids
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === SAVES_KEY || e.key === CLIENT_KEY) onChange()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(EVENT, onChange)
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode or full storage: the choice just won't persist.
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useSocialSaves() {
  const ids = useSyncExternalStore(subscribe, readSaves, () => EMPTY)
  const toggle = useCallback((id: string): boolean => {
    const current = readSaves()
    const saved = !current.includes(id)
    write(SAVES_KEY, JSON.stringify(saved ? [id, ...current] : current.filter((x) => x !== id)))
    return saved
  }, [])
  return { ids, has: (id: string) => ids.includes(id), toggle }
}

const CLIENTS: readonly AgentClient[] = ['claude', 'codex', 'cursor']

function readClient(): AgentClient {
  const raw = window.localStorage.getItem(CLIENT_KEY)
  return CLIENTS.includes(raw as AgentClient) ? (raw as AgentClient) : 'claude'
}

export function useAgentClient() {
  const client = useSyncExternalStore(subscribe, readClient, () => 'claude' as AgentClient)
  const setClient = useCallback((next: AgentClient) => write(CLIENT_KEY, next), [])
  return [client, setClient] as const
}

/** Clipboard API first; the old textarea + execCommand path where the API is blocked (embeds, http). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    // Inside a modal dialog the focus trap would steal focus from a textarea on <body>.
    const host = document.activeElement?.closest('[role="dialog"]') ?? document.body
    host.appendChild(area)
    area.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    area.remove()
    return ok
  }
}
