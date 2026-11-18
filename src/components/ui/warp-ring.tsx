"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  WARP_CARD_H,
  WARP_CARD_W,
  WARP_FOCAL,
  warpPoseAt,
  warpSpin,
} from "@/components/ui/warp-carousel";

/**
 * The Warp Carousel ring (the onboarding cards' slide) for ordinary HTML children: each child rides
 * the same poses and spin curve, placed with CSS 3D transforms instead of being painted on a canvas,
 * so links, hover effects and focus keep working.
 *
 * The surroundings follow the onboarding ring: the cards on either side stay set back and turned
 * away (seen from behind, so mirrored), their outer edges flare out to the sides, and the front card
 * casts a glow band above and below itself. The WebGL lens can't bend live HTML, so cards are cut
 * off where the lens would start and the flare beyond is drawn as a soft funnel in their accent colour.
 *
 * Move it by dragging or swiping sideways, a horizontal trackpad scroll, the arrow keys, the dots,
 * or by clicking a side card. The ring wraps around.
 */

const STAGE_W = 720; // the onboarding ring's stage, in ring units
const LENS_EDGE = 248; // where the onboarding lens starts smearing cards into the flare, in ring units
const NEIGHBOUR_INNER_EDGE = 181; // where a resting side card starts, in ring units from the centre
const MIN_CARD_PX = 240; // narrow screens: front card width before the side cards stop peeking
const MIN_PEEK_PX = 24; // narrow screens: how much of each side card stays on screen
// Card height, as a share of the ring's height. The rest (11% above and below) holds the glow bands,
// which must fit entirely inside the ring: the page clips anything past its edge.
const CARD_HEIGHT_OF_STAGE = 0.78;
const DRAG_UNITS_PER_CARD = 300;
const RELEASE_SECONDS = 0.45;
const WHEEL_THRESHOLD = 40;

const mod = (a: number, n: number) => ((a % n) + n) % n;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

type Motion =
  | { mode: "rest" }
  | { mode: "spin"; from: number; to: number; t0: number; frames: number }
  | { mode: "release"; from: number; to: number; t0: number }
  | {
      mode: "drag";
      startX: number;
      startP: number;
      lastT: number;
      v: number;
      moved: boolean;
      pointerId: number;
    };

type Layout = {
  width: number;
  height: number;
  unit: number;
  cardW: number;
  cardH: number;
  lensCut: number;
};

function layoutFor(width: number, height: number): Layout {
  // Wide screens: the onboarding proportions (the 720-unit stage fills the width). Narrow screens:
  // a card of at least MIN_CARD_PX, shrunk only as far as needed for both side cards to peek in.
  const peekLimited =
    (width / 2 - Math.max(MIN_PEEK_PX, width * 0.06)) / NEIGHBOUR_INNER_EDGE;
  let unit = Math.max(
    width / STAGE_W,
    Math.min(peekLimited, MIN_CARD_PX / WARP_CARD_W),
  );
  // The ring turns cards about their vertical axis only, so height is free: always the same share of
  // the ring, which leaves room for the glow bands. Width is capped so a card stays at least 4:5
  // (wide, short screens would otherwise get squat cards).
  const cardH = height * CARD_HEIGHT_OF_STAGE;
  unit = Math.min(unit, cardH / WARP_CARD_H);
  const cardW = WARP_CARD_W * unit;
  // Cards are cut off at the lens line on each side (only when the ring is wide enough to reach it).
  const lensCut = Math.max(0, width / 2 - LENS_EDGE * unit);
  return { width, height, unit, cardW, cardH, lensCut };
}

/**
 * What a card on the ring knows about itself. `active`: it is the front card and the ring is at
 * rest, i.e. it is laid out flat at full size. Measure-on-mount effects (such as a react-three-fiber
 * canvas, which sizes itself from the on-screen rectangle) should only mount while active: mounted
 * on a side card or mid-spin they would size to the perspective-shrunk card and stay that size.
 * Outside a ring every card counts as active.
 */
