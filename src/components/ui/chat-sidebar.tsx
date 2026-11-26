"use client"

// From chatcn, chat, voice and agent UI for shadcn: https://chatcn.dev

import * as React from "react"
import { forwardRef, createElement, type SVGAttributes, type ForwardRefExoticComponent, type RefAttributes } from "react"
import { cn } from "@/lib/utils"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

/** chatcn theme variables and utilities this file uses, light and dark. */
const CHATCN_CSS = ":root{--chatcn-accent:var(--chatcn-gray-1000);--chatcn-alpha-300:oklch(0 0 0 / 0.08);--chatcn-alpha-500:oklch(0 0 0 / 0.14);--chatcn-alpha-600:oklch(0 0 0 / 0.2);--chatcn-bg:oklch(1 0 0);--chatcn-bg-subtle:oklch(0.985 0 0);--chatcn-border:var(--chatcn-gray-400);--chatcn-border-strong:var(--chatcn-gray-600);--chatcn-card:oklch(1 0 0);--chatcn-ease-in-out:cubic-bezier(0.77, 0, 0.175, 1);--chatcn-ease-out:cubic-bezier(0.23, 1, 0.32, 1);--chatcn-ease-standard:ease;--chatcn-fg:var(--chatcn-gray-1000);--chatcn-fg-faint:var(--chatcn-gray-700);--chatcn-fg-muted:var(--chatcn-gray-900);--chatcn-fg-subtle:var(--chatcn-gray-800);--chatcn-fill:var(--chatcn-gray-100);--chatcn-fill-active:var(--chatcn-gray-300);--chatcn-fill-hover:var(--chatcn-gray-200);--chatcn-gray-100:oklch(0.970 0 0);--chatcn-gray-1000:oklch(0.145 0 0);--chatcn-gray-200:oklch(0.950 0 0);--chatcn-gray-300:oklch(0.930 0 0);--chatcn-gray-400:oklch(0.910 0 0);--chatcn-gray-600:oklch(0.800 0 0);--chatcn-gray-700:oklch(0.700 0 0);--chatcn-gray-800:oklch(0.525 0 0);--chatcn-gray-900:oklch(0.440 0 0);--chatcn-press-scale:0.97;--chatcn-press-scale-icon:0.94;--chatcn-primary:var(--chatcn-gray-1000);--chatcn-primary-fg:var(--chatcn-bg);--chatcn-primary-hover:var(--chatcn-gray-900);--chatcn-radius-lg:12px;--chatcn-radius-md:8px;--chatcn-radius-sm:6px;--chatcn-radius-xl:16px;--chatcn-radius-xs:4px;--chatcn-red:oklch(0.560 0.200 27);--chatcn-scrollbar:var(--chatcn-alpha-500);--chatcn-scrollbar-hover:var(--chatcn-alpha-600);--chatcn-shadow-border:0 0 0 1px oklch(0 0 0 / 0.08);--chatcn-shadow-lg:0 0 0 1px oklch(0 0 0 / 0.06), 0 4px 8px -2px oklch(0 0 0 / 0.06), 0 16px 32px -8px oklch(0 0 0 / 0.12);--chatcn-shadow-md:0 0 0 1px oklch(0 0 0 / 0.06), 0 2px 4px -1px oklch(0 0 0 / 0.06), 0 8px 16px -4px oklch(0 0 0 / 0.08);--chatcn-shadow-xs:0 0 0 1px oklch(0 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.04);--chatcn-surface:oklch(1 0 0)}.dark{--chatcn-accent:var(--chatcn-gray-1000);--chatcn-alpha-300:oklch(1 0 0 / 0.09);--chatcn-alpha-500:oklch(1 0 0 / 0.16);--chatcn-alpha-600:oklch(1 0 0 / 0.24);--chatcn-bg:oklch(0.145 0 0);--chatcn-bg-subtle:oklch(0.178 0 0);--chatcn-border:var(--chatcn-gray-400);--chatcn-border-strong:var(--chatcn-gray-600);--chatcn-card:oklch(0.175 0 0);--chatcn-fg:var(--chatcn-gray-1000);--chatcn-fg-faint:var(--chatcn-gray-700);--chatcn-fg-muted:var(--chatcn-gray-900);--chatcn-fg-subtle:var(--chatcn-gray-800);--chatcn-fill:var(--chatcn-gray-100);--chatcn-fill-active:var(--chatcn-gray-300);--chatcn-fill-hover:var(--chatcn-gray-200);--chatcn-gray-100:oklch(0.195 0 0);--chatcn-gray-1000:oklch(0.970 0 0);--chatcn-gray-200:oklch(0.225 0 0);--chatcn-gray-300:oklch(0.255 0 0);--chatcn-gray-400:oklch(0.285 0 0);--chatcn-gray-600:oklch(0.410 0 0);--chatcn-gray-700:oklch(0.500 0 0);--chatcn-gray-800:oklch(0.620 0 0);--chatcn-gray-900:oklch(0.720 0 0);--chatcn-primary:var(--chatcn-gray-1000);--chatcn-primary-fg:var(--chatcn-bg);--chatcn-primary-hover:var(--chatcn-gray-900);--chatcn-red:oklch(0.700 0.175 22);--chatcn-scrollbar:var(--chatcn-alpha-500);--chatcn-scrollbar-hover:var(--chatcn-alpha-600);--chatcn-shadow-border:0 0 0 1px oklch(1 0 0 / 0.08);--chatcn-shadow-lg:0 0 0 1px oklch(1 0 0 / 0.1), inset 0 1px 0 oklch(1 0 0 / 0.05), 0 16px 32px -8px oklch(0 0 0 / 0.6);--chatcn-shadow-md:0 0 0 1px oklch(1 0 0 / 0.09), inset 0 1px 0 oklch(1 0 0 / 0.04), 0 8px 16px -4px oklch(0 0 0 / 0.5);--chatcn-shadow-xs:0 0 0 1px oklch(1 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.4);--chatcn-surface:oklch(0.205 0 0)}.chatcn-focus{}.chatcn-focus:focus-visible{outline: 2px solid var(--chatcn-accent); outline-offset: 2px;}.chatcn-spin{animation: chatcn-spin 0.8s linear infinite;}.chatcn-scroll{scrollbar-width: thin; scrollbar-color: var(--chatcn-scrollbar) transparent;}.chatcn-scroll:hover{scrollbar-color: var(--chatcn-scrollbar-hover) transparent;}.chatcn-scroll::-webkit-scrollbar{width: 10px; height: 10px;}.chatcn-scroll::-webkit-scrollbar-track, .chatcn-scroll::-webkit-scrollbar-corner{background: transparent;}.chatcn-scroll::-webkit-scrollbar-thumb{background-color: var(--chatcn-scrollbar); background-clip: content-box; border: 3px solid transparent; border-radius: 9999px;}.chatcn-scroll::-webkit-scrollbar-thumb:hover{background-color: var(--chatcn-scrollbar-hover);}@keyframes chatcn-spin { to { transform: rotate(360deg); } }@media (prefers-reduced-motion: reduce){:root{--chatcn-press-scale:1;--chatcn-press-scale-icon:1;--chatcn-enter-scale:1}}"
if (typeof document !== "undefined" && !document.getElementById("chatcn-chat-sidebar")) {
  const style = document.createElement("style")
  style.id = "chatcn-chat-sidebar"
  style.textContent = CHATCN_CSS
  document.head.appendChild(style)
}

/* -------------------------------------------------------------------------------------------------
 * ChatSidebarAccount: the account row in the footer
 * -----------------------------------------------------------------------------------------------*/

export interface ChatSidebarAccountProps extends Omit<React.ComponentProps<"button">, "children"> {
  name: string
  /** One quiet line under the name: a plan, an email, a workspace. */
  detail?: string
  /** An image URL. Initials are drawn without one. */
  avatarUrl?: string
  /** Avatar only, with the name in a tooltip, for the rail. */
  compact?: boolean
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")
  ).toUpperCase()
}

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactElement
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  /** A shortcut hint shown after the label, for example `⌘C`. */
  shortcut?: React.ReactNode
}

export function Tooltip({ content, children, side = "top", align = "center", shortcut }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} align={align} sideOffset={6} className="z-50">
          <TooltipPrimitive.Popup
            data-slot="tooltip"
            className={cn(
              "rounded-(--chatcn-radius-sm) bg-(color:--chatcn-fg) text-[0.75rem]/[1rem] text-(color:--chatcn-bg) shadow-(--chatcn-shadow-md) flex max-w-xs origin-(--transform-origin) items-center gap-2 px-2 py-1 font-medium text-pretty",
              "ease-(--chatcn-ease-out) transition-[opacity,scale] duration-125",
              "data-[ending-style]:scale-97 data-[ending-style]:opacity-0 data-[ending-style]:duration-100 data-[starting-style]:scale-97 data-[starting-style]:opacity-0",
              // Once one tooltip is open, the next appears without animation. Reduced motion keeps
              // only the fade.
              "data-[instant]:transition-none motion-reduce:transition-opacity motion-reduce:data-[ending-style]:scale-100 motion-reduce:data-[starting-style]:scale-100",
            )}
          >
            {content}
            {shortcut ? <span className="font-normal opacity-60">{shortcut}</span> : null}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

/** Name, plan and avatar. Usually the trigger of an account menu: pass it as `render` to a `MenuTrigger`. */
export function ChatSidebarAccount({
  name,
  detail,
  avatarUrl,
  compact = false,
  className,
  ...props
}: ChatSidebarAccountProps) {
  // Initials are drawn as generated content: the avatar is a picture of the person, so the
  // compact button's visible label stays the name its tooltip shows, not "LM".
  const avatar = (
    <span
      aria-hidden="true"
      data-initials={avatarUrl ? undefined : initials(name)}
      className="bg-(color:--chatcn-fill-active) text-(color:--chatcn-fg) text-[0.75rem]/[1rem] grid size-7 shrink-0 place-items-center overflow-hidden rounded-full font-medium data-[initials]:before:content-[attr(data-initials)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- avatar from any host, as given */}
      {avatarUrl ? <img src={avatarUrl} alt="" className="size-full object-cover" /> : null}
    </span>
  )
  const button = (
    <button
      type="button"
      data-slot="chat-sidebar-account"
      aria-label={compact ? name : undefined}
      className={cn(
        "chatcn-focus rounded-(--chatcn-radius-md) flex min-w-0 items-center gap-2 outline-none select-none",
        "ease-(--chatcn-ease-standard) hover:bg-(color:--chatcn-fill) data-[popup-open]:bg-(color:--chatcn-fill-hover) transition-[background-color] duration-150",
        compact ? "size-9 justify-center pointer-coarse:size-11" : "h-11 w-full px-2 text-start",
        className,
      )}
      {...props}
    >
      {avatar}
      {compact ? null : (
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[0.875rem]/[1.25rem] tracking-[-0.003em] text-(color:--chatcn-fg) truncate font-medium">{name}</span>
          {detail ? (
            <span className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) truncate">{detail}</span>
          ) : null}
        </span>
      )}
    </button>
  )
  return compact ? (
    <Tooltip content={name} side="right">
      {button}
    </Tooltip>
  ) : (
    button
  )
}

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

/**
 * What a thread is doing right now.
 * - `streaming`: a response or an agent run is in progress.
 * - `needs-input`: the agent is waiting on an approval or a question.
 * - `failed`: the last run ended with an error.
 * - `unread`: a background run finished since the thread was last opened.
 */
type ThreadStatus = "idle" | "streaming" | "needs-input" | "failed" | "unread"

export interface ChatThread {
  id: string
  title: string
  /** Last activity. Sorts and groups the list. */
  updatedAt: Date | number | string
  pinned?: boolean
  status?: ThreadStatus
  /** Project the thread belongs to, if any. */
  projectId?: string
}

