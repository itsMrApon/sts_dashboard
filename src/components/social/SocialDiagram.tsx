import type { CSSProperties, ReactNode } from 'react'
import type { Diagram, DiagramNode } from '@/lib/social/library/types'

/**
 * Draws a Social library diagram as inline SVG in the diagram-design style
 * (github.com/cathrynlavery/diagram-design, MIT): warm paper with a dot grid, ink hairlines, one or
 * two coral focal elements, names in a sans, technical labels in mono, orthogonal connectors and
 * no shadows. Colours come from the `.dd-theme` variables in globals.css, so light and dark both
 * work. Every type draws on the same 640×400 canvas so cards line up.
 *
 * Pure and hook-free: the caller passes a unique `uid` (the item id plus where it is shown) for the
 * SVG ids.
 */

const W = 640
const H = 400
const SANS = 'var(--font-dd-sans), ui-sans-serif, system-ui, sans-serif'
const MONO = 'var(--font-dd-mono), ui-monospace, SFMono-Regular, monospace'

const v = (name: string) => `var(--dd-${name})`
const fill = (name: string): CSSProperties => ({ fill: v(name) })
const stroke = (name: string, width = 1): CSSProperties => ({ stroke: v(name), strokeWidth: width, fill: 'none' })

/** Shorten to fit a box; SVG text does not wrap. */
function fit(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`
}
/** Rough character budget for a width at a font size (sans ≈ 0.56em, mono ≈ 0.62em per char). */
const charsFor = (width: number, size: number, mono = false) => Math.max(3, Math.floor(width / (size * (mono ? 0.62 : 0.56))))

type Ids = { dots: string; arrow: string; arrowAccent: string }

/* ------------------------------------------------------------- primitives */

function Label({
  x,
  y,
  children,
  size = 13,
  weight = 600,
  mono = false,
  color = 'ink',
  anchor = 'middle',
  spacing,
}: {
  x: number
  y: number
  children: ReactNode
  size?: number
  weight?: number
  mono?: boolean
  color?: string
  anchor?: 'start' | 'middle' | 'end'
  spacing?: string
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="middle"
      style={{ ...fill(color), fontFamily: mono ? MONO : SANS, fontSize: size, fontWeight: weight, letterSpacing: spacing }}
    >
      {children}
    </text>
  )
}

/** A node box: opaque mask, styled box, optional rectangular type tag, name and mono sublabel. */
function Box({ x, y, w, h, node, size = 13 }: { x: number; y: number; w: number; h: number; node: DiagramNode; size?: number }) {
  const focal = Boolean(node.focal)
  const hasTag = Boolean(node.tag) && h >= 56
  const tagText = node.tag ? fit(node.tag.toUpperCase(), Math.floor((w - 16) / 5.4)) : ''
  const tagW = tagText.length * 5.4 + 10
  const textTop = hasTag ? y + 22 : y
  const textH = h - (hasTag ? 22 : 0)
  const hasSub = Boolean(node.sub) && textH >= 34
  const labelY = textTop + textH / 2 - (hasSub ? 7 : 0)
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} style={fill('paper')} />
      <rect
        x={x + 0.5}
        y={y + 0.5}
        width={w - 1}
        height={h - 1}
        rx={6}
        style={{ fill: focal ? v('accent-tint') : v('paper-2'), stroke: focal ? v('accent') : v('rule-strong'), strokeWidth: focal ? 1.4 : 1 }}
      />
      {hasTag ? (
        <>
          <rect x={x + 6} y={y + 6} width={tagW} height={13} rx={2} style={{ fill: focal ? v('accent') : v('rule') }} />
          <Label x={x + 6 + tagW / 2} y={y + 13} size={7.5} mono weight={600} spacing="0.08em" color={focal ? 'on-accent' : 'muted'}>
            {tagText}
          </Label>
        </>
      ) : null}
      <Label x={x + w / 2} y={labelY} size={size} color={focal ? 'accent' : 'ink'}>
        {fit(node.label, charsFor(w - 12, size))}
      </Label>
      {hasSub ? (
        <Label x={x + w / 2} y={labelY + 16} size={9.5} mono weight={400} color="muted">
          {fit(node.sub!, charsFor(w - 12, 9.5, true))}
        </Label>
      ) : null}
    </g>
  )
}

function Arrow({ d, ids, focal = false, dashed = false }: { d: string; ids: Ids; focal?: boolean; dashed?: boolean }) {
  return (
    <path
      d={d}
      markerEnd={`url(#${focal ? ids.arrowAccent : ids.arrow})`}
      style={{ ...stroke(focal ? 'accent' : 'muted', focal ? 1.4 : 1.1), strokeDasharray: dashed ? '5 4' : undefined }}
    />
  )
}

