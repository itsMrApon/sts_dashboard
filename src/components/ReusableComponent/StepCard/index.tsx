import type { CSSProperties, ReactNode } from 'react'
import { WARP_CAROUSEL_FONT } from '@/components/ui/warp-carousel'
import { cn } from '@/lib/utils'

/**
 * Step card in the Warp Carousel style: a mesh-gradient face, a thin numeral, a two-line title top
 * left and a small footer. The colours are fixed, so the card reads the same in light and dark mode.
 */
export type CardPalette = { base: string; spots: [string, string, string, string]; numeral: [string, string]; glow: string }

export const PALETTES: CardPalette[] = [
  { base: '#021142', spots: ['#1675fd', '#71dcff', '#0356e8', '#01040f'], numeral: ['#3ad2ff', '#8cf6ff'], glow: '#12b0e8' },
  { base: '#2d1837', spots: ['#8358f6', '#d48cff', '#300753', '#140a1b'], numeral: ['#e2a6ff', '#fff6ff'], glow: '#9b6cff' },
  { base: '#1f2a0c', spots: ['#f14c36', '#a2ba36', '#002800', '#e49435'], numeral: ['#f4eeb6', '#c4c688'], glow: '#e49435' },
  { base: '#10000c', spots: ['#8a0c31', '#e84396', '#000000', '#ff6f90'], numeral: ['#fffdf8', '#e8603f'], glow: '#e84396' },
]

// Fine film grain over the mesh, like the reference's dithered gradient.
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.55'/></svg>\")"

function meshBackground({ base, spots }: CardPalette): string {
  return [
    `radial-gradient(60% 50% at 82% 12%, ${spots[0]} 0%, transparent 70%)`,
    `radial-gradient(55% 45% at 90% 88%, ${spots[1]} 0%, transparent 70%)`,
    `radial-gradient(70% 55% at 12% 78%, ${spots[2]} 0%, transparent 72%)`,
    `radial-gradient(50% 40% at 18% 18%, ${spots[3]} 0%, transparent 70%)`,
    base,
  ].join(', ')
}

type Props = {
  palette: CardPalette
  /** Two short lines, top left. */
  title: [string, string]
  step: number
  total: number
  /** Top right: the wizard's speaking pill, or nothing. */
  badge?: ReactNode
  /** What the wizard says on this card. */
  line?: string
  footer?: ReactNode
  children?: ReactNode
  className?: string
  /**
   * 'flat': a card of its own (phones). 'face': the content of the 3D ring's front card, which
   * paints the mesh itself; sizes follow the ring's --warp-unit so the title sits where the
   * ring draws it.
   */
  variant?: 'flat' | 'face'
}

export function StepCard({ palette, title, step, total, badge, line, footer, children, className, variant = 'flat' }: Props) {
  const numeral = String(step).padStart(2, '0')
  const face = variant === 'face'
  return (
    <section
      className={cn(
        'relative isolate flex flex-col overflow-hidden text-white',
        face
          ? 'h-full w-full'
          : 'min-h-[520px] w-full max-w-[420px] rounded-[18px] border border-white/10 p-6 animate-in fade-in zoom-in-[0.98] duration-300',
        className,
      )}
      style={
        (face
          ? { padding: 'calc(var(--warp-unit) * 17px)', paddingTop: 'calc(var(--warp-unit) * 25px)', fontFamily: WARP_CAROUSEL_FONT }
          : { background: meshBackground(palette), boxShadow: `0 40px 90px -40px ${palette.glow}` }) as CSSProperties
      }
    >
      {face ? null : (
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
      )}

      <header className="flex items-start justify-between gap-3">
        <h2
          className="text-[13px] font-light leading-[1.35] text-white/90"
          style={face ? { fontSize: 'calc(var(--warp-unit) * 10.5px)', lineHeight: 'calc(var(--warp-unit) * 14px)' } : undefined}
        >
          {title[0]}
          <br />
          {title[1]}
        </h2>
        {badge}
      </header>

      <p className={cn('flex items-start font-extralight leading-none tracking-tight', face ? 'mt-4' : 'mt-6')} aria-label={`Step ${step} of ${total}`}>
        <span
          className={cn('bg-clip-text text-transparent', face ? 'text-[64px]' : 'text-[88px]')}
          style={{ backgroundImage: `linear-gradient(90deg, ${palette.numeral[0]}, ${palette.numeral[1]})` }}
        >
          {numeral}
        </span>
        <span className="mt-3 ml-1 text-[22px]" style={{ color: palette.numeral[1] }}>
          /{total}
        </span>
      </p>

      {line ? <p className="mt-4 text-[15px] leading-snug text-white/85">{line}</p> : null}

      <div className={cn('mt-5 flex flex-1 flex-col gap-3', face && 'min-h-0 overflow-y-auto')}>{children}</div>

      {footer ? <footer className="mt-6 flex items-center justify-between gap-3 text-xs text-white/70">{footer}</footer> : null}
    </section>
  )
}

/** Shared control styles for content on a card face. */
export const CARD_INPUT =
  'h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3.5 text-[15px] text-white placeholder:text-white/45 outline-none transition-colors focus:border-white/55 focus:bg-white/15'
export const CARD_CHIP =
  'rounded-full border border-white/25 px-3.5 py-1.5 text-sm text-white/90 transition-colors hover:bg-white/10 aria-pressed:border-white aria-pressed:bg-white aria-pressed:text-black'
export const CARD_PRIMARY =
  'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50'
export const CARD_GHOST = 'text-sm text-white/70 transition-colors hover:text-white'
