"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  AudioLines,
  Bot,
  ClipboardList,
  MapPin,
  MessageCircle,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BackgroundCubesGrid } from "@/components/ui/background-cubes-grid";

/**
 * Landing hero, built on Aceternity UI's "Background Cubes Grid" demo.
 * Structure, timings and classes follow the source; the pills name STS AI's own services
 * instead of chat platforms.
 */

type Service = { word: string; bg: string; fg: string; icon: LucideIcon };

const services: Service[] = [
  { word: "Chat AI", bg: "#4F46E5", fg: "#fff", icon: MessageCircle },
  { word: "Voice AI", bg: "#fff", fg: "#FF5A1F", icon: AudioLines },
  { word: "Lead Finder", bg: "#EA4335", fg: "#fff", icon: MapPin },
  { word: "Tour Wizard", bg: "#fff", fg: "#7C3AED", icon: WandSparkles },
  { word: "Form AI", bg: "#0F766E", fg: "#fff", icon: ClipboardList },
  { word: "AI Agents", bg: "#fcd462", fg: "#241a00", icon: Bot },
];

const EASE_OUT = [0.215, 0.61, 0.355, 1] as const;
const STAGGER = 0.09;
const START = 0.15;
// Reduced motion: the source uses `initial={false}`, but the server can't know the preference, so
// under SSR that differs from the client's first render (hydration mismatch). Keeping `initial`
// identical and finishing instantly gives the same result with matching markup.
const INSTANT = { duration: 0 } as const;

const TONES = {
  light: {
    heading: "text-[#111]",
    body: "text-neutral-500",
    note: "text-neutral-400",
    pill: "bg-white text-[#111] shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.06)]",
    primary: "bg-[#111] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-neutral-800",
    secondary: "text-[#111] hover:bg-black/[0.04]",
  },
  // Dark version to match the app's dark theme (background #0a0a0a, cards #171717).
  dark: {
    heading: "text-neutral-50",
    body: "text-neutral-400",
    note: "text-neutral-500",
    pill: "bg-neutral-900 text-neutral-50 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.4)]",
    primary: "bg-neutral-50 text-[#111] hover:bg-neutral-200",
    secondary: "text-neutral-50 hover:bg-white/[0.06]",
  },
};

// Near-black cube faces with a faint violet cast, lit by the app's button purple
// (rgba(135, 49, 255) in `.iconBackground`).
const DARK_CUBES = {
  topColor: "#16131d",
  leftColor: "#0f0d14",
  rightColor: "#0a090e",
  glowColor: "#8731ff",
} as const;

type HeroTone = keyof typeof TONES;

function InlinePill({ service, delay, tone }: { service: Service; delay: number; tone: HeroTone }) {
  const reduceMotion = useReducedMotion();
  const Icon = service.icon;
  return (
    <motion.span
      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={reduceMotion ? INSTANT : { duration: 0.6, ease: EASE_OUT, delay }}
      className={cn(
        "mx-[0.06em] inline-flex translate-y-[-0.06em] items-center gap-[0.28em] rounded-full py-[0.08em] pr-[0.42em] pl-[0.1em] align-middle leading-none",
        TONES[tone].pill,
      )}
    >
      <span
        className="inline-flex size-[0.92em] items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
        style={{ backgroundColor: service.bg, color: service.fg }}
      >
        <Icon className="size-[0.5em]" strokeWidth={2.25} aria-hidden />
      </span>
      {service.word}
    </motion.span>
  );
}

// Signed-out visitors are sent to sign up / sign in; signed-in users (e.g. on /home) into the app.
const CTAS = {
  signedOut: {
    primary: { href: "/sign-up", label: "Build your AI team" },
    secondary: { href: "/sign-in", label: "Sign in" },
  },
  signedIn: {
    primary: { href: "/services", label: "Add a service" },
    secondary: { href: "/lead", label: "Find leads" },
  },
} as const;

function HeroContent({ tone, signedIn }: { tone: HeroTone; signedIn: boolean }) {
  const reduceMotion = useReducedMotion();
  const t = TONES[tone];
  const ctas = signedIn ? CTAS.signedIn : CTAS.signedOut;
  const [chatAi, voiceAi, leadFinder, tourWizard, formAi, aiAgents] = services;

  const pill = (s: Service, suffix = ""): ReactNode => (
    <span className="whitespace-nowrap">
      <InlinePill service={s} tone={tone} delay={START + services.indexOf(s) * STAGGER} />
      {suffix}
    </span>
  );

  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: reduceMotion ? INSTANT : { duration: 0.7, ease: EASE_OUT, delay },
  });

  return (
    <div className="pointer-events-none mx-auto flex max-w-[1080px] flex-col items-center text-center antialiased">
      <h1
        className={cn(
          "max-w-[24ch] text-[clamp(32px,4.6vw,58px)] leading-[1.32] font-medium tracking-[-0.03em] text-balance",
          t.heading,
        )}
      >
        Staff your business with {pill(chatAi, ",")} {pill(voiceAi, ",")} {pill(leadFinder, ",")}{" "}
        {pill(tourWizard, ",")} {pill(formAi)} and {pill(aiAgents)} that never clock out.
      </h1>

      <motion.p
        {...fadeUp(0.7)}
        className={cn("mt-8 max-w-[600px] text-[clamp(17px,1.5vw,19px)] leading-[1.6] text-pretty", t.body)}
      >
        STS AI answers every website chat, picks up the phone in a natural voice, walks visitors
        through your site and fills your calendar with scored local leads, in English and Multilingual.
      </motion.p>

      <motion.div
        {...fadeUp(0.8)}
        className="pointer-events-auto mt-9 flex flex-col items-center gap-2 sm:flex-row"
      >
        <Link
          href={ctas.primary.href}
          className={cn(
            "inline-flex h-11 items-center rounded-full px-5 text-[15px] font-medium transition-colors",
            t.primary,
          )}
        >
          {ctas.primary.label}
        </Link>
        <Link
          href={ctas.secondary.href}
          className={cn(
            "inline-flex h-11 items-center rounded-full px-5 text-[15px] font-medium transition-colors",
            t.secondary,
          )}
        >
          {ctas.secondary.label}
        </Link>
      </motion.div>

      <motion.p {...fadeUp(0.9)} className={cn("mt-4 text-[13px]", t.note)}>
        $49 one-time or $499 a month · No tiers, no surprises
      </motion.p>
    </div>
  );
}

export function LandingHero({
  className,
  signedIn = false,
  top,
  fullBleed = false,
}: {
  className?: string;
  /** Swap the sign-up / sign-in buttons for in-app links. */
  signedIn?: boolean;
  /** Content placed above the headline on the same cubes background (style it for a dark surface). */
  top?: ReactNode;
  /**
   * Pin the cubes to the viewport (right of the md+ sidebar) so they fill the whole app column,
   * behind the header and past the layout's padding, instead of only this box.
   */
  fullBleed?: boolean;
}) {
  const content = <HeroContent tone="dark" signedIn={signedIn} />;
  return (
    <div
      className={cn(
        "relative isolate flex min-h-[50rem] w-full items-center justify-center overflow-hidden px-5 py-24 sm:px-8",
        className,
      )}
    >
      <BackgroundCubesGrid
        className={cn("-z-10", fullBleed && "fixed inset-0 md:left-28")}
        {...DARK_CUBES}
      />
      {top ? (
        <div className="flex w-full max-w-[1080px] flex-col gap-24">
          {top}
          {content}
        </div>
      ) : (
        content
      )}
    </div>
  );
}