interface GroupThreadsOptions {
  /** Reference time for Today and Yesterday. Pass a fixed date for stable demos and tests. */
  now?: Date | number
  /** Put pinned threads in their own group at the top. Default true. */
  pinnedFirst?: boolean
  /** BCP 47 locale for month names. Defaults to the browser's. */
  locale?: string
  labels?: Partial<Record<"pinned" | "today" | "yesterday" | "week" | "month", string>>
}

/* -------------------------------------------------------------------------------------------------
 * ChatSidebar
 * -----------------------------------------------------------------------------------------------*/

export interface ChatSidebarProps extends Omit<React.ComponentProps<"aside">, "onSelect" | "onError"> {
  threads: ChatThread[]
  /** The open thread. */
  activeId?: string | null
  onSelect?: (id: string) => void
  /** Render rows as links. */
  getHref?: (thread: ChatThread) => string
  onNewChat?: () => void
  onRename?: (id: string, title: string) => void
  /**
   * Called when a delete is final: after the undo window, or at once when `undoMs` is 0. The row
   * leaves the list immediately either way.
   */
  onDelete?: (id: string) => void
  onPinChange?: (id: string, pinned: boolean) => void
  onShare?: (id: string) => void
  /** Extra menu items for a row, before Delete. */
  renderMenuItems?: (thread: ChatThread) => React.ReactNode
  /** How long Undo stays available, in ms. Default 5000. */
  undoMs?: number

  /** Skeleton rows instead of the list. */
  loading?: boolean
  /** The list failed to load. A string replaces the default message. */
  error?: boolean | string
  onRetry?: () => void

  /** Product name or logo, at the start of the top row. */
  brand?: React.ReactNode
  /** Under the top row: a `ProjectSwitcher`, an `AppModeSwitcher`. */
  header?: React.ReactNode
  /** Bottom of the sidebar: usually a `ChatSidebarAccount`. */
  footer?: React.ReactNode
  /** Icon-only versions of `header` and `footer` for the collapsed rail. */
  railHeader?: React.ReactNode
  railFooter?: React.ReactNode

  /** Show the filter field. Default true. */
  search?: boolean
  searchPlaceholder?: string
  /** Rail Search button. Defaults to expanding the sidebar and focusing the filter. */
  onSearchClick?: () => void

  /** Desktop rail mode. Controlled; inside `ChatLayout` the layout owns it by default. */
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  /** Width in px while expanded. Controlled or uncontrolled. */
  width?: number
  defaultWidth?: number
  onWidthChange?: (width: number) => void
  minWidth?: number
  maxWidth?: number
  /** Drag handle on the inline-end edge. Default true. */
  resizable?: boolean

  /** Grouping options: a fixed `now` for stable demos, labels, locale. */
  grouping?: GroupThreadsOptions
  /** Bind Cmd/Ctrl+Shift+O to New chat. Default true when `onNewChat` is set. */
  hotkeys?: boolean
  newChatHotkey?: string
  sidebarHotkey?: string
}

/**
 * How a sidebar toggle was triggered. Keyboard toggles never animate, pointer toggles do.
 */
type ChatcnShellToggleSource = "keyboard" | "pointer"

interface ChatcnShellLayoutValue {
  /** Below the mobile breakpoint, or forced with `layout="mobile"`. */
  mobile: boolean
  /** Desktop: the sidebar is a 52 px icon rail. */
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean, source?: ChatcnShellToggleSource) => void
  /** Mobile: the drawer is open. */
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean, source?: ChatcnShellToggleSource) => void
  /** Collapses or expands on desktop, opens or closes the drawer on mobile. */
  toggleSidebar: (source?: ChatcnShellToggleSource) => void
  /** The last toggle came from the keyboard, so the next transition is skipped. */
  instant: boolean
  /** Id of the sidebar element, for `aria-controls` on toggles. */
  sidebarId: string
  /** Id of the main region, for skip links. */
  mainId: string
}

const ChatcnShellLayoutContext = React.createContext<ChatcnShellLayoutValue | null>(null)

/**
 * The surrounding `ChatLayout`, or null when a sidebar or header is used on its own. Shell parts
 * read it to place the sidebar toggle, close the mobile drawer after navigation and skip
 * animations after keyboard toggles.
 */
export function useChatcnShellLayout() {
  return React.useContext(ChatcnShellLayoutContext)
}

/** Where the sidebar is drawn right now. */
type ChatcnShellSidebarPlacement = "inline" | "drawer"

const ChatcnShellSidebarPlacementContext =
  React.createContext<ChatcnShellSidebarPlacement>("inline")

/** `drawer` while the sidebar renders inside the mobile drawer. */
function useChatcnShellSidebarPlacement() {
  return React.useContext(ChatcnShellSidebarPlacementContext)
}

function noopSubscribe() {
  return () => {}
}

/** True on macOS, iOS and iPadOS, where `mod` means Cmd. */
function isApplePlatform() {
  if (typeof navigator === "undefined") return false
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    ""
  return /mac|iphone|ipad|ipod/i.test(platform)
}

/** Client-side platform check that renders the same on the server and the first client pass. */
function useApplePlatform() {
  return React.useSyncExternalStore(noopSubscribe, isApplePlatform, () => true)
}

/* -------------------------------------------------------------------------------------------------
 * Undo toast for deletes
 * -----------------------------------------------------------------------------------------------*/

interface PendingDelete {
  thread: ChatThread
  key: number
}

/* -------------------------------------------------------------------------------------------------
 * Matching
 *
 * Two matchers share one result shape, a score and the ranges to emphasize:
 * - `fuzzyMatch` for short labels (command palette, thread titles): the query letters in order,
 *   rewarded for word starts and runs, so "nwc" finds "New chat" and "rspg" finds "Runs page".
 * - `findTerms` for full text (chat search): every word of the query as a substring, so the
 *   snippet shows exactly what matched.
 * -----------------------------------------------------------------------------------------------*/

/** Half-open `[start, end)` character ranges into the searched text. */
type MatchRange = readonly [start: number, end: number]

/* -------------------------------------------------------------------------------------------------
 * useChatcnShellFuzzy
 * -----------------------------------------------------------------------------------------------*/

interface FuzzyItem<T> {
  item: T
  score: number
  /** Ranges in the label, for emphasis. */
  ranges: MatchRange[]
}

interface FuzzyResult {
  /** Higher is better. Comparable between items for the same query only. */
  score: number
  ranges: MatchRange[]
}

/** Lowercase and strip accents so "resume" finds "Résumé", only when lengths (and ranges) hold. */
function fold(text: string) {
  const lower = text.toLowerCase()
  const stripped = lower.normalize("NFD").replace(/\p{M}/gu, "")
  return stripped.length === lower.length ? stripped : lower
}

const WORD_BREAK = /[\s\-_/.:,()[\]]/

function mergeRanges(ranges: MatchRange[]): MatchRange[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const out: [number, number][] = []
  for (const [s, e] of sorted) {
    const last = out[out.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else out.push([s, e])
  }
  return out
}

/**
 * Subsequence match for labels. Returns null when the query letters do not all appear in order.
 * Contiguous substrings and word-start hits rank first.
 */
function fuzzyMatch(query: string, text: string): FuzzyResult | null {
  const q = fold(query.trim())
  if (!q) return { score: 0, ranges: [] }
  const t = fold(text)

  // A direct substring is the strongest signal; prefer one that starts a word.
  let best = -1
  for (let i = t.indexOf(q); i !== -1; i = t.indexOf(q, i + 1)) {
    if (best === -1) best = i
    if (i === 0 || WORD_BREAK.test(t[i - 1] ?? "")) {
      best = i
      break
    }
  }
  if (best !== -1) {
    const atStart = best === 0 || WORD_BREAK.test(t[best - 1] ?? "")
    return {
      score: 1000 + (atStart ? 200 : 0) - best - (t.length - q.length) * 0.5,
      ranges: [[best, best + q.length]],
    }
  }

  // Multi-word queries: every word as a substring, in any order ("page runs").
  const words = q.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    const ranges: MatchRange[] = []
    for (const word of words) {
      const at = t.indexOf(word)
      if (at === -1) {
        ranges.length = 0
        break
      }
      ranges.push([at, at + word.length])
    }
    if (ranges.length)
      return { score: 600 - (t.length - q.length) * 0.5, ranges: mergeRanges(ranges) }
  }

  // Subsequence, greedy but preferring word starts.
  const needle = q.replace(/\s+/g, "")
  const ranges: [number, number][] = []
  let score = 0
  let ti = 0
  let prev = -2
  for (const ch of needle) {
    // Continuing a run beats jumping ahead; otherwise look for this letter at a word start
    // before settling for the next occurrence.
    let found = prev === ti - 1 && t[ti] === ch ? ti : -1
    for (let j = ti; found !== ti && j < t.length; j++) {
      if (t[j] !== ch) continue
      if (found === -1) found = j
      if (j === 0 || WORD_BREAK.test(t[j - 1] ?? "")) {
        found = j
        break
      }
    }
    if (found === -1) return null
    const wordStart = found === 0 || WORD_BREAK.test(t[found - 1] ?? "")
    score += wordStart ? 12 : 1
    if (found === prev + 1) {
      score += 6
      const last = ranges[ranges.length - 1]
      if (last) last[1] = found + 1
    } else {
      score -= Math.min(found - ti, 8) * 0.5
      ranges.push([found, found + 1])
    }
    prev = found
    ti = found + 1
  }
  // Letters scattered through the middle of words read as noise ("rate" in "Compare Bun and
  // Node for the"). Allow one stray letter; acronyms like "nwc" for "New chat" still match.
  const strays = ranges.filter(
    ([start, end]) => end - start === 1 && start > 0 && !WORD_BREAK.test(t[start - 1] ?? ""),
  ).length
  if (strays > 1) return null
  return { score: score - t.length * 0.05, ranges }
}

/**
 * Filters and ranks `items` by a fuzzy match on `getLabel` (plus `getKeywords`, which match but
 * are never highlighted). With an empty query, every item comes back in its original order.
 */
function useChatcnShellFuzzy<T>(
  items: readonly T[],
  query: string,
  getLabel: (item: T) => string,
  getKeywords?: (item: T) => string | undefined,
): FuzzyItem<T>[] {
  const labelRef = React.useRef(getLabel)
  labelRef.current = getLabel
  const keywordsRef = React.useRef(getKeywords)
  keywordsRef.current = getKeywords
  return React.useMemo(() => {
    const q = query.trim()
    if (!q) return items.map((item) => ({ item, score: 0, ranges: [] }))
    const out: (FuzzyItem<T> & { index: number })[] = []
    items.forEach((item, index) => {
      const label = labelRef.current(item)
      const hit = fuzzyMatch(q, label)
      const keywords = keywordsRef.current?.(item)
      const extra = !hit && keywords ? fuzzyMatch(q, keywords) : null
      if (hit) out.push({ item, score: hit.score, ranges: hit.ranges, index })
      else if (extra) out.push({ item, score: extra.score * 0.6, ranges: [], index })
    })
    return out
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ index: _index, ...rest }) => rest)
  }, [items, query])
}

interface ThreadGroup<T extends ChatThread = ChatThread> {
  id: string
  label: string
  threads: T[]
}

function startOfDay(time: number) {
  const d = new Date(time)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function toTime(value: ChatThread["updatedAt"]) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime()
}

/* -------------------------------------------------------------------------------------------------
 * Grouping
 * -----------------------------------------------------------------------------------------------*/

const DAY = 86_400_000

/**
 * Sorts threads by last activity and groups them the way chat apps do: Pinned, Today, Yesterday,
 * Previous 7 days, Previous 30 days, then one group per month ("September", or "September 2025"
 * outside the current year). Empty groups are left out.
 */