/** An arrow label on an opaque mask, so the line never runs through the text. */
function EdgeLabel({ x, y, text, focal = false }: { x: number; y: number; text: string; focal?: boolean }) {
  const t = text.toUpperCase()
  const w = t.length * 5.6 + 10
  return (
    <g>
      <rect x={x - w / 2} y={y - 7} width={w} height={14} rx={2} style={fill('paper')} />
      <Label x={x} y={y} size={8} mono weight={500} spacing="0.06em" color={focal ? 'accent' : 'muted'}>
        {t}
      </Label>
    </g>
  )
}

/** Rounded orthogonal elbow: horizontal, vertical, horizontal. */
function elbow(x1: number, y1: number, xm: number, y2: number, x2: number, r = 8): string {
  if (Math.abs(y2 - y1) < 1) return `M${x1} ${y1} H${x2}`
  const dy = y2 > y1 ? 1 : -1
  const rr = Math.min(r, Math.abs(y2 - y1) / 2, Math.abs(xm - x1), Math.abs(x2 - xm))
  const dx1 = xm > x1 ? 1 : -1
  const dx2 = x2 > xm ? 1 : -1
  return `M${x1} ${y1} H${xm - dx1 * rr} Q${xm} ${y1} ${xm} ${y1 + dy * rr} V${y2 - dy * rr} Q${xm} ${y2} ${xm + dx2 * rr} ${y2} H${x2}`
}

/* ---------------------------------------------------------------- layouts */

function Flow({ nodes, edges, ids }: { nodes: DiagramNode[]; edges?: (string | null)[]; ids: Ids }) {
  const list = nodes.slice(0, 6)
  const n = list.length
  const out: ReactNode[] = []
  const boxes: ReactNode[] = []
  const chips: ReactNode[] = []

  const number = (i: number, cx: number, top: number, focal?: boolean) => (
    <g key={`n${i}`}>
      <rect x={cx - 14} y={top - 22} width={28} height={14} rx={7} style={{ fill: focal ? v('accent-tint') : v('rule') }} />
      <Label x={cx} y={top - 15} size={8} mono weight={600} color={focal ? 'accent' : 'ink'}>
        {String(i + 1).padStart(2, '0')}
      </Label>
    </g>
  )

  if (n <= 4) {
    const gap = 40
    const w = Math.min(140, (W - 64 - gap * (n - 1)) / n)
    const total = w * n + gap * (n - 1)
    const x0 = (W - total) / 2
    const h = 84
    const y = (H - h) / 2 + 6
    list.forEach((node, i) => {
      const x = x0 + i * (w + gap)
      boxes.push(<Box key={i} x={x} y={y} w={w} h={h} node={node} />)
      chips.push(number(i, x + w / 2, y, node.focal))
      if (i < n - 1) {
        const focal = Boolean(list[i + 1].focal)
        out.push(<Arrow key={`a${i}`} d={`M${x + w + 2} ${y + h / 2} H${x + w + gap - 4}`} ids={ids} focal={focal} />)
        const label = edges?.[i]
        if (label && label.length * 5.6 + 10 <= gap + 24) out.push(<EdgeLabel key={`e${i}`} x={x + w + gap / 2} y={y + h / 2 - 16} text={label} />)
      }
    })
  } else {
    // Snake: the first row runs right, drops down at the end, the second row runs back left.
    const cols = Math.ceil(n / 2)
    const gap = 56
    const w = (W - 64 - gap * (cols - 1)) / cols
    const h = 76
    const rowY = [92, 240]
    const pos = list.map((_, i) => {
      const row = i < cols ? 0 : 1
      const col = row === 0 ? i : cols - 1 - (i - cols)
      return { x: 32 + col * (w + gap), y: rowY[row], row }
    })
    list.forEach((node, i) => {
      const p = pos[i]
      boxes.push(<Box key={i} x={p.x} y={p.y} w={w} h={h} node={node} />)
      chips.push(number(i, p.x + w / 2, p.y, node.focal))
      if (i < n - 1) {
        const q = pos[i + 1]
        const focal = Boolean(list[i + 1].focal)
        let d: string
        let lx: number
        let ly: number
        if (p.row === q.row && p.row === 0) {
          d = `M${p.x + w + 2} ${p.y + h / 2} H${q.x - 4}`
          lx = p.x + w + gap / 2
          ly = p.y + h / 2 - 16
        } else if (p.row === q.row) {
          d = `M${p.x - 2} ${p.y + h / 2} H${q.x + w + 4}`
          lx = q.x + w + gap / 2
          ly = p.y + h / 2 - 16
        } else {
          d = `M${p.x + w / 2} ${p.y + h + 2} V${q.y - 26}`
          lx = p.x + w / 2 + 34
          ly = (p.y + h + q.y - 26) / 2
        }
        out.push(<Arrow key={`a${i}`} d={d} ids={ids} focal={focal} />)
        const label = edges?.[i]
        if (label) out.push(<EdgeLabel key={`e${i}`} x={lx} y={ly} text={label} />)
      }
    })
  }
  return (
    <>
      {out}
      {boxes}
      {chips}
    </>
  )
}