const WarpRingSlotContext = React.createContext<{ active: boolean }>({
  active: true,
});
export const useWarpRingSlot = () => React.useContext(WarpRingSlotContext);
const ACTIVE = { active: true };
const INACTIVE = { active: false };

type Props = {
  children: React.ReactNode[];
  /** Short name per child, for the dots and screen readers. */
  labels: string[];
  /** Glow / flare colour per child (hex). */
  accents: string[];
  ariaLabel: string;
  /** Seconds a spin to the next card takes. Onboarding uses 1.6. */
  spinSeconds?: number;
  className?: string;
};

export function WarpRing({
  children,
  labels,
  accents,
  ariaLabel,
  spinSeconds = 1.6,
  className,
}: Props) {
  const count = children.length;
  const stageRef = React.useRef<HTMLDivElement>(null);
  const slotRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const glowRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const flareFillRefs = React.useRef<(SVGPathElement | null)[]>([]);
  const flareRimRefs = React.useRef<(SVGPathElement | null)[]>([]);
  const flareStopRefs = React.useRef<(SVGStopElement | null)[]>([]);
  const progress = React.useRef(0); // ring position: 0 = first card in front, unbounded (wraps)
  const target = React.useRef(0); // integer card the ring is heading to
  const motion = React.useRef<Motion>({ mode: "rest" });
  const suppressClick = React.useRef(false);
  const frame = React.useRef(0);
  const reducedMotion = React.useRef(false);
  const [layout, setLayout] = React.useState<Layout | null>(null);
  const [front, setFront] = React.useState(0);
  const [resting, setResting] = React.useState(true);
  const uid = React.useId().replace(/:/g, "");

  const applyPoses = React.useCallback(() => {
    if (!layout) return;
    const { width, height, unit, cardH, lensCut } = layout;
    const P = progress.current;
    const cx = width / 2;
    const cy = height / 2;
    const cardHUnits = cardH / unit;
    let frontQ = Infinity;
    let frontCard = 0;
    const sides: { weight: number; card: number; q: number }[] = [
      { weight: 0, card: -1, q: 0 },
      { weight: 0, card: -1, q: 0 },
    ];

    slotRefs.current.forEach((slot, c) => {
      if (!slot) return;
      const q = mod(c - P + count / 2, count) - count / 2;
      if (Math.abs(q) < Math.abs(frontQ)) {
        frontQ = q;
        frontCard = c;
      }
      if (Math.abs(q) > 2.05) {
        slot.style.visibility = "hidden";
        return;
      }
      const [x, depth, yaw] = warpPoseAt(q);
      slot.style.visibility = "visible";
      slot.style.transform = `translate3d(${x * unit}px, 0, ${-depth * unit}px) rotateY(${yaw}rad)`;
      slot.style.zIndex = String(Math.round(2000 - depth));
      // The front card and the two resting side cards take clicks (a side card spins to the front).
      slot.style.pointerEvents = Math.abs(q) < 1.3 ? "auto" : "none";
      const weight = clamp01(1 - Math.abs(Math.abs(q) - 1) * 1.6);
      const side = q < 0 ? 0 : 1;
      if (Math.abs(q) > 0.25 && weight > sides[side].weight)
        sides[side] = { weight, card: c, q };
    });

    // Glow bands: the card nearest the front, fading out as it turns away (so the colour swaps unseen).
    const glowStrength = clamp01(1 - Math.abs(frontQ) * 2.2);
    for (const glow of glowRefs.current) {
      if (!glow) continue;
      glow.style.opacity = String(glowStrength);
      glow.style.setProperty("--ring-accent", accents[frontCard] ?? "#ffffff");
    }

    // Flares: from each side card's outer edge, a funnel opening to the edge of the ring.
    sides.forEach(({ weight, card, q }, side) => {
      const fill = flareFillRefs.current[side];
      const rim = flareRimRefs.current[side];
      if (!fill || !rim) return;
      const sign = side === 0 ? -1 : 1;
      const edgeX = side === 0 ? 0 : width;
      if (card < 0 || weight <= 0) {
        fill.style.opacity = "0";
        rim.style.opacity = "0";
        return;
      }
      const [x, depth, yaw] = warpPoseAt(q);
      // The card's outer vertical edge, projected...
      let outerX = sign * -Infinity;
      let outerScale = 1;
      for (const s of [-WARP_CARD_W / 2, WARP_CARD_W / 2]) {
        const scale = WARP_FOCAL / (WARP_FOCAL + depth + s * Math.sin(yaw));
        const px = cx + (x + s * Math.cos(yaw)) * scale * unit;
        if (sign * px > sign * outerX) {
          outerX = px;
          outerScale = scale;
        }
      }
      // ...or, when it reaches past the lens line (where the cards are cut off), the card at that line.
      const lensX = cx + sign * LENS_EDGE * unit;
      if (lensCut > 0 && sign * outerX > sign * lensX) {
        const u = sign * LENS_EDGE;
        const s =
          (u * (WARP_FOCAL + depth) - x * WARP_FOCAL) /
          (WARP_FOCAL * Math.cos(yaw) - u * Math.sin(yaw));
        if (Math.abs(s) <= WARP_CARD_W / 2) {
          outerX = lensX;
          outerScale = WARP_FOCAL / (WARP_FOCAL + depth + s * Math.sin(yaw));
        }
      }
      const span = sign * (edgeX - outerX);
      if (span < 6) {
        fill.style.opacity = "0";
        rim.style.opacity = "0";
        return;
      }
      const half = (cardHUnits / 2) * outerScale * unit;
      const open = height * 0.47;
      const c1 = outerX + sign * span * 0.55;
      const top = `M ${outerX} ${cy - half} C ${c1} ${cy - half}, ${edgeX - sign * span * 0.2} ${cy - open}, ${edgeX} ${cy - open}`;
      const bottom = `M ${outerX} ${cy + half} C ${c1} ${cy + half}, ${edgeX - sign * span * 0.2} ${cy + open}, ${edgeX} ${cy + open}`;
      fill.setAttribute(
        "d",
        `${top} L ${edgeX} ${cy + open} C ${edgeX - sign * span * 0.2} ${cy + open}, ${c1} ${cy + half}, ${outerX} ${cy + half} Z`,
      );
      rim.setAttribute("d", `${top} ${bottom}`);
      fill.style.opacity = String(weight);
      rim.style.opacity = String(weight);
      const stop = flareStopRefs.current[side];
      if (stop) stop.setAttribute("stop-color", accents[card] ?? "#ffffff");
    });
  }, [accents, count, layout]);

  const tick = React.useCallback(() => {
    const now = performance.now() / 1000;
    const m = motion.current;
    if (m.mode === "spin") {
      const f = (now - m.t0) * 30;
      progress.current = m.from + (m.to - m.from) * warpSpin(f, m.frames);
      if (f >= m.frames) {
        progress.current = m.to;
        motion.current = { mode: "rest" };
      }
    } else if (m.mode === "release") {
      const t = Math.min(1, (now - m.t0) / RELEASE_SECONDS);
      progress.current = m.from + (m.to - m.from) * easeOutCubic(t);
      if (t >= 1) motion.current = { mode: "rest" };
    }
    applyPoses();
    const moving =
      motion.current.mode === "spin" || motion.current.mode === "release";
    frame.current = moving ? requestAnimationFrame(tick) : 0;
    if (!moving) setResting(true);
  }, [applyPoses]);

  const run = React.useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(tick);
  }, [tick]);

  const goTo = React.useCallback(
    (next: number) => {
      target.current = next;
      setFront(mod(next, count));
      if (
        Math.abs(progress.current - next) < 1e-6 &&
        motion.current.mode !== "spin"
      ) {
        // Already there (e.g. a plain click on the resting ring): nothing to animate.
        cancelAnimationFrame(frame.current);
        frame.current = 0;
        motion.current = { mode: "rest" };
        applyPoses();
        setResting(true);
        return;
      }
      if (reducedMotion.current) {
        progress.current = next;
        motion.current = { mode: "rest" };
        applyPoses();
        setResting(true);
        return;
      }
      setResting(false);
      motion.current = {
        mode: "spin",
        from: progress.current,
        to: next,
        t0: performance.now() / 1000,
        frames: Math.max(6, spinSeconds * 30),
      };
      run();
    },
    [applyPoses, count, run, spinSeconds],
  );

  /** Nearest ring position that shows card `index` in front. */
  const nearest = React.useCallback(
    (index: number) =>
      target.current +
      (mod(index - target.current + count / 2, count) - count / 2),
    [count],
  );

  React.useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const r = stage.getBoundingClientRect();
      setLayout((prev) =>
        prev && prev.width === r.width && prev.height === r.height
          ? prev
          : layoutFor(r.width, r.height),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  React.useLayoutEffect(() => applyPoses(), [applyPoses]);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => (reducedMotion.current = query.matches);
    update();
    query.addEventListener("change", update);
    return () => {
      query.removeEventListener("change", update);
      cancelAnimationFrame(frame.current);
    };
  }, []);

  // Horizontal trackpad / shift-wheel scroll steps one card; vertical scroll still moves the page.
  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let accumulated = 0;
    let lockedUntil = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = performance.now();
      if (now < lockedUntil || motion.current.mode === "drag") return;
      accumulated += e.deltaX;
      if (Math.abs(accumulated) < WHEEL_THRESHOLD) return;
      goTo(target.current + Math.sign(accumulated));
      accumulated = 0;
      lockedUntil = now + spinSeconds * 450; // let most of the spin play before the next step
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [goTo, spinSeconds]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    motion.current = {
      mode: "drag",
      startX: e.clientX,
      startP: progress.current,
      lastT: performance.now() / 1000,
      v: 0,
      moved: false,
      pointerId: e.pointerId,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const m = motion.current;
    if (m.mode !== "drag" || !layout) return;
    if (!m.moved && Math.abs(e.clientX - m.startX) > 5) {
      m.moved = true;
      setResting(false);
      // Capture only once it is a drag, so a plain click still reaches the card's link.
      e.currentTarget.setPointerCapture?.(m.pointerId);
    }
    if (!m.moved) return;
    const now = performance.now() / 1000;
    const P =
      m.startP - (e.clientX - m.startX) / (layout.unit * DRAG_UNITS_PER_CARD);
    const dt = Math.max(1 / 240, now - m.lastT);
    m.v = 0.6 * m.v + 0.4 * ((P - progress.current) / dt);
    m.lastT = now;
    progress.current = P;
    applyPoses();
  };

  const onPointerUp = () => {
    const m = motion.current;
    if (m.mode !== "drag") return;
    if (!m.moved) {
      // A click: settle back where it was (a spin may have been interrupted).
      goTo(target.current);
      return;
    }
    suppressClick.current = true;
    const v = performance.now() / 1000 - m.lastT > 0.08 ? 0 : m.v;
    // One card per swipe, like the onboarding steps; a slow drag past halfway also counts.
    const flung = Math.round(progress.current + v * 0.16);
    const next =
      target.current + Math.max(-1, Math.min(1, flung - target.current));
    target.current = next;
    setFront(mod(next, count));
    motion.current = {
      mode: "release",
      from: progress.current,
      to: next,
      t0: performance.now() / 1000,
    };
    run();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    goTo(target.current + (e.key === "ArrowRight" ? 1 : -1));
  };

  const glowBand = layout
    ? Math.max(14, (layout.height - layout.cardH) / 2)
    : 0;

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div
        ref={stageRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // touch-none: every swipe on the ring turns the ring; none of it scrolls the page.
        onKeyDown={onKeyDown}
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className="relative isolate min-h-0 w-full flex-1 cursor-grab touch-none select-none outline-none active:cursor-grabbing"
      >
        {layout ? (
          <>
            {/* Flares, behind the cards. */}
            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-visible"
            >
              <defs>
                {[0, 1].map((side) => (
                  <linearGradient
                    key={side}
                    id={`${uid}-flare-${side}`}
                    x1={side === 0 ? "1" : "0"}
                    x2={side === 0 ? "0" : "1"}
                    y1="0"
                    y2="0"
                  >
                    <stop offset="0" stopOpacity="0" stopColor="#fff" />
                    <stop
                      offset="1"
                      stopOpacity="0.55"
                      stopColor="#fff"
                      ref={(el) => {
                        flareStopRefs.current[side] = el;
                      }}
                    />
                  </linearGradient>
                ))}
                <filter
                  id={`${uid}-soft`}
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feGaussianBlur stdDeviation="10" />
                </filter>
              </defs>
              {[0, 1].map((side) => (
                <g key={side}>
                  <path
                    ref={(el) => {
                      flareFillRefs.current[side] = el;
                    }}
                    fill={`url(#${uid}-flare-${side})`}
                    filter={`url(#${uid}-soft)`}
                  />
                  <path
                    ref={(el) => {
                      flareRimRefs.current[side] = el;
                    }}
                    fill="none"
                    className="stroke-white/25"
                    strokeWidth={1}
                  />
                </g>
              ))}
            </svg>

            {/* Glow bands above and below the front card. */}
            {(["top", "bottom"] as const).map((edge, i) => (
              <div
                key={edge}
                aria-hidden
                ref={(el) => {
                  glowRefs.current[i] = el;
                }}
                className="pointer-events-none absolute left-1/2 -z-10 -translate-x-1/2 blur-[10px]"
                style={{
                  [edge]: 0,
                  width: layout.cardW * 1.15,
                  // Inset from the ring's edge so the band and its blur are never clipped.
                  height: glowBand * 0.9,
                  marginTop: edge === "top" ? glowBand * 0.05 : undefined,
                  marginBottom: edge === "bottom" ? glowBand * 0.05 : undefined,
                  background:
                    "radial-gradient(50% 50% at 50% 50%, color-mix(in srgb, var(--ring-accent) 95%, white) 0%, color-mix(in srgb, var(--ring-accent) 45%, transparent) 45%, transparent 72%)",
                  transition: "opacity 120ms linear",
                }}
              />
            ))}

            <div
              className="absolute inset-0"
              style={{
                perspective: `${WARP_FOCAL * layout.unit}px`,
                perspectiveOrigin: "50% 50%",
                clipPath:
                  layout.lensCut > 0
                    ? `inset(-50% ${layout.lensCut}px)`
                    : undefined,
              }}
            >
              {children.map((child, c) => (
                <div
                  key={labels[c] ?? c}
                  ref={(el) => {
                    slotRefs.current[c] = el;
                  }}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${labels[c]} (${c + 1} of ${count})`}
                  // Tabbing to a card brings it to the front (keyboard only, so a click still opens it).
                  onFocusCapture={(e) => {
                    if (
                      c !== front &&
                      (e.target as HTMLElement).matches(":focus-visible")
                    )
                      goTo(nearest(c));
                  }}
                  // Clicking a side card spins it to the front instead of opening it.
                  onClickCapture={(e) => {
                    if (c === front) return;
                    e.preventDefault();
                    e.stopPropagation();
                    goTo(nearest(c));
                  }}
                  className="absolute top-1/2 left-1/2"
                  style={{
                    width: layout.cardW,
                    height: layout.cardH,
                    marginLeft: -layout.cardW / 2,
                    marginTop: -layout.cardH / 2,
                  }}
                >
                  <WarpRingSlotContext.Provider
                    value={c === front && resting ? ACTIVE : INACTIVE}
                  >
                    {child}
                  </WarpRingSlotContext.Provider>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div
        className="flex items-center gap-2"
        role="tablist"
        aria-label={`${ariaLabel} position`}
      >
        {labels.map((label, c) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={c === front}
            aria-label={label}
            onClick={() => goTo(nearest(c))}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              c === front
                ? "w-6 bg-foreground"
                : "w-1.5 bg-foreground/30 hover:bg-foreground/60",
            )}
          />
        ))}
      </div>
    </div>
  );
}