function groupThreadsByDate<T extends ChatThread>(
  threads: readonly T[],
  { now = Date.now(), pinnedFirst = true, locale, labels = {} }: GroupThreadsOptions = {},
): ThreadGroup<T>[] {
  const today = startOfDay(typeof now === "number" ? now : now.getTime())
  const year = new Date(today).getFullYear()
  const sorted = [...threads].sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt))
  const groups = new Map<string, ThreadGroup<T>>()
  const add = (id: string, label: string, thread: T) => {
    let group = groups.get(id)
    if (!group) {
      group = { id, label, threads: [] }
      groups.set(id, group)
    }
    group.threads.push(thread)
  }
  if (pinnedFirst)
    groups.set("pinned", { id: "pinned", label: labels.pinned ?? "Pinned", threads: [] })
  for (const thread of sorted) {
    if (pinnedFirst && thread.pinned) {
      add("pinned", labels.pinned ?? "Pinned", thread)
      continue
    }
    const time = toTime(thread.updatedAt)
    if (time >= today) add("today", labels.today ?? "Today", thread)
    else if (time >= today - DAY) add("yesterday", labels.yesterday ?? "Yesterday", thread)
    else if (time >= today - 7 * DAY) add("week", labels.week ?? "Previous 7 days", thread)
    else if (time >= today - 30 * DAY) add("month", labels.month ?? "Previous 30 days", thread)
    else {
      const date = new Date(time)
      const sameYear = date.getFullYear() === year
      const label = new Intl.DateTimeFormat(locale, {
        month: "long",
        year: sameYear ? undefined : "numeric",
      }).format(date)
      add(`${date.getFullYear()}-${date.getMonth()}`, label, thread)
    }
  }
  return [...groups.values()].filter((g) => g.threads.length > 0)
}

/* -------------------------------------------------------------------------------------------------
 * Hotkey strings
 *
 * A hotkey is a `+` separated combo, case insensitive: `mod+k`, `mod+shift+o`, `mod+/`, `shift+?`,
 * `escape`, `/`. `mod` is Cmd on Apple platforms and Ctrl everywhere else, so one binding works on
 * every keyboard. Several combos can share a handler: `"mod+k, mod+p"`.
 * -----------------------------------------------------------------------------------------------*/

type HotkeyHandler = (event: KeyboardEvent) => void

interface HotkeyOptions {
  /** Skip the binding without unbinding it. */
  enabled?: boolean
  /**
   * Fire while focus is in a text field. Defaults to true for combos with Cmd, Ctrl or Alt and
   * false for bare keys, so typing `/` in the composer never steals focus.
   */
  allowInInput?: boolean
  /** Call `preventDefault` when the combo fires. Default true. */
  preventDefault?: boolean
}

type HotkeyMap = Record<string, HotkeyHandler | ({ handler: HotkeyHandler } & HotkeyOptions)>

/* -------------------------------------------------------------------------------------------------
 * useChatcnHotkeys
 * -----------------------------------------------------------------------------------------------*/

interface UseChatcnHotkeysOptions {
  /** Turn every binding off at once, for example while a dialog owns the keyboard. */
  enabled?: boolean
  /** Listen on this element instead of the window. */
  target?: React.RefObject<HTMLElement | null>
}

interface ParsedHotkey {
  key: string
  mod: boolean
  meta: boolean
  ctrl: boolean
  shift: boolean
  alt: boolean
}

const KEY_ALIASES: Record<string, string> = {
  esc: "escape",
  return: "enter",
  space: " ",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  del: "delete",
  plus: "+",
  // "," separates alternative combos, so the comma key is spelled out: `mod+comma`.
  comma: ",",
}

function parseHotkey(combo: string): ParsedHotkey {
  // A trailing "+" is the plus key itself, so `mod++` is Cmd and plus.
  const parts = combo.trim().toLowerCase().replace(/\+\+$/, "+plus").split("+")
  const parsed: ParsedHotkey = {
    key: "",
    mod: false,
    meta: false,
    ctrl: false,
    shift: false,
    alt: false,
  }
  for (const raw of parts) {
    const part = raw.trim()
    if (part === "mod") parsed.mod = true
    else if (part === "meta" || part === "cmd" || part === "command") parsed.meta = true
    else if (part === "ctrl" || part === "control") parsed.ctrl = true
    else if (part === "shift") parsed.shift = true
    else if (part === "alt" || part === "option") parsed.alt = true
    else parsed.key = KEY_ALIASES[part] ?? part
  }
  return parsed
}

/** Shifted symbols arrive as their own key on US layouts (`?` for Shift+/), so accept both. */
const SHIFTED: Record<string, string> = { "?": "/", "<": ",", ">": ".", ":": ";", "{": "[" }

function matchesHotkey(event: KeyboardEvent, hotkey: ParsedHotkey, apple = isApplePlatform()) {
  const wantMeta = hotkey.meta || (hotkey.mod && apple)
  const wantCtrl = hotkey.ctrl || (hotkey.mod && !apple)
  if (event.metaKey !== wantMeta || event.ctrlKey !== wantCtrl || event.altKey !== hotkey.alt)
    return false
  const key = event.key?.toLowerCase() ?? ""
  // Shift is implied by symbols like `?`, so only check it for letters, digits and named keys.
  const symbol = key.length === 1 && !/[a-z0-9]/.test(key)
  if (!symbol && event.shiftKey !== hotkey.shift) return false
  if (key === hotkey.key) return true
  if (SHIFTED[key] === hotkey.key && hotkey.shift) return true
  // Alt and Option remap letters on macOS (Option+K is "˚"), so fall back to the physical key.
  const code = event.code?.toLowerCase() ?? ""
  return code === `key${hotkey.key}` || code === `digit${hotkey.key}`
}

function isEditable(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el || typeof el.closest !== "function") return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === "TEXTAREA" || tag === "SELECT") return true
  if (tag !== "INPUT") return false
  const type = (el as HTMLInputElement).type
  return !["button", "checkbox", "radio", "range", "submit", "reset", "color", "file"].includes(
    type,
  )
}

/**
 * Global keyboard shortcuts for app chrome. Handlers can change on every render without
 * re-binding. Never fires during IME composition, on auto-repeat for toggles, or for bare keys
 * while the user types in a field.
 */
function useChatcnHotkeys(
  map: HotkeyMap,
  { enabled = true, target }: UseChatcnHotkeysOptions = {},
) {
  const mapRef = React.useRef(map)
  mapRef.current = map
  const signature = Object.keys(map).join("|")

  React.useEffect(() => {
    if (!enabled) return
    const bindings = signature
      .split("|")
      .filter(Boolean)
      .map((combo) => ({ combo, parsed: combo.split(",").map(parseHotkey) }))
    const apple = isApplePlatform()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229 || event.defaultPrevented) return
      for (const { combo, parsed } of bindings) {
        const entry = mapRef.current[combo]
        if (!entry) continue
        const { handler, ...options } = typeof entry === "function" ? { handler: entry } : entry
        if (options.enabled === false) continue
        const hit = parsed.find((p) => matchesHotkey(event, p, apple))
        if (!hit) continue
        const modified = hit.mod || hit.meta || hit.ctrl || hit.alt
        const allowInInput = options.allowInInput ?? modified
        if (!allowInInput && isEditable(event.target)) continue
        if (event.repeat && modified) {
          event.preventDefault()
          return
        }
        if (options.preventDefault !== false) event.preventDefault()
        handler(event)
        return
      }
    }
    const node: HTMLElement | Window = target?.current ?? window
    node.addEventListener("keydown", onKeyDown as EventListener)
    return () => node.removeEventListener("keydown", onKeyDown as EventListener)
  }, [enabled, signature, target])
}

/* -------------------------------------------------------------------------------------------------
 * ThreadListItem
 * -----------------------------------------------------------------------------------------------*/

interface ThreadListItemProps extends Omit<React.ComponentProps<"li">, "title" | "onSelect"> {
  /** Used for keyboard focus tracking. */
  threadId: string
  title: string
  status?: ThreadStatus
  /** The open thread. Sets `aria-current="page"`. */
  active?: boolean
  pinned?: boolean
  /** Render the row as a link. Otherwise it is a button that calls `onSelect`. */
  href?: string
  onSelect?: () => void
  /** Ranges of `title` to emphasize, from a filter. */
  highlight?: readonly MatchRange[]
  /** Shows Rename in the menu and enables double-click and F2. */
  onRename?: (title: string) => void
  /** Shows Delete in the menu and enables the Delete key. */
  onDelete?: () => void
  /** Shows Pin or Unpin in the menu. */
  onPinChange?: (pinned: boolean) => void
  /** Shows Share in the menu. */
  onShare?: () => void
  /** Extra `MenuItem`s, placed before Delete. */
  menuItems?: React.ReactNode
  /** Controlled inline rename. */
  renaming?: boolean
  onRenamingChange?: (renaming: boolean) => void
  /** Text shown while the title is empty. Default "New chat". */
  placeholder?: string
}

/** Splits text into plain and matched segments, for rendering `<mark>` around the matches. */
function splitByRanges(text: string, ranges: readonly MatchRange[]) {
  const out: { text: string; match: boolean }[] = []
  let at = 0
  for (const [s, e] of ranges) {
    if (s > at) out.push({ text: text.slice(at, s), match: false })
    if (e > s) out.push({ text: text.slice(s, e), match: true })
    at = Math.max(at, e)
  }
  if (at < text.length) out.push({ text: text.slice(at), match: false })
  return out
}

/* -------------------------------------------------------------------------------------------------
 * Title with match emphasis
 * -----------------------------------------------------------------------------------------------*/

function HighlightedTitle({ text, ranges }: { text: string; ranges?: readonly MatchRange[] }) {
  if (!ranges?.length) return <>{text}</>
  return (
    <>
      {splitByRanges(text, ranges).map((segment, i) =>
        segment.match ? (
          <mark key={`${i}-${segment.text}`} className="text-(color:--chatcn-fg) bg-transparent font-medium">
            {segment.text}
          </mark>
        ) : (
          <span key={`${i}-${segment.text}`} className="text-(color:--chatcn-fg-muted)">
            {segment.text}
          </span>
        ),
      )}
    </>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Rename field
 * -----------------------------------------------------------------------------------------------*/

function RenameField({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string
  onCommit: (title: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = React.useState(initial)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const composing = React.useRef(false)
  const done = React.useRef(false)

  React.useLayoutEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
    inputRef.current?.select()
  }, [])

  const commit = () => {
    if (done.current) return
    done.current = true
    const next = value.trim()
    if (next && next !== initial) onCommit(next)
    else onCancel()
  }

  return (
    <input
      ref={inputRef}
      data-slot="thread-rename"
      aria-label="Chat title"
      value={value}
      maxLength={200}
      onChange={(event) => setValue(event.target.value)}
      onCompositionStart={() => {
        composing.current = true
      }}
      onCompositionEnd={() => {
        window.setTimeout(() => {
          composing.current = false
        }, 0)
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.nativeEvent.isComposing || composing.current || event.keyCode === 229) return
        if (event.key === "Enter") {
          event.preventDefault()
          commit()
        } else if (event.key === "Escape") {
          event.preventDefault()
          done.current = true
          onCancel()
        }
      }}
      onBlur={commit}
      className={cn(
        // The row itself becomes editable: same height, radius and text position, with one inset
        // accent hairline instead of a separate input box.
        "rounded-(--chatcn-radius-md) bg-(color:--chatcn-card) text-(color:--chatcn-fg) text-[0.875rem]/[1.25rem] tracking-[-0.003em] h-8 w-full min-w-0 px-2 outline-none",
        "caret-(color:--chatcn-accent) selection:bg-(color:--chatcn-accent)/20 shadow-[inset_0_0_0_1px_var(--chatcn-accent)]",
        "pointer-coarse:text-[1rem]/[1.5rem] pointer-coarse:tracking-[-0.01em] pointer-coarse:h-11",
      )}
    />
  )
}

/* -------------------------------------------------------------------------------------------------
 * Status indicator
 * -----------------------------------------------------------------------------------------------*/

const STATUS_LABEL: Record<Exclude<ThreadStatus, "idle">, string> = {
  streaming: "Generating",
  "needs-input": "Needs your input",
  failed: "Failed",
  unread: "Unread",
}

/** The kit's one spinner. 0.8 s per turn, slowed to 1.2 s under reduced motion. */
function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-slot="spinner"
      className={cn("chatcn-spin size-3.5 shrink-0", className)}
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
      <path
        d="M8 1.75A6.25 6.25 0 0 1 14.25 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

interface IconProps extends SVGAttributes<SVGSVGElement> {
  /** Width and height. Number means px. Default 24. */
  size?: number | string
  /** Stroke width in viewBox units (24 grid). Default 1.5. */
  strokeWidth?: number | string
  /** Keep the rendered stroke at `strokeWidth` px at any size. */
  absoluteStrokeWidth?: boolean
  /** Stroke color. Default currentColor. */
  color?: string
  /** Accessible name. Renders <title> and sets role="img"; without it the icon is aria-hidden. */
  title?: string
}

export type Icon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>

/** Shape elements an icon may contain. */
type IconElement = "path" | "circle" | "rect" | "ellipse" | "line" | "polyline" | "polygon"

/** An icon's drawing: a flat list of [element, attributes] pairs, lucide compatible. */
export type IconNode = ReadonlyArray<readonly [IconElement, Readonly<Record<string, string>>]>

const toPascal = (name: string): string =>
  name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")

/**
 * Builds a React icon component from an icon node.
 * `name` is the kebab-case icon name, used for the class `chatcn-icon-<name>` and displayName.
 */
export function createIcon(name: string, iconNode: IconNode): Icon {
  // biome-ignore lint/correctness/noComponentHookFactories: runs once per icon at module load
  const Component = forwardRef<SVGSVGElement, IconProps>(function ChatcnIcon(
    {
      size = 24,
      strokeWidth = 1.5,
      absoluteStrokeWidth = false,
      color = "currentColor",
      title,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    const stroke = absoluteStrokeWidth
      ? (Number(strokeWidth) * 24) / Number.parseFloat(String(size))
      : strokeWidth
    const labelled = Boolean(title || rest["aria-label"] || rest["aria-labelledby"])
    return createElement(
      "svg",
      {
        ref,
        xmlns: "http://www.w3.org/2000/svg",
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: color,
        strokeWidth: stroke,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "data-slot": "icon",
        className: className
          ? `chatcn-icon chatcn-icon-${name} ${className}`
          : `chatcn-icon chatcn-icon-${name}`,
        ...(labelled ? { role: "img" } : { "aria-hidden": true }),
        ...rest,
      },
      title ? createElement("title", null, title) : null,
      ...iconNode.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs })),
      children,
    )
  })
  Component.displayName = `${toPascal(name)}Icon`
  return Component
}

