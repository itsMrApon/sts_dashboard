"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";

// shadcn
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// third-party (motion is framer-motion's current package name, same API)
import {
  animate,
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";

// project-imports
import { cn } from "@/lib/utils";

// assets
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Clock,
  Flame,
  Layers,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";

// constants
export interface ProblemCard {
  id: string;
  title: string;
  metricValue: string;
  metricTrend: "down" | "up" | "alert" | "go";
  badgeText: string;
  icon: LucideIcon;
  barColor: string;
  iconColor: string;
  metricColor: string;
  positionClass: string;
  initialOffset: { x: number; y: number; rotate: number };
  /** When set, the card is a link instead of a select toggle. */
  href?: string;
}

/** Desktop slots for up to five orbiting cards, in order. */
export const CONTENT16_POSITIONS = [
  "lg:top-6 lg:left-4 xl:top-10 xl:left-14",
  "lg:top-6 lg:right-4 xl:top-10 xl:right-14",
  "lg:bottom-6 lg:left-4 xl:bottom-10 xl:left-14",
  "lg:bottom-6 lg:right-4 xl:bottom-10 xl:right-14",
  "lg:-bottom-4 lg:left-1/2 lg:-translate-x-1/2 xl:-bottom-8",
] as const;

const problemCards: ProblemCard[] = [
  {
    id: "empty-views",
    title: "Creator campaigns bringing viral views with zero buyer intent",
    metricValue: "-68% buying intent",
    metricTrend: "down",
    badgeText: "Low Commercial Intent",
    icon: TrendingDown,
    barColor: "bg-destructive",
    iconColor: "bg-destructive/10 text-destructive",
    metricColor: "text-destructive",
    positionClass: CONTENT16_POSITIONS[0],
    initialOffset: { x: -70, y: -40, rotate: -4 },
  },
  {
    id: "production-slog",
    title: "Burning 6+ weeks in agency loops while market windows close",
    metricValue: "6+ weeks launch lag",
    metricTrend: "alert",
    badgeText: "Slow Creative Cycles",
    icon: Clock,
    barColor: "bg-yellow-500",
    iconColor: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    metricColor: "text-yellow-600 dark:text-yellow-400",
    positionClass: CONTENT16_POSITIONS[1],
    initialOffset: { x: 70, y: -35, rotate: 3 },
  },
  {
    id: "ad-fatigue",
    title: "Visuals look aesthetic in design files but fail in production",
    metricValue: "0.8s avg skip speed",
    metricTrend: "alert",
    badgeText: "Zero Hook Retention",
    icon: Flame,
    barColor: "bg-cyan-500",
    iconColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    metricColor: "text-cyan-600 dark:text-cyan-400",
    positionClass: CONTENT16_POSITIONS[2],
    initialOffset: { x: -80, y: 50, rotate: -3 },
  },
  {
    id: "mismatched-creators",
    title: "Sourcing creators on follower count instead of real audience fit",
    metricValue: "72% audience mismatch",
    metricTrend: "down",
    badgeText: "Zero Community Affinity",
    icon: BarChart3,
    barColor: "bg-primary",
    iconColor: "bg-primary/10 text-primary",
    metricColor: "text-primary",
    positionClass: CONTENT16_POSITIONS[3],
    initialOffset: { x: 80, y: 45, rotate: 4 },
  },
  {
    id: "erratic-cadence",
    title: "Sporadic reach spikes followed by steep audience dropoff",
    metricValue: "85% memory decay",
    metricTrend: "alert",
    badgeText: "Broken Growth Rhythm",
    icon: Layers,
    barColor: "bg-green-500",
    iconColor: "bg-green-500/10 text-green-600 dark:text-green-400",
    metricColor: "text-green-600 dark:text-green-400",
    positionClass: CONTENT16_POSITIONS[4],
    initialOffset: { x: 0, y: 70, rotate: -1 },
  },
];

const subscribeIframe = () => () => {};
const getIframeSnapshot = () =>
  typeof window !== "undefined" && window.self !== window.top;
const getIframeServerSnapshot = () => false;

function MetricIcon({ card }: { card: ProblemCard }) {
  const className = cn("size-3.5", card.metricColor);
  if (card.metricTrend === "down") return <TrendingDown className={className} />;
  if (card.metricTrend === "go") return <ArrowRight className={className} />;
  return <AlertCircle className={className} />;
}

/** Wraps a card in a link when it has one. */
function CardLink({ card, children }: { card: ProblemCard; children: ReactNode }) {
  if (!card.href) return <>{children}</>;
  return (
    <Link
      href={card.href}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {children}
    </Link>
  );
}

//  ------------------------------ | CONTENT 16 | ------------------------------  //

interface Content16Props {
  /**
   * Optional override (0..1) that forces the scroll-linked reveal progress.
   * Intended for static previews/screenshots only — when omitted the
   * component behaves exactly as before, driven by real scroll position.
   */
  previewProgress?: number;
  /**
   * Plays the reveal once on load instead of tying it to page scroll, without
   * the tall sticky scroll runway. For pages inside the app.
   */
  autoPlay?: boolean;
  badgeText?: string;
  /** First heading line. */
  title?: ReactNode;
  /** Second heading line, in the gradient. */
  highlight?: ReactNode;
  cards?: ProblemCard[];
}

export default function Content16({
  previewProgress,
  autoPlay = false,
  badgeText = "The Performance Creative Gap",
  title = "Social growth",
  highlight = "feels harder than it should.",
  cards = problemCards,
}: Content16Props = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const isInIframe = useSyncExternalStore(
    subscribeIframe,
    getIframeSnapshot,
    getIframeServerSnapshot,
  );
  // No scroll runway: embedded in an iframe, or playing on load.
  const isStatic = isInIframe || autoPlay;

  // Native scroll tracking across the sticky runway (desktop standalone / user site)
  const { scrollYProgress: nativeScrollProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Iframe-aware scroll progress (when embedded in dashboard blocks list)
  const iframeScrollProgress = useMotionValue(0);

  // Forced progress for static previews (bypasses scroll listeners entirely)
  const forcedProgress = useMotionValue(previewProgress ?? 0);

  // Reveal on load, settling the same way the scroll spring does.
  const autoProgress = useMotionValue(0);
  useEffect(() => {
    if (!autoPlay || previewProgress !== undefined) return;
    const controls = animate(autoProgress, 1, { duration: 1.4, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [autoPlay, autoProgress, previewProgress]);

  useEffect(() => {
    if (previewProgress !== undefined || autoPlay) return;
    if (!isInIframe) return;

    try {
      const parentDoc = window.parent.document;
      const scrollContainer =
        parentDoc.getElementById("main-scroll-area") || window.parent;

      const updateProgress = () => {
        const frameEl = window.frameElement as HTMLElement | null;
        if (!frameEl) return;

        const rect = frameEl.getBoundingClientRect();
        const parentHeight = window.parent.innerHeight;

        // Progress begins as block enters upper view and reaches full as it centers
        const enterY = parentHeight * 0.75;
        const finishY = parentHeight * 0.15;
        const range = enterY - finishY;

        if (range > 0) {
          const progress = Math.min(
            Math.max((enterY - rect.top) / range, 0),
            1,
          );
          iframeScrollProgress.set(progress);
        }
      };

      updateProgress();
      scrollContainer.addEventListener("scroll", updateProgress, {
        passive: true,
      });
      window.parent.addEventListener("resize", updateProgress, {
        passive: true,
      });

      return () => {
        scrollContainer.removeEventListener("scroll", updateProgress);
        window.parent.removeEventListener("resize", updateProgress);
      };
    } catch {
      iframeScrollProgress.set(1);
    }
  }, [iframeScrollProgress, isInIframe, previewProgress, autoPlay]);

  const activeProgress = autoPlay
    ? autoProgress
    : isInIframe
      ? iframeScrollProgress
      : nativeScrollProgress;

  const springProgress = useSpring(activeProgress, {
    stiffness: 100,
    damping: 24,
    restDelta: 0.001,
  });

  const smoothProgress =
    previewProgress !== undefined ? forcedProgress : springProgress;

  // Header animation on initial scroll (stays full size when playing on load)
  const headerScale = useTransform(
    smoothProgress,
    [0, 0.4, 0.8, 1],
    autoPlay ? [0.96, 1, 1, 1] : [1, 0.98, 0.96, 0.94],
  );
  const headerOpacity = useTransform(
    smoothProgress,
    [0, 0.2, 0.8, 1],
    autoPlay ? [0.6, 1, 1, 1] : [0.9, 1, 1, 0.95],
  );

  // Card 1 (Top Left)
  const card1X = useTransform(smoothProgress, [0, 0.3], [-70, 0]);
  const card1Y = useTransform(smoothProgress, [0, 0.3], [-40, 0]);
  const card1Opacity = useTransform(smoothProgress, [0, 0.25], [0.25, 1]);
  const card1Scale = useTransform(smoothProgress, [0, 0.3], [0.9, 1]);

  // Card 2 (Top Right)
  const card2X = useTransform(smoothProgress, [0.08, 0.38], [70, 0]);
  const card2Y = useTransform(smoothProgress, [0.08, 0.38], [-35, 0]);
  const card2Opacity = useTransform(smoothProgress, [0.05, 0.32], [0.2, 1]);
  const card2Scale = useTransform(smoothProgress, [0.08, 0.38], [0.9, 1]);

  // Card 3 (Bottom Left)
  const card3X = useTransform(smoothProgress, [0.18, 0.48], [-80, 0]);
  const card3Y = useTransform(smoothProgress, [0.18, 0.48], [50, 0]);
  const card3Opacity = useTransform(smoothProgress, [0.15, 0.42], [0.2, 1]);
  const card3Scale = useTransform(smoothProgress, [0.18, 0.48], [0.9, 1]);

  // Card 4 (Bottom Right)
  const card4X = useTransform(smoothProgress, [0.26, 0.58], [80, 0]);
  const card4Y = useTransform(smoothProgress, [0.26, 0.58], [45, 0]);
  const card4Opacity = useTransform(smoothProgress, [0.22, 0.52], [0.2, 1]);
  const card4Scale = useTransform(smoothProgress, [0.26, 0.58], [0.9, 1]);

  // Card 5 (Bottom Center)
  const card5X = useTransform(smoothProgress, [0.35, 0.68], [0, 0]);
  const card5Y = useTransform(smoothProgress, [0.35, 0.68], [70, 0]);
  const card5Opacity = useTransform(smoothProgress, [0.3, 0.62], [0.2, 1]);
  const card5Scale = useTransform(smoothProgress, [0.35, 0.68], [0.9, 1]);

  // Map progress to card motion values
  const cardTransforms = [
    { opacity: card1Opacity, scale: card1Scale, x: card1X, y: card1Y },
    { opacity: card2Opacity, scale: card2Scale, x: card2X, y: card2Y },
    { opacity: card3Opacity, scale: card3Scale, x: card3X, y: card3Y },
    { opacity: card4Opacity, scale: card4Scale, x: card4X, y: card4Y },
    { opacity: card5Opacity, scale: card5Scale, x: card5X, y: card5Y },
  ];

  const badge = (
    <Badge
      variant="outline"
      className="gap-2 rounded-full border-border/80 bg-card/80 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-md"
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-destructive" />
      </span>
      {badgeText}
    </Badge>
  );

  return (
    <section className="relative w-full bg-background">
      {/* ----------------- DESKTOP PINNED SCROLL RUNWAY (lg+) ----------------- */}
      <div
        ref={containerRef}
        className={cn(
          "relative hidden w-full lg:block",
          autoPlay
            ? "min-h-[600px]"
            : isStatic
              ? "min-h-[720px] xl:min-h-[780px]"
              : "min-h-[220vh]",
        )}
      >
        <div
          className={cn(
            "flex w-full flex-col justify-center overflow-hidden px-4 py-8 xl:px-10",
            autoPlay
              ? "relative min-h-[600px] py-4"
              : isStatic
                ? "relative min-h-[720px] xl:min-h-[780px]"
                : "sticky top-0 h-screen",
          )}
        >
          {/* Subtle Background Radial Glows */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-130 w-130 -translate-x-1/2 rounded-full bg-primary/10 blur-[130px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-1/4 bottom-0 -z-10 h-96 w-96 rounded-full bg-yellow-500/5 blur-[120px]"
          />

          {/* Central Arena: Narrative Hub & Orbiting Cards */}
          <div
            className={cn(
              "relative my-auto flex w-full items-center justify-center",
              autoPlay ? "h-[72vh] min-h-[560px]" : "h-[82vh] min-h-[640px]",
            )}
          >
            {/* Center Main Narrative (Clean & Compact) */}
            <motion.div
              style={{ opacity: headerOpacity, scale: headerScale }}
              className="relative z-10 mx-auto flex max-w-xl flex-col items-center gap-3.5 text-center"
            >
              {badge}

              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl md:leading-snug">
                {title} <br />
                <span className="bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
                  {highlight}
                </span>
              </h2>
            </motion.div>

            {/* Orbiting / Floating Problem Cards */}
            {cards.slice(0, cardTransforms.length).map((card, idx) => {
              const transform = cardTransforms[idx];
              const isSelected = activeCardId === card.id;
              const Icon = card.icon;

              return (
                <div
                  key={card.id}
                  className={cn(
                    "absolute z-20 w-72 xl:w-88",
                    card.positionClass,
                  )}
                >
                  <motion.div
                    style={{
                      opacity: isSelected ? 1 : transform.opacity,
                      rotate: isSelected ? 0 : card.initialOffset.rotate,
                      scale: isSelected ? 1.05 : transform.scale,
                      x: transform.x,
                      y: transform.y,
                    }}
                    whileHover={{ rotate: 0, scale: 1.04, zIndex: 30 }}
                    onClick={
                      card.href
                        ? undefined
                        : () => setActiveCardId(isSelected ? null : card.id)
                    }
                    className="w-full cursor-pointer transition-shadow duration-300"
                  >
                    <CardLink card={card}>
                      <Card
                        className={cn(
                          "group relative mb-0 gap-0 overflow-hidden rounded-xl border bg-card/90 py-0 shadow-md backdrop-blur-xl transition-all duration-300",
                          isSelected
                            ? "shadow-xl ring-2 ring-primary/20"
                            : "border-border/70 hover:shadow-lg",
                        )}
                      >
                        {/* Top Status Gradient Bar */}
                        <div className={cn("h-1.5 w-full", card.barColor)} />

                        <CardContent className="flex flex-col gap-2.5 p-4 xl:gap-3.5 xl:p-5">
                          <div className="flex items-center gap-2.5 xl:gap-3">
                            <div
                              className={cn(
                                "flex size-8 min-w-8 items-center justify-center rounded-lg xl:size-9 xl:min-w-9",
                                card.iconColor,
                              )}
                            >
                              <Icon className="size-4 xl:size-4.5" />
                            </div>
                            {/* Short Punchy Statement as per reference */}
                            <h3 className="text-xs leading-snug font-semibold text-foreground/90 sm:text-sm xl:text-[15px]">
                              {card.title}
                            </h3>
                          </div>

                          {/* Micro Metric Badge Footer (Kept as is) */}
                          <div className="flex items-center justify-between border-t border-border/50 pt-2.5 xl:pt-3">
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                              <MetricIcon card={card} />
                              <span>{card.metricValue}</span>
                            </div>

                            <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {card.badgeText}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </CardLink>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ----------------- MOBILE / TABLET RESPONSIVE VIEW (< lg) ----------------- */}
      <div
        className={cn(
          "relative block overflow-hidden lg:hidden",
          autoPlay ? "py-6 sm:py-10" : "py-16 sm:py-24",
        )}
      >
        <div className="container mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
            {badge}

            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {title} <br />
              <span className="bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
                {highlight}
              </span>
            </h2>
          </div>

          {/* Cards Grid */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ margin: "-40px", once: true }}
                  transition={{ delay: idx * 0.08, duration: 0.4 }}
                >
                  <CardLink card={card}>
                    <Card className="mb-0 h-full gap-0 overflow-hidden rounded-xl border border-border/70 bg-card py-0 shadow-sm">
                      <div className={cn("h-1.5 w-full", card.barColor)} />

                      <CardContent className="flex flex-col justify-between gap-3 p-4 sm:p-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex size-8.5 min-w-8.5 items-center justify-center rounded-lg sm:size-9 sm:min-w-9",
                              card.iconColor,
                            )}
                          >
                            <Icon className="size-4 sm:size-4.5" />
                          </div>

                          <h3 className="text-sm leading-snug font-semibold text-foreground/90">
                            {card.title}
                          </h3>
                        </div>

                        <div className="flex items-center justify-between border-t border-border/50 pt-3">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                            <MetricIcon card={card} />
                            <span>{card.metricValue}</span>
                          </div>

                          <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {card.badgeText}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </CardLink>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