function Fan({ source, via, outputs, ids }: { source: DiagramNode; via?: DiagramNode; outputs: DiagramNode[]; ids: Ids }) {
  const outs = outputs.slice(0, 6)
  const cy = H / 2
  const srcW = 132
  const srcH = 80
  const srcX = 28
  const viaW = 150
  const viaH = 88
  const viaX = 212
  const outW = 150
  const outX = W - 28 - outW
  const outH = outs.length > 4 ? 40 : 48
  const span = Math.min(300, outs.length * (outH + 14) - 14)
  const top = cy - span / 2
  const step = outs.length > 1 ? (span - outH) / (outs.length - 1) : 0
  const ys = outs.map((_, i) => top + i * step + outH / 2)
  const fromX = via ? viaX + viaW : srcX + srcW
  const busX = fromX + (outX - fromX) / 2

  return (
    <>
      {via ? <Arrow d={`M${srcX + srcW + 2} ${cy} H${viaX - 4}`} ids={ids} focal={Boolean(via.focal)} /> : null}
      {ys.map((y, i) => (
        <Arrow key={i} d={elbow(fromX + 2, cy, busX, y, outX - 4)} ids={ids} focal={Boolean(outs[i].focal)} />
      ))}
      <Box x={srcX} y={cy - srcH / 2} w={srcW} h={srcH} node={source} />
      {via ? <Box x={viaX} y={cy - viaH / 2} w={viaW} h={viaH} node={via} size={14} /> : null}
      {outs.map((node, i) => (
        <Box key={i} x={outX} y={ys[i] - outH / 2} w={outW} h={outH} node={{ ...node, tag: undefined }} size={12} />
      ))}
    </>
  )
}

function Loop({ hub, nodes, ids }: { hub: string; nodes: DiagramNode[]; ids: Ids }) {
  const list = nodes.slice(0, 6)
  const n = list.length
  const cx = W / 2
  const cy = H / 2 + 4
  const rx = 206
  const ry = 128
  const bw = 132
  const bh = 56
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const pt = (a: number) => ({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) })
  const delta = Math.min((24 * Math.PI) / 180, Math.PI / n - 0.12)
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} style={{ ...stroke('rule'), strokeDasharray: '2 5' }} />
      {list.map((node, i) => {
        const a1 = angle(i) + delta
        const a2 = angle(i + 1) - delta
        const p1 = pt(a1)
        const p2 = pt(a2)
        return (
          <Arrow
            key={`a${i}`}
            d={`M${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A${rx} ${ry} 0 0 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`}
            ids={ids}
            focal={Boolean(list[(i + 1) % n].focal)}
          />
        )
      })}
      <circle cx={cx} cy={cy} r={58} style={{ fill: v('paper-2'), stroke: v('rule-strong'), strokeWidth: 1 }} />
      <Label x={cx} y={cy - 8} size={8} mono weight={500} spacing="0.14em" color="muted">
        HUB
      </Label>
      <Label x={cx} y={cy + 8} size={13}>
        {fit(hub, 14)}
      </Label>
      {list.map((node, i) => {
        const p = pt(angle(i))
        return <Box key={i} x={p.x - bw / 2} y={p.y - bh / 2} w={bw} h={bh} node={{ ...node, tag: undefined }} size={12.5} />
      })}
    </>
  )
}

function Steps({ steps }: { steps: DiagramNode[] }) {
  const list = steps.slice(0, 6)
  const n = list.length
  const x0 = 72
  const x1 = W - 72
  const y = 164
  const gap = n > 1 ? (x1 - x0) / (n - 1) : 0
  const width = n > 1 ? gap - 8 : 200
  return (
    <>
      <line x1={x0} y1={y} x2={x1} y2={y} style={stroke('rule-strong', 1.2)} />
      {list.map((step, i) => {
        const x = n > 1 ? x0 + i * gap : W / 2
        const focal = Boolean(step.focal)
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={22} style={{ fill: focal ? v('accent') : v('paper-2'), stroke: focal ? v('accent') : v('ink'), strokeWidth: 1.2 }} />
            <Label x={x} y={y + 1} size={12} mono weight={600} color={focal ? 'on-accent' : 'ink'}>
              {String(i + 1).padStart(2, '0')}
            </Label>
            <line x1={x} y1={y + 26} x2={x} y2={y + 40} style={stroke('rule-strong')} />
            <Label x={x} y={y + 58} size={13.5} color={focal ? 'accent' : 'ink'}>
              {fit(step.label, charsFor(width, 13.5))}
            </Label>
            {step.sub ? (
              <Label x={x} y={y + 78} size={9.5} mono weight={400} color="muted">
                {fit(step.sub, charsFor(width, 9.5, true))}
              </Label>
            ) : null}
          </g>
        )
      })}
    </>
  )
}

