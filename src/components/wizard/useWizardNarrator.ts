'use client'

import { useCallback, useEffect, useRef } from 'react'
import { spokenText, type PublicWizardStep, type WizardLanguage } from '@/lib/wizard/types'

/** Reading-time fallback so captions still advance when audio is muted or unavailable. */
function readingTimeMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.min(14_000, Math.max(2_500, words * 380))
}

function pickBrowserVoice(language: WizardLanguage): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  const prefix = language === 'bn' ? 'bn' : 'en'
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix)) ?? null
}

type SpeakOptions = { muted: boolean }

/**
 * Plays one step at a time and resolves when it finishes (or is cancelled).
 * English: pre-rendered Cartesia clip → browser voice → timer.
 * Bangla: browser voice (bn) → timer.
 * One shared <audio> element, unlocked on the first user gesture (required by iOS Safari).
 */
export function useWizardNarrator(slug: string, language: WizardLanguage, audioBasePath = '/api/wizard') {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    cancelRef.current?.()
    cancelRef.current = null
    audioRef.current?.pause()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  useEffect(() => stop, [stop])

  /** Call inside a click/keypress handler before the first `speak`. */
  const unlock = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'auto'
    }
    const audio = audioRef.current
    audio.muted = true
    void audio.play().catch(() => undefined)
    audio.pause()
    audio.muted = false
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices()
  }, [])

  const waitTimer = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, readingTimeMs(text))
      cancelRef.current = () => {
        window.clearTimeout(timer)
        resolve()
      }
    })
  }, [])

  const speakWithBrowser = useCallback(
    (text: string) => {
      if (!('speechSynthesis' in window)) return waitTimer(text)
      const voice = pickBrowserVoice(language)
      if (language === 'bn' && !voice) return waitTimer(text)
      return new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = language === 'bn' ? 'bn-BD' : 'en-US'
        if (voice) utterance.voice = voice
        utterance.rate = 1
        // Some engines never fire `end`; cap by reading time + buffer.
        const guard = window.setTimeout(resolve, readingTimeMs(text) + 4_000)
        const finish = () => {
          window.clearTimeout(guard)
          resolve()
        }
        utterance.onend = finish
        utterance.onerror = finish
        cancelRef.current = () => {
          window.speechSynthesis.cancel()
          finish()
        }
        window.speechSynthesis.speak(utterance)
      })
    },
    [language, waitTimer],
  )

  const speakWithClip = useCallback(
    (step: PublicWizardStep) => {
      const audio = audioRef.current ?? new Audio()
      audioRef.current = audio
      const src = `${audioBasePath}/${encodeURIComponent(slug)}/audio/${encodeURIComponent(step.id)}?v=${step.audioVersion}`
      return new Promise<'ended' | 'failed'>((resolve) => {
        const cleanup = () => {
          audio.onended = null
          audio.onerror = null
        }
        audio.onended = () => {
          cleanup()
          resolve('ended')
        }
        audio.onerror = () => {
          cleanup()
          resolve('failed')
        }
        cancelRef.current = () => {
          cleanup()
          audio.pause()
          resolve('ended')
        }
        audio.src = src
        audio.currentTime = 0
        audio.play().catch(() => {
          cleanup()
          resolve('failed')
        })
      })
    },
    [audioBasePath, slug],
  )

  const speak = useCallback(
    async (step: PublicWizardStep, options: SpeakOptions) => {
      stop()
      const text = spokenText(step)
      if (!text) return
      if (options.muted) return waitTimer(text)
      if (language === 'en' && step.audioVersion) {
        const outcome = await speakWithClip(step)
        if (outcome === 'ended') return
      }
      return speakWithBrowser(text)
    },
    [language, speakWithBrowser, speakWithClip, stop, waitTimer],
  )

  return { speak, stop, unlock }
}