const iconNode: IconNode = [
  ["path", {"d":"M6.25 14.5V8.25A1.75 1.75 0 0 1 8 6.5a1.75 1.75 0 0 1 1.75 1.75v3.25"}],
  ["path", {"d":"M9.75 11V6a1.75 1.75 0 0 1 1.75-1.75A1.75 1.75 0 0 1 13.25 6v5"}],
  ["path", {"d":"M13.25 11V7A1.75 1.75 0 0 1 15 5.25 1.75 1.75 0 0 1 16.75 7v4.5"}],
  ["path", {"d":"M16.75 12v-2a1.75 1.75 0 0 1 1.75-1.75A1.75 1.75 0 0 1 20.25 10v6.75a4.5 4.5 0 0 1-4.5 4.5H10.1a3 3 0 0 1-2.25-1.01l-4.32-4.89a1.25 1.25 0 0 1-.2-1.33l.02-.06a1.25 1.25 0 0 1 1.91-.48l.99.77"}],
]

const HandIcon: Icon = /* @__PURE__ */ createIcon("hand", iconNode)

const iconNode2: IconNode = [
  ["path", {"d":"M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0"}],
  ["path", {"d":"M12 7.75v5"}],
  ["path", {"d":"M12 16.25h.01"}],
]

const CircleAlertIcon: Icon = /* @__PURE__ */ createIcon("circle-alert", iconNode2)

/**
 * The small mark at the end of a row. Never color alone: each has a shape and a spoken label.
 * Nothing pulses; a spinner is the only motion, and only while something is running.
 */