function Funnel({ stages }: { stages: { label: string; value: string }[] }) {
  const list = stages.slice(0, 6)
  const n = list.length
  const cx = 280
  const top = 40
  const height = 320
  const gap = 6
  const bandH = (height - gap * (n - 1)) / n
  const widths = Array.from({ length: n + 1 }, (_, i) => 460 - (300 * i) / n)
  // The leakiest step (biggest relative drop) is the focal one.
  const nums = list.map((s) => Number(s.value.replace(/[^0-9.]/g, '')) || 0)
  let focal = -1
  let worst = 1
  for (let i = 1; i < n; i++) {
    const ratio = nums[i - 1] > 0 ? nums[i] / nums[i - 1] : 1
    if (ratio < worst) {
      worst = ratio
      focal = i
    }
  }
  return (
    <>
      {list.map((stage, i) => {
        const y = top + i * (bandH + gap)
        const wTop = widths[i]
        const wBot = widths[i + 1]
        const isFocal = i === focal
        const points = `${cx - wTop / 2},${y} ${cx + wTop / 2},${y} ${cx + wBot / 2},${y + bandH} ${cx - wBot / 2},${y + bandH}`
        return (
          <g key={i}>
            <polygon
              points={points}
              style={{ fill: isFocal ? v('accent-tint') : v('paper-2'), stroke: isFocal ? v('accent') : v('rule-strong'), strokeWidth: isFocal ? 1.4 : 1 }}
            />
            <Label x={cx} y={y + bandH / 2} size={13} color={isFocal ? 'accent' : 'ink'}>
              {fit(stage.label, charsFor(wBot - 24, 13))}
            </Label>
            <line x1={cx + wTop / 2 + 10} y1={y + bandH / 2} x2={500} y2={y + bandH / 2} style={{ ...stroke('rule'), strokeDasharray: '2 3' }} />
            <Label x={508} y={y + bandH / 2} size={13} mono weight={600} anchor="start" color={isFocal ? 'accent' : 'ink'}>
              {stage.value}
            </Label>
            {i > 0 && nums[i - 1] > 0 ? (
              <Label x={508} y={y + bandH / 2 + 15} size={8.5} mono weight={400} anchor="start" color="muted">
                {`${Math.round((nums[i] / nums[i - 1]) * 100)}% of prev`}
              </Label>
            ) : null}
          </g>
        )
      })}
    </>
  )
}

function Layers({ layers }: { layers: DiagramNode[] }) {
  const list = layers.slice(0, 6)
  const n = list.length
  const x = 92
  const w = W - x - 40
  const top = 36
  const gap = 8
  const h = Math.min(72, (328 - gap * (n - 1)) / n)
  const total = n * h + (n - 1) * gap
  const y0 = top + (328 - total) / 2
  return (
    <>
      {list.map((layer, i) => {
        const y = y0 + i * (h + gap)
        const focal = Boolean(layer.focal)
        return (
          <g key={i}>
            <Label x={x - 16} y={y + h / 2} size={9} mono weight={500} anchor="end" color="muted" spacing="0.08em">
              {`L${n - i}`}
            </Label>
            <rect
              x={x + 0.5}
              y={y + 0.5}
              width={w - 1}
              height={h - 1}
              rx={6}
              style={{ fill: focal ? v('accent-tint') : v('paper-2'), stroke: focal ? v('accent') : v('rule-strong'), strokeWidth: focal ? 1.4 : 1 }}
            />
            {focal ? <rect x={x} y={y} width={4} height={h} rx={2} style={fill('accent')} /> : null}
            <Label x={x + 20} y={y + h / 2} size={14} anchor="start" color={focal ? 'accent' : 'ink'}>
              {fit(layer.label, 24)}
            </Label>
            {layer.sub ? (
              <Label x={x + w - 18} y={y + h / 2} size={10} mono weight={400} anchor="end" color="muted">
                {fit(layer.sub, 34)}
              </Label>
            ) : null}
          </g>
        )
      })}
    </>
  )
}

