'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GuideLineId, GuideVars } from '@/lib/onboarding/guideLines'

const MUTE_KEY = 'sts-ai:wizard-muted'

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * The wizard's voice: fetches a card's line from /api/onboarding/voice and plays it. A newer
 * line cancels the one playing. Browsers block sound until the first click, so a blocked play is
 * silent rather than an error. Mute is remembered in this browser.
 */
export function useGuideVoice(enabled: boolean) {
  const [muted, setMutedState] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urls = useRef(new Map<string, string>())
  const turn = useRef(0)

  useEffect(() => setMutedState(readMuted()), [])

  const stop = useCallback(() => {
    turn.current += 1
    audioRef.current?.pause()
    audioRef.current = null
    setSpeaking(false)
  }, [])

  const speak = useCallback(
    async (line: GuideLineId, vars: GuideVars = {}) => {
      stop()
      if (!enabled || readMuted()) return
      const mine = turn.current
      const key = `${line}|${vars.name ?? ''}|${vars.agent ?? ''}`
      try {
        let url = urls.current.get(key)
        if (!url) {
          const response = await fetch('/api/onboarding/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ line, ...vars }),
          })
          if (!response.ok) return
          url = URL.createObjectURL(await response.blob())
          urls.current.set(key, url)
        }
        if (mine !== turn.current) return
        const audio = new Audio(url)
        audioRef.current = audio
        audio.onended = () => mine === turn.current && setSpeaking(false)
        setSpeaking(true)
        await audio.play()
      } catch {
        // Autoplay blocked or the voice is unavailable: the line is still on the card.
        if (mine === turn.current) setSpeaking(false)
      }
    },
    [enabled, stop],
  )

  const setMuted = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(MUTE_KEY, next ? '1' : '0')
      } catch {
        // Not remembered; it still applies on this page.
      }
      setMutedState(next)
      if (next) stop()
    },
    [stop],
  )

  useEffect(() => {
    const cached = urls.current
    return () => {
      audioRef.current?.pause()
      for (const url of cached.values()) URL.revokeObjectURL(url)
    }
  }, [])

  return { speak, stop, muted, setMuted, speaking }
}