function ThreadStatusIndicator({
  status = "idle",
  className,
}: {
  status?: ThreadStatus
  className?: string
}) {
  if (status === "idle") return null
  const label = STATUS_LABEL[status]
  return (
    <span
      data-slot="thread-status"
      data-thread-status={status}
      className={cn("grid size-4 shrink-0 place-items-center", className)}
    >
      {status === "streaming" ? (
        <Spinner className="text-(color:--chatcn-fg-subtle) size-3.5" />
      ) : status === "needs-input" ? (
        <HandIcon aria-hidden="true" className="text-(color:--chatcn-fg) size-3.5" />
      ) : status === "failed" ? (
        <CircleAlertIcon aria-hidden="true" className="text-(color:--chatcn-red) size-3.5" />
      ) : (
        <span aria-hidden="true" className="bg-(color:--chatcn-accent) size-1.5 rounded-full" />
      )}
      <span className="sr-only">{label}</span>
    </span>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Root and trigger
 * -----------------------------------------------------------------------------------------------*/

/** Root. Controlled with `open` and `onOpenChange`, or uncontrolled. Modal by default. */
export function Menu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root {...props} />
}

/** The button that opens the menu. Pass `render={<Button />}` to use your own element. */
export function MenuTrigger(props: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="menu-trigger" {...props} />
}

const iconNode3: IconNode = [
  ["path", {"d":"M4.9 12a.6.6 0 1 0 1.2 0 .6.6 0 1 0-1.2 0"}],
  ["path", {"d":"M11.4 12a.6.6 0 1 0 1.2 0 .6.6 0 1 0-1.2 0"}],
  ["path", {"d":"M17.9 12a.6.6 0 1 0 1.2 0 .6.6 0 1 0-1.2 0"}],
]

export const EllipsisIcon: Icon = /* @__PURE__ */ createIcon("ellipsis", iconNode3)

/* -------------------------------------------------------------------------------------------------
 * Content
 * -----------------------------------------------------------------------------------------------*/

interface MenuContentProps extends MenuPrimitive.Popup.Props {
  /** Default `bottom`. Flips when there is no room. */
  side?: MenuPrimitive.Positioner.Props["side"]
  /** Default `start`, so the menu lines up with the trigger's leading edge. */
  align?: MenuPrimitive.Positioner.Props["align"]
  /** Gap to the trigger in px. Default 6. */
  sideOffset?: MenuPrimitive.Positioner.Props["sideOffset"]
  alignOffset?: MenuPrimitive.Positioner.Props["alignOffset"]
  container?: MenuPrimitive.Portal.Props["container"]
}

/** Surface shared by popovers and menus: 12 px radius, surface fill, medium shadow. */
const popupSurface = cn(
  "bg-(color:--chatcn-surface) text-(color:--chatcn-fg) shadow-(--chatcn-shadow-md) rounded-(--chatcn-radius-lg) outline-none",
  "max-h-(--available-height) max-w-(--available-width)",
  // Shadows vanish in forced colors; keep an edge.
  "forced-colors:outline-1 forced-colors:outline-solid",
)

/* -------------------------------------------------------------------------------------------------
 * Motion
 *
 * Enter: opacity, scale from 0.96 and 4 px of travel away from the trigger, 180 ms ease-(--chatcn-ease-out),
 * growing out of the trigger through `--transform-origin`. Exit: 140 ms to scale 0.98, no travel.
 * Opened or dismissed with the keyboard, Base UI sets `data-instant` and nothing animates.
 * Reduced motion keeps the fade and drops scale and travel.
 * -----------------------------------------------------------------------------------------------*/

const popupMotion = cn(
  "ease-(--chatcn-ease-out) origin-(--transform-origin) transition-[opacity,scale,translate] duration-180",
  "data-[starting-style]:scale-96 data-[starting-style]:opacity-0",
  "data-[side=bottom]:data-[starting-style]:-translate-y-1 data-[side=top]:data-[starting-style]:translate-y-1",
  "data-[side=left]:data-[starting-style]:translate-x-1 data-[side=right]:data-[starting-style]:-translate-x-1",
  "data-[side=inline-end]:data-[starting-style]:-translate-x-1 data-[side=inline-start]:data-[starting-style]:translate-x-1",
  "data-[ending-style]:scale-98 data-[ending-style]:opacity-0 data-[ending-style]:duration-140",
  "data-[instant]:transition-none",
  "motion-reduce:translate-none! motion-reduce:scale-none!",
)

/** The floating list. Portalled, positioned and at least as wide as its trigger. */
export function MenuContent({
  side = "bottom",
  align = "start",
  sideOffset = 6,
  alignOffset = 0,
  container,
  className,
  ...props
}: MenuContentProps) {
  return (
    <MenuPrimitive.Portal container={container}>
      <MenuPrimitive.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        className="z-50 outline-none"
      >
        <MenuPrimitive.Popup
          data-slot="menu-content"
          className={cn(
            popupSurface,
            popupMotion,
            "chatcn-scroll min-w-[max(11rem,var(--anchor-width))] overflow-y-auto p-1",
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Items
 * -----------------------------------------------------------------------------------------------*/

interface MenuItemProps extends MenuPrimitive.Item.Props {
  /** Indent the label to line up with items that have an icon. */
  inset?: boolean
}

/* -------------------------------------------------------------------------------------------------
 * Geometry: a 12 px container with 4 px padding holds 8 px items, so the radii stay concentric.
 * Highlight is instant: menus are used too often for an animated hover.
 * -----------------------------------------------------------------------------------------------*/

const item = cn(
  "group/menu-item rounded-(--chatcn-radius-md) relative flex min-h-8 w-full cursor-default items-center gap-2 px-2 py-1.5",
  "text-[0.875rem]/[1.25rem] tracking-[-0.003em] text-(color:--chatcn-fg) text-start outline-none select-none",
  "data-[highlighted]:bg-(color:--chatcn-fill-hover) data-[popup-open]:bg-(color:--chatcn-fill)",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  "[&>svg]:text-(color:--chatcn-fg-subtle) data-[highlighted]:[&>svg]:text-(color:--chatcn-fg) [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  "pointer-coarse:min-h-11",
)

/** An action. Put an icon first and a `MenuShortcut` last; both are styled for you. */
export function MenuItem({ className, inset, ...props }: MenuItemProps) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      className={cn(item, inset && "ps-8", className)}
      {...props}
    />
  )
}

const iconNode4: IconNode = [
  ["path", {"d":"m3.79 18.63.87-2.6a1.5 1.5 0 0 1 .36-.58l9.65-9.65a2.5 2.5 0 0 1 3.53 0 2.5 2.5 0 0 1 0 3.53l-9.65 9.65a1.5 1.5 0 0 1-.58.36l-2.6.87a1.25 1.25 0 0 1-1.58-1.58"}],
  ["path", {"d":"m13.25 7.21 3.54 3.54"}],
]

const PencilIcon: Icon = /* @__PURE__ */ createIcon("pencil", iconNode4)

/** Shortcut hint at the end of an item, for example `⌘K`. Decorative: the item stays the name. */
function MenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="menu-shortcut"
      aria-hidden="true"
      className={cn("text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) ms-auto ps-3 tabular-nums", className)}
      {...props}
    />
  )
}

const iconNode5: IconNode = [
  ["path", {"d":"M9 2.75h6a1.5 1.5 0 0 1 1.5 1.5v.5a1 1 0 0 1-1 1h.25a1 1 0 0 0-1 1v2.8a1.5 1.5 0 0 0 .24.82l2 3.06a1.5 1.5 0 0 1-1.26 2.32H8.27a1.5 1.5 0 0 1-1.26-2.32l2-3.06a1.5 1.5 0 0 0 .24-.82v-2.8a1 1 0 0 0-1-1h.25a1 1 0 0 1-1-1v-.5A1.5 1.5 0 0 1 9 2.75"}],
  ["path", {"d":"M12 15.75v5.5"}],
]

const PinIcon: Icon = /* @__PURE__ */ createIcon("pin", iconNode5)

const iconNode6: IconNode = [
  ["path", {"d":"M4.5 11v6.75a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3V11"}],
  ["path", {"d":"m16 7.25-2.59-2.59a2 2 0 0 0-2.82 0L8 7.25"}],
  ["path", {"d":"M12 15.25v-7.5"}],
]

export const ShareIcon: Icon = /* @__PURE__ */ createIcon("share", iconNode6)

function MenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      data-slot="menu-separator"
      className={cn("bg-(color:--chatcn-border) -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

const iconNode7: IconNode = [
  ["path", {"d":"M3.5 6h17"}],
  ["path", {"d":"M10 3h4"}],
  ["path", {"d":"m5.75 9.25.6 9.41A2.5 2.5 0 0 0 8.85 21h6.3a2.5 2.5 0 0 0 2.5-2.34l.6-9.41"}],
  ["path", {"d":"M10 11.5V17"}],
  ["path", {"d":"M14 11.5V17"}],
]

const Trash2Icon: Icon = /* @__PURE__ */ createIcon("trash-2", iconNode7)

/**
 * One thread. The title fades out at the end instead of an ellipsis. Hover or focus reveals the
 * actions button in the same slot as the status mark, instantly, since rows are hovered all day.
 * Double-click or F2 renames in place: Enter saves, Escape cancels.
 */
function ThreadListItem({
  threadId,
  title,
  status = "idle",
  active = false,
  pinned = false,
  href,
  onSelect,
  highlight,
  onRename,
  onDelete,
  onPinChange,
  onShare,
  menuItems,
  renaming: renamingProp,
  onRenamingChange,
  placeholder = "New chat",
  className,
  ...props
}: ThreadListItemProps) {
  const [renamingState, setRenamingState] = React.useState(false)
  const renaming = renamingProp ?? renamingState
  const [menuOpen, setMenuOpen] = React.useState(false)
  const rowRef = React.useRef<HTMLElement>(null)
  const setRenaming = (next: boolean) => {
    if (renamingProp === undefined) setRenamingState(next)
    onRenamingChange?.(next)
  }
  const finishRename = () => {
    setRenaming(false)
    // Give focus back to the row so the keyboard user keeps their place.
    requestAnimationFrame(() => rowRef.current?.focus({ preventScroll: true }))
  }

  const hasMenu = Boolean(onRename || onDelete || onPinChange || onShare || menuItems)
  const shown = title || placeholder

  // A new title (for example the generated one replacing "New chat") fades in once.
  const [titleKey, setTitleKey] = React.useState(0)
  const prevTitle = React.useRef(title)
  React.useEffect(() => {
    if (prevTitle.current !== title && !renaming) setTitleKey((k) => k + 1)
    prevTitle.current = title
  }, [title, renaming])

  const rowClass = cn(
    "chatcn-focus rounded-(--chatcn-radius-md) flex h-8 w-full min-w-0 items-center gap-2 ps-2 pe-8 text-start outline-none select-none",
    "text-[0.875rem]/[1.25rem] tracking-[-0.003em] text-(color:--chatcn-fg) ease-(--chatcn-ease-standard) transition-[background-color] duration-150",
    "hover:bg-(color:--chatcn-fill) focus-visible:-outline-offset-2",
    "aria-[current=page]:bg-(color:--chatcn-fill-hover)",
    "pointer-coarse:h-11 pointer-coarse:pe-11",
    hasMenu && status !== "idle" && "pointer-coarse:pe-16",
  )

  const content = (
    <>
      <span
        key={titleKey}
        data-slot="thread-title"
        className={cn(
          "min-w-0 flex-1 overflow-hidden whitespace-nowrap",
          // A fade at the end reads better than an ellipsis in a narrow column.
          "[mask-image:linear-gradient(to_left,transparent,black_20px)] rtl:[mask-image:linear-gradient(to_right,transparent,black_20px)]",
          !title && "text-(color:--chatcn-fg-subtle)",
          titleKey > 0 && "ease-(--chatcn-ease-out) transition-opacity duration-200 starting:opacity-0",
        )}
      >
        <HighlightedTitle text={shown} ranges={title ? highlight : undefined} />
      </span>
    </>
  )

  const onRowKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "F2" && onRename) {
      event.preventDefault()
      setRenaming(true)
    } else if (
      (event.key === "Delete" || (event.key === "Backspace" && (event.metaKey || event.ctrlKey))) &&
      onDelete
    ) {
      event.preventDefault()
      onDelete()
    } else if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
      if (!hasMenu) return
      event.preventDefault()
      setMenuOpen(true)
    }
  }

  const rowProps = {
    "data-thread-row": "",
    "data-thread-id": threadId,
    "aria-current": active ? ("page" as const) : undefined,
    tabIndex: -1,
    className: rowClass,
    onKeyDown: onRowKeyDown,
    onDoubleClick: onRename
      ? (event: React.MouseEvent) => {
          event.preventDefault()
          setRenaming(true)
        }
      : undefined,
  }

  return (
    <li
      data-slot="thread-list-item"
      data-active={active ? "" : undefined}
      data-renaming={renaming ? "" : undefined}
      data-thread-item-state={status}
      className={cn("group/thread relative min-w-0", className)}
      {...props}
    >
      {renaming ? (
        <RenameField
          initial={title}
          onCommit={(next) => {
            onRename?.(next)
            finishRename()
          }}
          onCancel={finishRename}
        />
      ) : href ? (
        <a
          ref={rowRef as React.Ref<HTMLAnchorElement>}
          href={href}
          onClick={onSelect}
          {...rowProps}
        >
          {content}
        </a>
      ) : (
        <button
          ref={rowRef as React.Ref<HTMLButtonElement>}
          type="button"
          onClick={onSelect}
          {...rowProps}
        >
          {content}
        </button>
      )}

      {renaming ? null : (
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 end-1 flex items-center",
            "pointer-coarse:end-0",
          )}
        >
          {/* Status and actions share one slot; hover, focus and an open menu show the actions. */}
          <ThreadStatusIndicator
            status={status}
            className={cn(
              "me-1",
              hasMenu &&
                "pointer-coarse:me-12 pointer-fine:group-focus-within/thread:invisible pointer-fine:group-hover/thread:invisible",
              hasMenu && menuOpen && "pointer-fine:invisible",
            )}
          />
          {hasMenu ? (
            <Menu open={menuOpen} onOpenChange={setMenuOpen}>
              <MenuTrigger
                data-thread-more=""
                tabIndex={-1}
                aria-label={`More actions for ${shown}`}
                className={cn(
                  "chatcn-focus rounded-(--chatcn-radius-sm) text-(color:--chatcn-fg-subtle) pointer-events-auto absolute end-0 grid size-6 place-items-center outline-none",
                  "hover:text-(color:--chatcn-fg) data-[popup-open]:text-(color:--chatcn-fg) data-[popup-open]:bg-(color:--chatcn-fill-active) hover:bg-(color:--chatcn-fill-active)",
                  "opacity-0 group-focus-within/thread:opacity-100 group-hover/thread:opacity-100 data-[popup-open]:opacity-100",
                  // On touch there is no hover: the button stays visible and the status sits beside it.
                  "pointer-coarse:size-11 pointer-coarse:bg-transparent pointer-coarse:opacity-100",
                )}
              >
                <EllipsisIcon aria-hidden="true" className="size-4" />
              </MenuTrigger>
              <MenuContent align="start" className="w-48">
                {onRename ? (
                  <MenuItem onClick={() => setRenaming(true)}>
                    <PencilIcon />
                    Rename
                    <MenuShortcut>F2</MenuShortcut>
                  </MenuItem>
                ) : null}
                {onPinChange ? (
                  <MenuItem onClick={() => onPinChange(!pinned)}>
                    <PinIcon />
                    {pinned ? "Unpin" : "Pin"}
                  </MenuItem>
                ) : null}
                {onShare ? (
                  <MenuItem onClick={onShare}>
                    <ShareIcon />
                    Share…
                  </MenuItem>
                ) : null}
                {menuItems}
                {onDelete ? (
                  <>
                    {onRename || onPinChange || onShare || menuItems ? <MenuSeparator /> : null}
                    <MenuItem
                      onClick={onDelete}
                      className="text-(color:--chatcn-red) [&>svg]:text-(color:--chatcn-red) data-[highlighted]:[&>svg]:text-(color:--chatcn-red)"
                    >
                      <Trash2Icon />
                      Delete
                    </MenuItem>
                  </>
                ) : null}
              </MenuContent>
            </Menu>
          ) : null}
        </div>
      )}
    </li>
  )
}

const SYMBOLS_APPLE: Record<string, string> = {
  mod: "⌘",
  ctrl: "⌃",
  shift: "⇧",
  alt: "⌥",
}

const NAMES_OTHER: Record<string, string> = {
  meta: "Win",
  ctrl: "Ctrl",
  shift: "Shift",
  alt: "Alt",
}

const KEY_LABELS: Record<string, string> = {
  enter: "↵",
  escape: "Esc",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  backspace: "⌫",
  delete: "Del",
  tab: "Tab",
  " ": "Space",
  space: "Space",
  pageup: "Page Up",
  pagedown: "Page Down",
  home: "Home",
  end: "End",
  insert: "Ins",
  capslock: "Caps Lock",
}

/**
 * The keys of a combo as display labels, one per `Kbd`: `["⌘", "K"]` on a Mac and
 * `["Ctrl", "K"]` elsewhere. Pass `apple` to render one platform on the server.
 */
function hotkeyKeys(combo: string, apple = isApplePlatform()): string[] {
  const parsed = parseHotkey(combo.split(",")[0] ?? combo)
  const out: string[] = []
  if (apple) {
    // Apple order: Control, Option, Shift, Command.
    if (parsed.ctrl) out.push(SYMBOLS_APPLE.ctrl as string)
    if (parsed.alt) out.push(SYMBOLS_APPLE.alt as string)
    if (parsed.shift) out.push(SYMBOLS_APPLE.shift as string)
    if (parsed.mod || parsed.meta) out.push(SYMBOLS_APPLE.mod as string)
  } else {
    // Everywhere else: Ctrl, Win, Alt, Shift.
    if (parsed.ctrl || parsed.mod) out.push(NAMES_OTHER.ctrl as string)
    if (parsed.meta) out.push(NAMES_OTHER.meta as string)
    if (parsed.alt) out.push(NAMES_OTHER.alt as string)
    if (parsed.shift) out.push(NAMES_OTHER.shift as string)
  }
  const key = parsed.key
  out.push(
    KEY_LABELS[key] ??
      (key.length === 1 ? key.toUpperCase() : key[0]?.toUpperCase() + key.slice(1)),
  )
  return out
}

function reducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

const SLIDE_MS = 280

/* -------------------------------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------------------------*/

const RAIL_WIDTH = 52

type ButtonVariant = "solid" | "outline" | "ghost" | "subtle"

type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon-xs" | "icon-sm" | "icon-md" | "icon-lg"

interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const base = cn(
  "chatcn-focus inline-flex shrink-0 items-center justify-center gap-1.5 font-medium whitespace-nowrap select-none",
  "ease-(--chatcn-ease-standard) transition-[background-color,color,box-shadow,scale] duration-150",
  "active:scale-(--chatcn-press-scale) active:duration-100 disabled:pointer-events-none disabled:opacity-50",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0",
)

const variants: Record<ButtonVariant, string> = {
  solid: "bg-(color:--chatcn-primary) text-(color:--chatcn-primary-fg) hover:bg-(color:--chatcn-primary-hover)",
  outline: "bg-(color:--chatcn-card) text-(color:--chatcn-fg) shadow-(--chatcn-shadow-xs) hover:bg-(color:--chatcn-fill-hover)",
  ghost: "text-(color:--chatcn-fg-muted) hover:bg-(color:--chatcn-fill-hover) hover:text-(color:--chatcn-fg)",
  subtle: "bg-(color:--chatcn-fill) text-(color:--chatcn-fg) hover:bg-(color:--chatcn-fill-hover)",
}