function Sequence({
  actors,
  messages,
  ids,
}: {
  actors: string[]
  messages: { from: number; to: number; label: string; focal?: boolean }[]
  ids: Ids
}) {
  const list = actors.slice(0, 4)
  const n = list.length
  const left = 96
  const right = W - 96
  const xs = list.map((_, i) => (n > 1 ? left + (i * (right - left)) / (n - 1) : W / 2))
  const msgs = messages.slice(0, 6)
  const rowGap = Math.min(48, 252 / Math.max(1, msgs.length))
  return (
    <>
      {xs.map((x, i) => (
        <line key={`l${i}`} x1={x} y1={64} x2={x} y2={368} style={{ ...stroke('rule-strong'), strokeDasharray: '4 4' }} />
      ))}
      {msgs.map((m, i) => {
        const y = 100 + i * rowGap
        const x1 = xs[m.from] ?? xs[0]
        const x2 = xs[m.to] ?? xs[0]
        const focal = Boolean(m.focal)
        if (m.from === m.to) {
          return (
            <g key={i}>
              <Arrow d={`M${x1} ${y - 8} H${x1 + 34} V${y + 8} H${x1 + 6}`} ids={ids} focal={focal} />
              <rect x={x1 + 40} y={y - 7} width={m.label.length * 5.6 + 10} height={14} rx={2} style={fill('paper')} />
              <Label x={x1 + 45} y={y} size={8.5} mono weight={500} anchor="start" color={focal ? 'accent' : 'muted'}>
                {m.label.toUpperCase()}
              </Label>
            </g>
          )
        }
        const dir = x2 > x1 ? 1 : -1
        return (
          <g key={i}>
            <Arrow d={`M${x1 + dir * 4} ${y} H${x2 - dir * 6}`} ids={ids} focal={focal} />
            <EdgeLabel x={(x1 + x2) / 2} y={y - 12} text={fit(m.label, charsFor(Math.abs(x2 - x1) - 20, 8, true))} focal={focal} />
          </g>
        )
      })}
      {list.map((actor, i) => (
        <Box key={i} x={xs[i] - 62} y={24} w={124} h={40} node={{ label: actor }} size={12.5} />
      ))}
    </>
  )
}

function Swimlane({ lanes, steps, ids }: { lanes: string[]; steps: { lane: number; label: string; focal?: boolean }[]; ids: Ids }) {
  const laneList = lanes.slice(0, 3)
  const L = laneList.length
  const list = steps.slice(0, 7)
  const s = list.length
  const top = 32
  const laneH = 336 / L
  const labelW = 88
  const colW = (W - labelW - 12) / s
  const bw = colW - 12
  const bh = Math.min(46, laneH - 24)
  const center = (i: number) => ({ x: labelW + i * colW + 6, y: top + list[i].lane * laneH + laneH / 2 })
  return (
    <>
      {laneList.map((lane, i) => (
        <g key={`lane${i}`}>
          {i % 2 === 0 ? <rect x={0} y={top + i * laneH} width={W} height={laneH} style={fill('rule')} opacity={0.35} /> : null}
          <line x1={0} y1={top + i * laneH} x2={W} y2={top + i * laneH} style={stroke('rule')} />
          <Label x={labelW / 2} y={top + i * laneH + laneH / 2} size={9} mono weight={500} spacing="0.12em" color="muted">
            {fit(lane.toUpperCase(), 11)}
          </Label>
        </g>
      ))}
      <line x1={0} y1={top + L * laneH} x2={W} y2={top + L * laneH} style={stroke('rule')} />
      <line x1={labelW - 4} y1={top} x2={labelW - 4} y2={top + L * laneH} style={stroke('rule')} />
      {list.slice(0, -1).map((_, i) => {
        const a = center(i)
        const b = center(i + 1)
        const x1 = a.x + bw + 2
        const x2 = b.x - 4
        const xm = (x1 + x2) / 2
        return <Arrow key={`a${i}`} d={elbow(x1, a.y, xm, b.y, x2, 6)} ids={ids} focal={Boolean(list[i + 1].focal)} />
      })}
      {list.map((step, i) => {
        const c = center(i)
        return <Box key={i} x={c.x} y={c.y - bh / 2} w={bw} h={bh} node={{ label: step.label, focal: step.focal }} size={10} />
      })}
    </>
  )
}

