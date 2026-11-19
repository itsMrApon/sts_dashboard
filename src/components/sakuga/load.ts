'use client'

import { useEffect } from 'react'

/**
 * Sakuga VFX parts live as plain scripts in /public/sakuga-vfx (one file per component, each with its
 * own copy of the core). They are loaded on first use, once, with a script tag as the set expects.
 */
export type SakugaPart = 'button' | 'toggle' | 'tabs' | 'progress' | 'toast' | 'input' | 'tooltip'

type SakugaPalette = { fill: string; shade: string; line: string; accent: string; ink: string; sfx: string[] }
type SakugaGlobal = { P: SakugaPalette }

const pending = new Map<SakugaPart, Promise<void>>()

/** The effects palette (drawn on the canvas) in the app's purple, for each theme. Controls use the --sk-* CSS variables. */
const PALETTES: Record<'light' | 'dark', SakugaPalette> = {
  light: { fill: '#ffffff', shade: '#d8c4ff', line: '#8731ff', accent: '#c026d3', ink: '#1d1a4a', sfx: ['#1d1a4a', '#ffffff'] },
  // On a near-black page the outline has to be light, or line-only marks (wobbles, speed lines) vanish.
  dark: { fill: '#c4b5fd', shade: '#7c3aed', line: '#a066ff', accent: '#e879f9', ink: '#f5f3ff', sfx: ['#2e1065', '#ffffff'] },
}

let watchingTheme = false

function applyPalette() {
  const fx = (window as unknown as { SakugaFX?: SakugaGlobal }).SakugaFX
  if (!fx) return
  const dark = document.documentElement.classList.contains('dark')
  Object.assign(fx.P, PALETTES[dark ? 'dark' : 'light'])
}

function watchTheme() {
  if (watchingTheme) return
  watchingTheme = true
  new MutationObserver(applyPalette).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
}

/** Loads one part (and the shared core with it). Safe to call many times. */
export function loadSakuga(part: SakugaPart): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  const existing = pending.get(part)
  if (existing) return existing
  const done = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `/sakuga-vfx/${part}.js`
    script.async = true
    script.onload = () => {
      applyPalette()
      watchTheme()
      resolve()
    }
    script.onerror = () => {
      pending.delete(part)
      reject(new Error(`Sakuga ${part} failed to load`))
    }
    document.head.append(script)
  })
  pending.set(part, done)
  return done
}

/** Loads a part when the component using it mounts. Pass null to skip (e.g. a plain variant). */
export function useSakuga(part: SakugaPart | null) {
  useEffect(() => {
    if (part) loadSakuga(part).catch(() => {})
  }, [part])
}