// Heights follow the control scale: 24, 28, 32, 36. Radii stay concentric inside 12 px surfaces.
const sizes: Record<ButtonSize, string> = {
  xs: "h-6 rounded-(--chatcn-radius-sm) px-2 text-[0.75rem]/[1rem] [&_svg]:size-3.5",
  sm: "h-7 rounded-(--chatcn-radius-sm) px-2.5 text-[0.8125rem]/[1.25rem] [&_svg]:size-3.5",
  md: "h-8 rounded-(--chatcn-radius-md) px-3 text-[0.875rem]/[1.25rem] tracking-[-0.003em] [&_svg]:size-4",
  lg: "h-9 rounded-(--chatcn-radius-md) px-3.5 text-[0.875rem]/[1.25rem] tracking-[-0.003em] [&_svg]:size-4",
  "icon-xs": "size-6 rounded-(--chatcn-radius-sm) active:scale-(--chatcn-press-scale-icon) [&_svg]:size-3.5",
  "icon-sm": "size-7 rounded-(--chatcn-radius-sm) active:scale-(--chatcn-press-scale-icon) [&_svg]:size-3.5",
  "icon-md": "size-8 rounded-(--chatcn-radius-md) active:scale-(--chatcn-press-scale-icon) [&_svg]:size-4",
  "icon-lg": "size-9 rounded-(--chatcn-radius-md) active:scale-(--chatcn-press-scale-icon) [&_svg]:size-4",
}

/** Class names for anything that should look like a button, such as a link. */
function buttonVariants({
  variant = "ghost",
  size = "md",
}: {
  variant?: ButtonVariant
  size?: ButtonSize
} = {}) {
  return cn(base, variants[variant], sizes[size])
}

export function Button({
  variant = "ghost",
  size = "md",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      data-variant={variant}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------------------------------
 * Rail button
 * -----------------------------------------------------------------------------------------------*/

function RailButton({
  label,
  shortcut,
  ...props
}: React.ComponentProps<typeof Button> & { label: string; shortcut?: string }) {
  return (
    <Tooltip content={label} shortcut={shortcut} side="right">
      <Button
        size="icon-lg"
        variant="ghost"
        aria-label={label}
        className="text-(color:--chatcn-fg-muted) hover:text-(color:--chatcn-fg) pointer-coarse:size-11"
        {...props}
      />
    </Tooltip>
  )
}

/** One string for tooltips and menus: `⌘⇧O` on a Mac, `Ctrl+Shift+O` elsewhere. */
export function formatHotkey(combo: string, apple = isApplePlatform()) {
  return hotkeyKeys(combo, apple).join(apple ? "" : "+")
}

/** The `aria-keyshortcuts` value for a combo, covering both platforms for `mod`. */
export function hotkeyAria(combo: string) {
  return combo
    .split(",")
    .flatMap((single) => {
      const p = parseHotkey(single)
      const tail = [
        p.alt ? "Alt" : "",
        p.shift ? "Shift" : "",
        p.key.length === 1 ? p.key.toUpperCase() : p.key[0]?.toUpperCase() + p.key.slice(1),
      ].filter(Boolean)
      if (p.mod) return [["Meta", ...tail].join("+"), ["Control", ...tail].join("+")]
      return [[p.meta ? "Meta" : "", p.ctrl ? "Control" : "", ...tail].filter(Boolean).join("+")]
    })
    .join(" ")
}

/** A keyboard Enter or Space on a button arrives as a click with `detail === 0`. */
export function toggleSourceOf(
  event: { detail?: number; type?: string } | undefined,
): ChatcnShellToggleSource {
  if (!event) return "keyboard"
  if (event.type === "keydown" || event.type === "keyup") return "keyboard"
  return event.detail === 0 ? "keyboard" : "pointer"
}

const iconNode8: IconNode = [
  ["path", {"d":"M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3"}],
  ["path", {"d":"M9 6.25v11.5"}],
]

export const PanelLeftIcon: Icon = /* @__PURE__ */ createIcon("panel-left", iconNode8)

const iconNode9: IconNode = [
  ["path", {"d":"M5 12h14"}],
  ["path", {"d":"M12 5v14"}],
]

export const PlusIcon: Icon = /* @__PURE__ */ createIcon("plus", iconNode9)

const iconNode10: IconNode = [
  ["path", {"d":"M4 10.75a6.75 6.75 0 1 0 13.5 0 6.75 6.75 0 1 0-13.5 0"}],
  ["path", {"d":"m15.75 15.75 4.5 4.5"}],
]

const SearchIcon: Icon = /* @__PURE__ */ createIcon("search", iconNode10)

const iconNode11: IconNode = [
  ["path", {"d":"M5.49 17.46A8.5 8.5 0 1 0 6.54 5.49"}],
  ["path", {"d":"m8.21 8.65-2.94-.26a2 2 0 0 1-1.82-2.16l.26-2.94"}],
]

const RotateCcwIcon: Icon = /* @__PURE__ */ createIcon("rotate-ccw", iconNode11)

function UndoToast({
  pending,
  undoMs,
  onUndo,
  onExpire,
  apple,
}: {
  pending: PendingDelete | null
  undoMs: number
  onUndo: () => void
  onExpire: () => void
  apple: boolean
}) {
  const [hovered, setHovered] = React.useState(false)
  const expire = React.useRef(onExpire)
  expire.current = onExpire

  // Counts down only while visible and not hovered or focused, like a toast should. A new toast
  // starts fresh: the last one may have unmounted under the pointer without a pointerleave.
  const remaining = React.useRef(undoMs)
  const key = pending?.key
  React.useEffect(() => {
    remaining.current = undoMs
    if (key !== undefined) setHovered(false)
  }, [key, undoMs])
  React.useEffect(() => {
    if (!pending || hovered) return
    const started = Date.now()
    const id = window.setTimeout(() => expire.current(), remaining.current)
    return () => {
      window.clearTimeout(id)
      remaining.current = Math.max(800, remaining.current - (Date.now() - started))
    }
  }, [pending, hovered])

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-2 bottom-2 z-30 flex justify-center pb-[env(safe-area-inset-bottom)]"
    >
      {pending ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: hover and focus only pause the countdown
        <div
          key={pending.key}
          data-slot="chat-sidebar-undo"
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          className={cn(
            "bg-(color:--chatcn-surface) shadow-(--chatcn-shadow-lg) rounded-(--chatcn-radius-lg) pointer-events-auto flex w-full min-w-0 items-center gap-2 py-1.5 ps-3 pe-1.5",
            "forced-colors:outline-1 forced-colors:outline-solid",
            // Toast motion: 400 ms rise on the plain ease, opacity only under reduced motion.
            "ease-(--chatcn-ease-standard) transition-[opacity,translate] duration-400 starting:translate-y-[calc(100%+0.5rem)] starting:opacity-0",
            "motion-reduce:starting:translate-y-0",
          )}
        >
          <p className="text-[0.8125rem]/[1.25rem] text-(color:--chatcn-fg) min-w-0 flex-1 truncate">
            Deleted{" "}
            <span className="text-(color:--chatcn-fg-muted)">{pending.thread.title || "New chat"}</span>
          </p>
          <Tooltip content="Undo" shortcut={formatHotkey("mod+z", apple)}>
            <Button
              size="xs"
              variant="subtle"
              onClick={onUndo}
              aria-keyshortcuts={hotkeyAria("mod+z")}
              className="pointer-coarse:h-9"
            >
              <RotateCcwIcon />
              Undo
            </Button>
          </Tooltip>
        </div>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Skeleton
 * -----------------------------------------------------------------------------------------------*/

const SKELETON_WIDTHS = ["72%", "54%", "86%", "61%", "78%", "45%", "68%", "83%"]

/** Placeholder rows that match the real layout. Static: no shimmer and no pulse. */
function ThreadListSkeleton({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading chats"
      data-slot="thread-list-skeleton"
      className={cn("flex flex-col", className)}
    >
      <div className="flex h-7 items-center px-2">
        <span className="bg-(color:--chatcn-fill) rounded-(--chatcn-radius-xs) h-2.5 w-14" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-8 items-center px-2 pointer-coarse:h-11">
          <span
            className="bg-(color:--chatcn-fill) rounded-(--chatcn-radius-xs) h-3"
            style={{ width: SKELETON_WIDTHS[i % SKELETON_WIDTHS.length] }}
          />
        </div>
      ))}
    </div>
  )
}

interface ThreadListProps extends React.ComponentProps<"div"> {
  /** Accessible name. Default "Chats". */
  label?: string
}

/* -------------------------------------------------------------------------------------------------
 * ThreadList: a roving-focus list. One row is in the tab order; arrows move between rows.
 * -----------------------------------------------------------------------------------------------*/

const ROW = "[data-thread-row]"

/**
 * The scrolling list of threads. Arrow keys move between rows, Home and End jump, F2 renames,
 * Delete deletes. Only one row sits in the tab order, so Tab leaves the list in one step.
 */
function ThreadList({
  label = "Chats",
  className,
  onKeyDown,
  onFocus,
  ref,
  ...props
}: ThreadListProps) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const lastFocused = React.useRef<string | null>(null)

  const rows = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>(ROW) ?? [])

  // Keep exactly one row (and its menu button) tabbable: the last focused, else the current
  // thread, else the first. Imperative, so rows never re-render for a focus move.
  const syncTabStops = React.useCallback(() => {
    const all = rows()
    if (!all.length) return
    const stop =
      all.find((r) => r.dataset.threadId === lastFocused.current) ??
      all.find((r) => r.getAttribute("aria-current") === "page") ??
      all[0]
    for (const row of all) {
      const on = row === stop
      row.tabIndex = on ? 0 : -1
      const more = row.parentElement?.querySelector<HTMLElement>("[data-thread-more]")
      if (more) more.tabIndex = on ? 0 : -1
    }
  }, [])

  React.useLayoutEffect(() => {
    syncTabStops()
    const node = listRef.current
    if (!node) return
    const observer = new MutationObserver(syncTabStops)
    observer.observe(node, { childList: true, subtree: true, attributeFilter: ["aria-current"] })
    return () => observer.disconnect()
  }, [syncTabStops])

  const setRefs = (node: HTMLDivElement | null) => {
    listRef.current = node
    if (typeof ref === "function") ref(node)
    else if (ref) ref.current = node
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls; this is a labelled group of links
    <div
      ref={setRefs}
      role="group"
      aria-label={label}
      data-slot="thread-list"
      className={cn("flex flex-col gap-4", className)}
      onFocus={(event) => {
        onFocus?.(event)
        const row = (event.target as HTMLElement).closest<HTMLElement>(ROW)
        if (row?.dataset.threadId) {
          lastFocused.current = row.dataset.threadId
          syncTabStops()
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented) return
        const target = event.target as HTMLElement
        if (!target.matches(ROW)) return
        const all = rows()
        const index = all.indexOf(target)
        let next: HTMLElement | undefined
        if (event.key === "ArrowDown") next = all[index + 1]
        else if (event.key === "ArrowUp") next = all[index - 1]
        else if (event.key === "Home") next = all[0]
        else if (event.key === "End") next = all[all.length - 1]
        else return
        event.preventDefault()
        // Keyboard moves are instant, and the row scrolls into view without smooth scrolling.
        next?.focus()
        next?.scrollIntoView({ block: "nearest" })
      }}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------------------------------
 * ThreadListGroup
 * -----------------------------------------------------------------------------------------------*/

interface ThreadListGroupProps extends Omit<React.ComponentProps<"section">, "title"> {
  label: React.ReactNode
  /** Extra control at the end of the label row, for example "See all". */
  action?: React.ReactNode
}

/** A labelled run of rows: "Today", "Previous 7 days". */
function ThreadListGroup({ label, action, className, children, ...props }: ThreadListGroupProps) {
  const id = React.useId()
  return (
    <section
      aria-labelledby={id}
      data-slot="thread-list-group"
      className={cn("flex flex-col", className)}
      {...props}
    >
      <div className="flex h-7 items-center gap-2 px-2">
        <h3
          id={id}
          className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) min-w-0 flex-1 truncate font-medium"
        >
          {label}
        </h3>
        {action}
      </div>
      <ul className="flex flex-col gap-px">{children}</ul>
    </section>
  )
}