function Quadrant({
  xAxis,
  yAxis,
  points,
}: {
  xAxis: [string, string]
  yAxis: [string, string]
  points: { label: string; x: number; y: number; focal?: boolean }[]
}) {
  const px = 128
  const py = 28
  const pw = W - px - 32
  const ph = 312
  const wrap = (t: string) => {
    const words = t.split(' ')
    if (t.length <= 13 || words.length === 1) return [t]
    const mid = Math.ceil(words.length / 2)
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
  }
  return (
    <>
      <rect x={px + pw / 2} y={py} width={pw / 2} height={ph / 2} style={fill('accent-tint')} />
      <rect x={px + 0.5} y={py + 0.5} width={pw - 1} height={ph - 1} style={stroke('rule-strong')} />
      <line x1={px + pw / 2} y1={py} x2={px + pw / 2} y2={py + ph} style={{ ...stroke('rule-strong'), strokeDasharray: '4 4' }} />
      <line x1={px} y1={py + ph / 2} x2={px + pw} y2={py + ph / 2} style={{ ...stroke('rule-strong'), strokeDasharray: '4 4' }} />
      {[
        { text: yAxis[1], y: py + 14 },
        { text: yAxis[0], y: py + ph - 14 },
      ].map((label, i) =>
        wrap(label.text).map((line, j, all) => (
          <Label
            key={`y${i}${j}`}
            x={px - 12}
            y={label.y + (j - (all.length - 1) / 2) * 12}
            size={9}
            mono
            weight={500}
            anchor="end"
            color="muted"
          >
            {`${i === 0 && j === 0 ? '↑ ' : ''}${line.toUpperCase()}`}
          </Label>
        )),
      )}
      <Label x={px} y={py + ph + 20} size={9} mono weight={500} anchor="start" color="muted">
        {xAxis[0].toUpperCase()}
      </Label>
      <Label x={px + pw} y={py + ph + 20} size={9} mono weight={500} anchor="end" color="muted">
        {`${xAxis[1].toUpperCase()} →`}
      </Label>
      {points.slice(0, 8).map((p, i) => {
        const x = px + 12 + p.x * (pw - 24)
        const y = py + 12 + (1 - p.y) * (ph - 24)
        const right = p.x < 0.72
        const t = fit(p.label, 16)
        const tw = t.length * 6.4 + 8
        const focal = Boolean(p.focal)
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={focal ? 8 : 6} style={{ fill: focal ? v('accent') : v('ink') }} />
            <rect x={right ? x + 12 : x - 12 - tw} y={y - 9} width={tw} height={18} rx={2} style={fill('paper')} opacity={0.92} />
            <Label x={right ? x + 16 : x - 16} y={y} size={11.5} anchor={right ? 'start' : 'end'} color={focal ? 'accent' : 'ink'}>
              {t}
            </Label>
          </g>
        )
      })}
    </>
  )
}

function Bars({ bars, unit }: { bars: { label: string; value: number; focal?: boolean }[]; unit?: string }) {
  const list = bars.slice(0, 7)
  const n = list.length
  const labelX = 176
  const x0 = labelX + 12
  const maxW = W - x0 - 96
  const max = Math.max(...list.map((b) => b.value), 1)
  const rowH = Math.min(52, 320 / n)
  const barH = Math.min(26, rowH - 14)
  const y0 = 40 + (320 - rowH * n) / 2
  return (
    <>
      <line x1={x0} y1={y0 - 8} x2={x0} y2={y0 + rowH * n} style={stroke('rule-strong')} />
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1={x0 + maxW * t} y1={y0 - 8} x2={x0 + maxW * t} y2={y0 + rowH * n} style={{ ...stroke('rule'), strokeDasharray: '2 4' }} />
      ))}
      {list.map((bar, i) => {
        const y = y0 + i * rowH + (rowH - barH) / 2
        const w = Math.max(4, (bar.value / max) * maxW)
        const focal = Boolean(bar.focal)
        return (
          <g key={i}>
            <Label x={labelX} y={y + barH / 2} size={12} anchor="end" color={focal ? 'accent' : 'ink'}>
              {fit(bar.label, 20)}
            </Label>
            <rect x={x0} y={y} width={w} height={barH} rx={3} style={{ fill: focal ? v('accent') : v('ink') }} opacity={focal ? 1 : 0.72} />
            <Label x={x0 + w + 8} y={y + barH / 2} size={11} mono weight={600} anchor="start" color={focal ? 'accent' : 'muted'}>
              {`${bar.value}${unit ?? ''}`}
            </Label>
          </g>
        )
      })}
    </>
  )
}

