'use client'

import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { resolveTheme, type WizardShape, type WizardThemeId } from '@/lib/wizard/types'

const GemSmoke = dynamic(() => import('@paper-design/shaders-react').then((mod) => mod.GemSmoke), {
  ssr: false,
  loading: () => null,
})

type Props = {
  theme: WizardThemeId
  shape: WizardShape
  /** Rendered size in px (square). */
  size: number
  /** Speeds up the smoke while the guide is talking. */
  speaking?: boolean
  className?: string
}

/** The Wizard's "face": Paper Shaders Gem Smoke with a gradient fallback behind it (no WebGL / loading). */
export function WizardGem({ theme, shape, size, speaking = false, className }: Props) {
  const palette = resolveTheme(theme)
  return (
    <div
      className={cn('relative shrink-0 overflow-hidden rounded-full', className)}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, ${palette.colors.at(-1)} 0%, ${palette.colors[0]} 45%, ${palette.colorBack} 75%)`,
      }}
      aria-hidden
    >
      <GemSmoke
        width={size}
        height={size}
        colors={palette.colors}
        colorBack={palette.colorBack}
        colorInner={palette.colorInner}
        shape={shape}
        innerDistortion={0.8}
        outerDistortion={0.6}
        outerGlow={0.55}
        innerGlow={1}
        offset={0}
        angle={0}
        size={0.8}
        scale={0.75}
        speed={speaking ? 2.4 : 0.8}
      />
    </div>
  )
}