const NBSP = " "

const iconNode12: IconNode = [
  ["path", {"d":"m6 6 12 12"}],
  ["path", {"d":"m18 6-3.88 3.88"}],
  ["path", {"d":"M9.88 14.12 6 18"}],
]

const XIcon: Icon = /* @__PURE__ */ createIcon("x", iconNode12)

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "rounded-(--chatcn-radius-xs) bg-(color:--chatcn-fill) text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) inline-flex h-5 min-w-5 items-center justify-center px-1 font-sans tabular-nums shadow-[inset_0_-1px_0_var(--chatcn-alpha-300)]",
        className,
      )}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------------------------------
 * Resize handle: a hairline on the inline-end edge. Drag, arrows, Home and End, double-click to
 * reset, Enter to collapse. Dragging well past the minimum collapses to the rail.
 * -----------------------------------------------------------------------------------------------*/

interface ResizeHandleProps {
  width: number
  min: number
  max: number
  defaultWidth: number
  onWidth: (width: number) => void
  onCollapse: () => void
}

function SidebarResizeHandle({
  width,
  min,
  max,
  defaultWidth,
  onWidth,
  onCollapse,
}: ResizeHandleProps) {
  const [dragging, setDragging] = React.useState(false)
  const clamp = (n: number) => Math.round(Math.min(max, Math.max(min, n)))

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    const rtl = getComputedStyle(target).direction === "rtl"
    const startX = event.clientX
    const startWidth = width
    setDragging(true)
    const previousCursor = document.body.style.cursor
    document.body.style.cursor = "col-resize"
    const move = (e: PointerEvent) => {
      const next = startWidth + (e.clientX - startX) * (rtl ? -1 : 1)
      if (next < min - 64) {
        end()
        onCollapse()
        return
      }
      onWidth(clamp(next))
    }
    const end = () => {
      target.removeEventListener("pointermove", move)
      target.removeEventListener("pointerup", end)
      target.removeEventListener("pointercancel", end)
      document.body.style.cursor = previousCursor
      setDragging(false)
    }
    target.addEventListener("pointermove", move)
    target.addEventListener("pointerup", end)
    target.addEventListener("pointercancel", end)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl"
    const step = event.shiftKey ? 24 : 8
    const grow = rtl ? "ArrowLeft" : "ArrowRight"
    const shrink = rtl ? "ArrowRight" : "ArrowLeft"
    let next: number | null = null
    if (event.key === grow) next = width + step
    else if (event.key === shrink) next = width - step
    else if (event.key === "Home") next = min
    else if (event.key === "End") next = max
    else if (event.key === "Enter") {
      event.preventDefault()
      onCollapse()
      return
    }
    if (next === null) return
    event.preventDefault()
    onWidth(clamp(next))
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable separator is the APG window splitter pattern
    <div
      role="separator"
      tabIndex={0}
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      data-slot="chat-sidebar-resize"
      data-resize-handle-state={dragging ? "drag" : "idle"}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onWidth(clamp(defaultWidth))}
      className={cn(
        "group/resize absolute inset-y-0 -end-1 z-20 w-2 cursor-col-resize touch-none outline-none select-none",
        "pointer-coarse:hidden",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 start-1/2 w-[3px] -translate-x-1/2 scale-x-[0.34] opacity-0 rtl:translate-x-1/2",
          "bg-(color:--chatcn-border-strong) ease-(--chatcn-ease-out) transition-[opacity,scale,background-color] duration-150",
          "group-hover/resize:scale-x-100 group-hover/resize:opacity-100 group-hover/resize:delay-100",
          "group-focus-visible/resize:bg-(color:--chatcn-accent) group-focus-visible/resize:scale-x-100 group-focus-visible/resize:opacity-100 group-focus-visible/resize:delay-0",
          "group-data-[resize-handle-state=drag]/resize:bg-(color:--chatcn-fg) group-data-[resize-handle-state=drag]/resize:scale-x-100 group-data-[resize-handle-state=drag]/resize:opacity-100 group-data-[resize-handle-state=drag]/resize:delay-0",
          "motion-reduce:transition-opacity",
        )}
      />
    </div>
  )
}

/**
 * The thread sidebar: New chat, a filter, threads grouped by date with Pinned on top, inline
 * rename, delete with undo, and live status per thread. Collapses to a 52 px rail with tooltips,
 * resizes between 240 and 288 px, and becomes the drawer content on mobile inside `ChatLayout`.
 */