function Heatmap({ rows, cols, values }: { rows: string[]; cols: string[]; values: number[][] }) {
  const R = Math.min(rows.length, 8)
  const C = Math.min(cols.length, 7)
  const gx = 112
  const gy = 52
  const gw = W - gx - 40
  const cellW = gw / C
  const cellH = Math.min(48, 300 / R)
  let max = 0
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) max = Math.max(max, values[r]?.[c] ?? 0)
  return (
    <>
      {cols.slice(0, C).map((col, c) => (
        <Label key={`c${c}`} x={gx + c * cellW + cellW / 2} y={gy - 16} size={9} mono weight={500} color="muted" spacing="0.06em">
          {fit(col.toUpperCase(), 8)}
        </Label>
      ))}
      {rows.slice(0, R).map((row, r) => (
        <g key={`r${r}`}>
          <Label x={gx - 12} y={gy + r * cellH + cellH / 2} size={11} anchor="end">
            {fit(row, 12)}
          </Label>
          {cols.slice(0, C).map((_, c) => {
            const value = values[r]?.[c] ?? 0
            const top = value === max && max > 0
            return (
              <rect
                key={c}
                x={gx + c * cellW + 2}
                y={gy + r * cellH + 2}
                width={cellW - 4}
                height={cellH - 4}
                rx={3}
                style={{ fill: v('accent'), fillOpacity: 0.06 + 0.84 * value, stroke: top ? v('ink') : 'none', strokeWidth: top ? 1.4 : 0 }}
              />
            )
          })}
        </g>
      ))}
      <g>
        <Label x={gx} y={gy + R * cellH + 22} size={8.5} mono weight={500} anchor="start" color="muted" spacing="0.08em">
          LOW
        </Label>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((t, i) => (
          <rect key={t} x={gx + 32 + i * 18} y={gy + R * cellH + 16} width={14} height={12} rx={2} style={{ fill: v('accent'), fillOpacity: 0.06 + 0.84 * t }} />
        ))}
        <Label x={gx + 32 + 5 * 18 + 6} y={gy + R * cellH + 22} size={8.5} mono weight={500} anchor="start" color="muted" spacing="0.08em">
          HIGH
        </Label>
      </g>
    </>
  )
}

function Timeline({ events }: { events: { when: string; label: string; focal?: boolean }[] }) {
  const list = events.slice(0, 7)
  const n = list.length
  const x0 = 64
  const x1 = W - 64
  const y = 204
  const step = n > 1 ? (x1 - x0) / (n - 1) : 0
  return (
    <>
      <line x1={x0 - 24} y1={y} x2={x1 + 24} y2={y} style={stroke('rule-strong', 1.2)} />
      {list.map((event, i) => {
        const x = n > 1 ? x0 + i * step : W / 2
        const up = i % 2 === 0
        const focal = Boolean(event.focal)
        const width = Math.min(170, step * 2 - 16)
        return (
          <g key={i}>
            <line x1={x} y1={up ? y - 12 : y + 12} x2={x} y2={up ? y - 44 : y + 44} style={stroke(focal ? 'accent' : 'rule-strong')} />
            <circle cx={x} cy={y} r={focal ? 9 : 6} style={{ fill: focal ? v('accent') : v('paper-2'), stroke: focal ? v('accent') : v('ink'), strokeWidth: 1.2 }} />
            <Label x={x} y={up ? y - 72 : y + 58} size={9.5} mono weight={600} color={focal ? 'accent' : 'muted'} spacing="0.06em">
              {event.when.toUpperCase()}
            </Label>
            <Label x={x} y={up ? y - 56 : y + 74} size={12.5} color={focal ? 'accent' : 'ink'}>
              {fit(event.label, charsFor(width, 12.5))}
            </Label>
          </g>
        )
      })}
    </>
  )
}

function Hub({ center, around }: { center: DiagramNode; around: DiagramNode[] }) {
  const list = around.slice(0, 6)
  const leftCount = Math.ceil(list.length / 2)
  const left = list.slice(0, leftCount)
  const right = list.slice(leftCount)
  const cw = 176
  const ch = 96
  const cx = (W - cw) / 2
  const cy = (H - ch) / 2
  const sw = 148
  const sh = 52
  const column = (items: DiagramNode[], side: 'left' | 'right') => {
    const m = items.length
    const span = Math.min(300, m * (sh + 28) - 28)
    const top = H / 2 - span / 2
    const step = m > 1 ? (span - sh) / (m - 1) : 0
    const nx = side === 'left' ? 28 : W - 28 - sw
    return items.map((node, j) => {
      const ny = top + j * step
      const nodeY = ny + sh / 2
      const attachY = cy + (ch * (j + 1)) / (m + 1)
      const fromX = side === 'left' ? nx + sw : nx
      const toX = side === 'left' ? cx : cx + cw
      // Each connector bends on its own x, so no two vertical runs share a line.
      const mid = side === 'left' ? fromX + 16 + j * 10 : fromX - 16 - j * 10
      return (
        <g key={`${side}${j}`}>
          <path d={elbow(fromX, nodeY, mid, attachY, toX, 6)} style={stroke('muted', 1.1)} />
          <circle cx={toX} cy={attachY} r={2.5} style={fill('muted')} />
          <circle cx={fromX} cy={nodeY} r={2.5} style={fill('muted')} />
          <Box x={nx} y={ny} w={sw} h={sh} node={{ ...node, tag: undefined }} size={12} />
        </g>
      )
    })
  }
  return (
    <>
      {column(left, 'left')}
      {column(right, 'right')}
      <Box x={cx} y={cy} w={cw} h={ch} node={center} size={14.5} />
    </>
  )
}

const TYPE_CAPTION: Record<Diagram['type'], string> = {
  flow: 'FLOW',
  fan: 'FAN-OUT',
  loop: 'LOOP',
  steps: 'STEPS',
  funnel: 'FUNNEL',
  layers: 'LAYER STACK',
  sequence: 'SEQUENCE',
  swimlane: 'SWIMLANE',
  quadrant: 'QUADRANT',
  bars: 'BAR CHART',
  heatmap: 'HEATMAP',
  timeline: 'TIMELINE',
  hub: 'HUB',
}

function Body({ diagram, ids }: { diagram: Diagram; ids: Ids }) {
  switch (diagram.type) {
    case 'flow':
      return <Flow nodes={diagram.nodes} edges={diagram.edges} ids={ids} />
    case 'fan':
      return <Fan source={diagram.source} via={diagram.via} outputs={diagram.outputs} ids={ids} />
    case 'loop':
      return <Loop hub={diagram.hub} nodes={diagram.nodes} ids={ids} />
    case 'steps':
      return <Steps steps={diagram.steps} />
    case 'funnel':
      return <Funnel stages={diagram.stages} />
    case 'layers':
      return <Layers layers={diagram.layers} />
    case 'sequence':
      return <Sequence actors={diagram.actors} messages={diagram.messages} ids={ids} />
    case 'swimlane':
      return <Swimlane lanes={diagram.lanes} steps={diagram.steps} ids={ids} />
    case 'quadrant':
      return <Quadrant xAxis={diagram.xAxis} yAxis={diagram.yAxis} points={diagram.points} />
    case 'bars':
      return <Bars bars={diagram.bars} unit={diagram.unit} />
    case 'heatmap':
      return <Heatmap rows={diagram.rows} cols={diagram.cols} values={diagram.values} />
    case 'timeline':
      return <Timeline events={diagram.events} />
    case 'hub':
      return <Hub center={diagram.center} around={diagram.around} />
  }
}

export function SocialDiagram({
  diagram,
  uid,
  title,
  caption,
  className,
}: {
  diagram: Diagram
  /** Unique per rendered SVG (marker and pattern ids). */
  uid: string
  title: string
  /** Bottom-right mono caption, e.g. the item kind. */
  caption?: string
  className?: string
}) {
  const safe = uid.replace(/[^a-zA-Z0-9_-]/g, '')
  const ids: Ids = { dots: `dd-dots-${safe}`, arrow: `dd-arr-${safe}`, arrowAccent: `dd-arra-${safe}` }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${TYPE_CAPTION[diagram.type].toLowerCase()} diagram`} className={className}>
      <defs>
        <pattern id={ids.dots} width={22} height={22} patternUnits="userSpaceOnUse">
          <circle cx={11} cy={11} r={0.9} style={fill('dot')} />
        </pattern>
        <marker id={ids.arrow} markerWidth={7} markerHeight={7} refX={5.5} refY={3.5} orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0 0 L7 3.5 L0 7 Z" style={fill('muted')} />
        </marker>
        <marker id={ids.arrowAccent} markerWidth={8} markerHeight={8} refX={6} refY={4} orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0 0 L8 4 L0 8 Z" style={fill('accent')} />
        </marker>
      </defs>
      <rect width={W} height={H} style={fill('paper')} />
      <rect width={W} height={H} style={{ fill: `url(#${ids.dots})` }} />
      <Body diagram={diagram} ids={ids} />
      <Label x={16} y={H - 12} size={8} mono weight={500} anchor="start" color="soft" spacing="0.16em">
        {TYPE_CAPTION[diagram.type]}
      </Label>
      {caption ? (
        <Label x={W - 16} y={H - 12} size={8} mono weight={500} anchor="end" color="soft" spacing="0.16em">
          {caption.toUpperCase()}
        </Label>
      ) : null}
    </svg>
  )
}