export function ChatSidebar({
  threads,
  activeId = null,
  onSelect,
  getHref,
  onNewChat,
  onRename,
  onDelete,
  onPinChange,
  onShare,
  renderMenuItems,
  undoMs = 5000,
  loading = false,
  error = false,
  onRetry,
  brand,
  header,
  footer,
  railHeader,
  railFooter,
  search = true,
  searchPlaceholder = "Search chats…",
  onSearchClick,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  width: widthProp,
  defaultWidth = 260,
  onWidthChange,
  minWidth = 240,
  maxWidth = 288,
  resizable = true,
  grouping,
  hotkeys,
  newChatHotkey = "mod+shift+o",
  sidebarHotkey = "mod+b",
  className,
  style,
  id: idProp,
  ...props
}: ChatSidebarProps) {
  const layout = useChatcnShellLayout()
  const placement = useChatcnShellSidebarPlacement()
  const drawer = placement === "drawer"
  const apple = useApplePlatform()
  const generatedId = React.useId()
  const id = idProp ?? layout?.sidebarId ?? generatedId

  // Collapsed: controlled, else the layout's, else local.
  const [collapsedState, setCollapsedState] = React.useState(defaultCollapsed)
  const [lastSource, setLastSource] = React.useState<ChatcnShellToggleSource>("keyboard")
  const collapsedRaw = collapsedProp ?? (layout ? layout.sidebarCollapsed : collapsedState)
  const collapsed = !drawer && collapsedRaw
  const setCollapsed = (next: boolean, source: ChatcnShellToggleSource = "pointer") => {
    setLastSource(source)
    // Closing from inside the sidebar hands focus to the rail's Open button once it appears.
    if (next) restoreFocus.current = Boolean(asideRef.current?.contains(document.activeElement))
    if (collapsedProp === undefined) {
      if (layout) layout.setSidebarCollapsed(next, source)
      else setCollapsedState(next)
    }
    onCollapsedChange?.(next)
  }

  const [widthState, setWidthState] = React.useState(defaultWidth)
  const width = widthProp ?? widthState
  const setWidth = (next: number) => {
    if (widthProp === undefined) setWidthState(next)
    onWidthChange?.(next)
  }

  // Filter
  const [query, setQuery] = React.useState("")
  const searchRef = React.useRef<HTMLInputElement>(null)
  const [focusSearch, setFocusSearch] = React.useState(false)
  React.useEffect(() => {
    if (!focusSearch || collapsed) return
    searchRef.current?.focus({ preventScroll: true })
    setFocusSearch(false)
  }, [focusSearch, collapsed])

  // Deletes leave the list at once; the callback waits out the undo window.
  const [pending, setPending] = React.useState<PendingDelete | null>(null)
  const pendingRef = React.useRef(pending)
  pendingRef.current = pending
  const listRef = React.useRef<HTMLDivElement>(null)
  const commit = React.useCallback(
    (entry: PendingDelete | null) => {
      if (entry) onDelete?.(entry.thread.id)
    },
    [onDelete],
  )
  const remove = (thread: ChatThread) => {
    // Move focus to the neighbour first, so a keyboard user keeps their place.
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-thread-row]") ?? [],
    )
    const index = rows.findIndex((r) => r.dataset.threadId === thread.id)
    const hadFocus =
      rows[index]?.contains(document.activeElement) || rows[index] === document.activeElement
    const neighbour = rows[index + 1] ?? rows[index - 1]
    if (hadFocus) neighbour?.focus()
    if (undoMs <= 0) {
      onDelete?.(thread.id)
      return
    }
    commit(pendingRef.current)
    setPending({ thread, key: Date.now() })
  }
  const undo = () => setPending(null)
  React.useEffect(() => () => commit(pendingRef.current), [commit])

  const visible = React.useMemo(
    () => threads.filter((t) => t.id !== pending?.thread.id),
    [threads, pending],
  )
  const matches = useChatcnShellFuzzy(visible, query, (t) => t.title || "New chat")
  const filtering = query.trim().length > 0
  // The clock is read after mount, never during render (Next.js prerender). Until then threads are
  // grouped against the newest one, which the first client frame corrects.
  const [now, setNow] = React.useState<number | null>(null)
  React.useEffect(() => setNow(Date.now()), [])
  const groups = React.useMemo(() => {
    if (filtering) return []
    const reference =
      grouping?.now ??
      now ??
      Math.max(0, ...visible.map((t) => new Date(t.updatedAt).getTime() || 0))
    return groupThreadsByDate(visible, { ...grouping, now: reference })
  }, [filtering, visible, grouping, now])

  const close = (source: ChatcnShellToggleSource) => {
    if (drawer) layout?.setSidebarOpen(false, source)
    else setCollapsed(true, source)
  }

  const select = (threadId: string) => {
    onSelect?.(threadId)
    if (drawer) layout?.setSidebarOpen(false, "pointer")
  }
  const newChat = onNewChat
    ? () => {
        onNewChat()
        if (drawer) layout?.setSidebarOpen(false, "pointer")
      }
    : undefined

  useChatcnHotkeys(
    {
      [newChatHotkey]: { handler: () => newChat?.(), enabled: Boolean(newChat) },
      // Without a layout the sidebar owns its own toggle.
      [sidebarHotkey]: {
        handler: (event) => {
          if (event.target instanceof HTMLElement && event.target.isContentEditable) return
          setCollapsed(!collapsedRaw, "keyboard")
        },
        enabled: !layout,
      },
      "mod+z": {
        handler: undo,
        enabled: Boolean(pending),
        allowInInput: false,
      },
    },
    { enabled: hotkeys ?? true },
  )

  // A hairline under the top area once the list scrolls.
  const [scrolled, setScrolled] = React.useState(false)

  const renderItem = (thread: ChatThread, highlight?: MatchRange[]) => (
    <ThreadListItem
      key={thread.id}
      threadId={thread.id}
      title={thread.title}
      status={thread.status}
      pinned={thread.pinned}
      active={thread.id === activeId}
      href={getHref?.(thread)}
      onSelect={() => select(thread.id)}
      highlight={highlight}
      onRename={onRename ? (title) => onRename(thread.id, title) : undefined}
      onDelete={onDelete ? () => remove(thread) : undefined}
      onPinChange={onPinChange ? (pinned) => onPinChange(thread.id, pinned) : undefined}
      onShare={onShare ? () => onShare(thread.id) : undefined}
      menuItems={renderMenuItems?.(thread)}
    />
  )

  const newChatKeys = hotkeyKeys(newChatHotkey, apple)
  // Pointer toggles slide; keyboard toggles are instant, like everything used all day.
  const animated = !drawer && (layout ? !layout.instant : lastSource === "pointer")
  const fadeIn = animated

  // The edge eases between the rail and the full width while the content keeps its final size and
  // is clipped, so it slides in and out under the edge instead of reflowing. While collapsing, the
  // full list stays until the edge reaches the rail, then the rail icons fade in.
  const asideRef = React.useRef<HTMLElement>(null)
  const railToggleRef = React.useRef<HTMLButtonElement>(null)
  const [prevCollapsed, setPrevCollapsed] = React.useState(collapsed)
  const [sliding, setSliding] = React.useState(false)
  const restoreFocus = React.useRef(false)
  if (prevCollapsed !== collapsed) {
    setPrevCollapsed(collapsed)
    setSliding(animated && !reducedMotion())
  }
  React.useEffect(() => {
    if (!sliding) return
    // A fallback for a cancelled transition: never leave the drag resize easing behind the pointer.
    const id = window.setTimeout(() => setSliding(false), SLIDE_MS + 120)
    return () => window.clearTimeout(id)
  }, [sliding])
  const showRail = collapsed && !sliding
  React.useLayoutEffect(() => {
    if (!showRail || !restoreFocus.current) return
    restoreFocus.current = false
    railToggleRef.current?.focus({ preventScroll: true })
  }, [showRail])
  const slideProps = {
    ref: asideRef,
    "data-sliding": sliding ? "" : undefined,
    onTransitionEnd: (event: React.TransitionEvent<HTMLElement>) => {
      if (event.target === event.currentTarget && event.propertyName === "width") setSliding(false)
    },
  }
  const slideClass = sliding && "overflow-hidden ease-(--chatcn-ease-in-out) transition-[width] duration-280"

  /* ------------------------------------------------------------------ rail */
  if (showRail) {
    return (
      <aside
        {...slideProps}
        id={id}
        aria-label="Sidebar"
        data-slot="chat-sidebar"
        data-collapsed=""
        className={cn(
          "bg-(color:--chatcn-bg-subtle) border-(color:--chatcn-border) relative flex h-full shrink-0 flex-col items-center gap-1 border-e pt-1.5 pb-2",
          slideClass,
          className,
        )}
        style={{ width: RAIL_WIDTH, ...style }}
        {...props}
      >
        <div
          key="rail"
          className={cn(
            "flex w-full flex-1 flex-col items-center gap-1",
            fadeIn && "ease-(--chatcn-ease-out) transition-opacity duration-150 starting:opacity-0",
          )}
        >
          <RailButton
            ref={railToggleRef}
            label="Open sidebar"
            shortcut={formatHotkey(sidebarHotkey, apple)}
            aria-expanded={false}
            aria-controls={id}
            aria-keyshortcuts={hotkeyAria(sidebarHotkey)}
            onClick={(event) => setCollapsed(false, toggleSourceOf(event))}
          >
            <PanelLeftIcon className="rtl:-scale-x-100" />
          </RailButton>
          {newChat ? (
            <RailButton
              label="New chat"
              shortcut={formatHotkey(newChatHotkey, apple)}
              aria-keyshortcuts={hotkeyAria(newChatHotkey)}
              onClick={newChat}
            >
              <PlusIcon />
            </RailButton>
          ) : null}
          {search || onSearchClick ? (
            <RailButton
              label="Search chats"
              onClick={(event) => {
                if (onSearchClick) return onSearchClick()
                setCollapsed(false, toggleSourceOf(event))
                setFocusSearch(true)
              }}
            >
              <SearchIcon />
            </RailButton>
          ) : null}
          {railHeader ? (
            <div className="mt-1 flex flex-col items-center gap-1">{railHeader}</div>
          ) : null}
          <div className="flex-1" />
          {railFooter ? <div className="flex flex-col items-center gap-1">{railFooter}</div> : null}
        </div>
        <UndoToast
          pending={pending}
          undoMs={undoMs}
          onUndo={undo}
          onExpire={() => {
            commit(pending)
            setPending(null)
          }}
          apple={apple}
        />
      </aside>
    )
  }

  /* ------------------------------------------------------------------ list body */
  let body: React.ReactNode
  if (loading) {
    body = <ThreadListSkeleton className="pt-2" />
  } else if (error) {
    body = (
      <div role="alert" className="flex flex-col items-start gap-3 px-2 pt-4">
        <div className="flex flex-col gap-1">
          <p className="text-[0.875rem]/[1.25rem] tracking-[-0.003em] text-(color:--chatcn-fg) font-medium">Couldn’t load chats</p>
          <p className="text-[0.8125rem]/[1.25rem] text-(color:--chatcn-fg-muted) text-pretty">
            {typeof error === "string" ? error : "Check your connection, then retry."}
          </p>
        </div>
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry} className="pointer-coarse:h-11">
            <RotateCcwIcon />
            Retry
          </Button>
        ) : null}
      </div>
    )
  } else if (threads.length === 0 && !pending) {
    body = (
      <div className="flex flex-col gap-1 px-2 pt-4">
        <p className="text-[0.875rem]/[1.25rem] tracking-[-0.003em] text-(color:--chatcn-fg) font-medium">No chats yet</p>
        <p className="text-[0.8125rem]/[1.25rem] text-(color:--chatcn-fg-muted) text-pretty">
          Chats you start show up here, newest first.
        </p>
      </div>
    )
  } else if (filtering) {
    body = matches.length ? (
      <ThreadList ref={listRef} label="Search results">
        <ThreadListGroup
          label={`${matches.length}${NBSP}${matches.length === 1 ? "result" : "results"}`}
        >
          {matches.map((m) => renderItem(m.item, m.ranges))}
        </ThreadListGroup>
      </ThreadList>
    ) : (
      <div className="flex flex-col items-start gap-2 px-2 pt-4">
        <p className="text-[0.8125rem]/[1.25rem] text-(color:--chatcn-fg-muted) min-w-0 text-pretty [overflow-wrap:anywhere]">
          No chats match “{query.trim()}”.
        </p>
        <Button
          size="xs"
          variant="subtle"
          onClick={() => setQuery("")}
          className="pointer-coarse:h-9"
        >
          Clear search
        </Button>
      </div>
    )
  } else {
    body = (
      <ThreadList ref={listRef}>
        {groups.map((group) => (
          <ThreadListGroup key={group.id} label={group.label}>
            {group.threads.map((t) => renderItem(t))}
          </ThreadListGroup>
        ))}
      </ThreadList>
    )
  }

  /* ------------------------------------------------------------------ expanded */
  return (
    <aside
      {...slideProps}
      id={id}
      aria-label="Sidebar"
      data-slot="chat-sidebar"
      data-placement={placement}
      data-collapsed={collapsed ? "" : undefined}
      className={cn(
        "bg-(color:--chatcn-bg-subtle) relative flex h-full shrink-0 flex-col",
        !drawer && "border-(color:--chatcn-border) border-e",
        slideClass,
        className,
      )}
      style={{ width: drawer ? "100%" : collapsed ? RAIL_WIDTH : width, ...style }}
      {...props}
    >
      <div
        key="expanded"
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          sliding && "shrink-0",
          fadeIn && !drawer && "ease-(--chatcn-ease-out) transition-opacity duration-150 starting:opacity-0",
        )}
        // Final width while the edge moves, so rows clip instead of reflowing every frame.
        style={sliding ? { width: width - 1 } : undefined}
      >
        {/* Top row */}
        <div className="flex h-12 shrink-0 items-center gap-1 ps-4 pe-2 pointer-coarse:h-14">
          <div className="text-[0.875rem]/[1.25rem] tracking-[-0.003em] text-(color:--chatcn-fg) flex min-w-0 flex-1 items-center gap-2 font-semibold">
            {brand}
          </div>
          <Tooltip
            content="Close sidebar"
            shortcut={formatHotkey(sidebarHotkey, apple)}
            side={drawer ? "bottom" : "right"}
          >
            <Button
              size="icon-md"
              variant="ghost"
              aria-label="Close sidebar"
              aria-expanded
              aria-controls={id}
              aria-keyshortcuts={hotkeyAria(sidebarHotkey)}
              onClick={(event) => close(toggleSourceOf(event))}
              className="text-(color:--chatcn-fg-muted) hover:text-(color:--chatcn-fg) pointer-coarse:size-11"
            >
              {drawer ? <XIcon /> : <PanelLeftIcon className="rtl:-scale-x-100" />}
            </Button>
          </Tooltip>
        </div>

        <div className="flex shrink-0 flex-col gap-1 px-2 pb-2">
          {newChat ? (
            <button
              type="button"
              onClick={newChat}
              aria-keyshortcuts={hotkeyAria(newChatHotkey)}
              data-slot="chat-sidebar-new"
              className={cn(
                "group/new chatcn-focus rounded-(--chatcn-radius-md) text-[0.875rem]/[1.25rem] tracking-[-0.003em] text-(color:--chatcn-fg) flex h-8 w-full items-center gap-2 px-2 outline-none select-none",
                "ease-(--chatcn-ease-standard) hover:bg-(color:--chatcn-fill) active:bg-(color:--chatcn-fill-hover) transition-[background-color] duration-150",
                "pointer-coarse:h-11",
              )}
            >
              <PlusIcon aria-hidden="true" className="text-(color:--chatcn-fg-muted) size-4" />
              <span className="flex-1 text-start">New chat</span>
              <span
                aria-hidden="true"
                className="flex gap-0.5 opacity-0 group-hover/new:opacity-100 group-focus-visible/new:opacity-100 pointer-coarse:hidden"
              >
                {newChatKeys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </button>
          ) : null}
          {search ? (
            <div className="relative">
              <SearchIcon
                aria-hidden="true"
                className="text-(color:--chatcn-fg-subtle) pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2"
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return
                  if (event.key === "Escape" && query) {
                    event.preventDefault()
                    event.stopPropagation()
                    setQuery("")
                  } else if (event.key === "ArrowDown") {
                    const first = listRef.current?.querySelector<HTMLElement>("[data-thread-row]")
                    if (first) {
                      event.preventDefault()
                      first.focus()
                    }
                  }
                }}
                placeholder={searchPlaceholder}
                aria-label="Search chats"
                data-slot="chat-sidebar-search"
                className={cn(
                  "rounded-(--chatcn-radius-md) text-[0.875rem]/[1.25rem] tracking-[-0.003em] text-(color:--chatcn-fg) placeholder:text-(color:--chatcn-fg-subtle) h-8 w-full min-w-0 bg-transparent ps-8 pe-7 outline-none",
                  "ease-(--chatcn-ease-standard) hover:bg-(color:--chatcn-fill) focus:bg-(color:--chatcn-card) transition-[background-color] duration-150",
                  "focus:shadow-[0_0_0_1px_var(--chatcn-gray-900),0_0_0_4px_var(--chatcn-alpha-300)]",
                  "[&::-webkit-search-cancel-button]:appearance-none",
                  "pointer-coarse:text-[1rem]/[1.5rem] pointer-coarse:tracking-[-0.01em] pointer-coarse:h-11",
                )}
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("")
                    searchRef.current?.focus()
                  }}
                  className="chatcn-focus rounded-(--chatcn-radius-sm) text-(color:--chatcn-fg-subtle) hover:text-(color:--chatcn-fg) absolute end-1 top-1/2 grid size-6 -translate-y-1/2 place-items-center outline-none pointer-coarse:size-9"
                >
                  <XIcon aria-hidden="true" className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}
          {header ? <div className="flex flex-col gap-1">{header}</div> : null}
        </div>

        <nav
          aria-label="Chats"
          data-scrolled={scrolled ? "" : undefined}
          onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
          className={cn(
            "chatcn-scroll relative min-h-0 flex-1 overflow-y-auto px-2 pb-4",
            "data-[scrolled]:border-(color:--chatcn-border) border-t border-transparent transition-[border-color] duration-150",
            pending && "pb-16",
          )}
        >
          {body}
        </nav>

        {footer ? (
          <div className="border-(color:--chatcn-border) shrink-0 border-t px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>

      <UndoToast
        pending={pending}
        undoMs={undoMs}
        onUndo={undo}
        onExpire={() => {
          commit(pending)
          setPending(null)
        }}
        apple={apple}
      />

      {resizable && !drawer && !collapsed ? (
        <SidebarResizeHandle
          width={width}
          min={minWidth}
          max={maxWidth}
          defaultWidth={defaultWidth}
          onWidth={setWidth}
          onCollapse={() => setCollapsed(true, "pointer")}
        />
      ) : null}
    </aside>
  )
}

export default ChatSidebar
