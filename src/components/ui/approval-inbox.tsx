"use client"

// From chatcn, chat, voice and agent UI for shadcn: https://chatcn.dev

import * as React from "react"
import { forwardRef, createElement, type SVGAttributes, type ForwardRefExoticComponent, type RefAttributes } from "react"
import { cn } from "@/lib/utils"
import { Collapsible } from "@base-ui/react/collapsible"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

/** chatcn theme variables and utilities this file uses, light and dark. */
const CHATCN_CSS = ":root{--chatcn-accent:var(--chatcn-gray-1000);--chatcn-accent-fg:var(--chatcn-bg);--chatcn-alpha-100:oklch(0 0 0 / 0.03);--chatcn-alpha-300:oklch(0 0 0 / 0.08);--chatcn-alpha-500:oklch(0 0 0 / 0.14);--chatcn-alpha-600:oklch(0 0 0 / 0.2);--chatcn-bg:oklch(1 0 0);--chatcn-border:var(--chatcn-gray-400);--chatcn-border-strong:var(--chatcn-gray-600);--chatcn-card:oklch(1 0 0);--chatcn-ease-out:cubic-bezier(0.23, 1, 0.32, 1);--chatcn-ease-standard:ease;--chatcn-fg:var(--chatcn-gray-1000);--chatcn-fg-faint:var(--chatcn-gray-700);--chatcn-fg-muted:var(--chatcn-gray-900);--chatcn-fg-subtle:var(--chatcn-gray-800);--chatcn-fill:var(--chatcn-gray-100);--chatcn-fill-hover:var(--chatcn-gray-200);--chatcn-gray-100:oklch(0.970 0 0);--chatcn-gray-1000:oklch(0.145 0 0);--chatcn-gray-200:oklch(0.950 0 0);--chatcn-gray-400:oklch(0.910 0 0);--chatcn-gray-600:oklch(0.800 0 0);--chatcn-gray-700:oklch(0.700 0 0);--chatcn-gray-800:oklch(0.525 0 0);--chatcn-gray-900:oklch(0.440 0 0);--chatcn-inset:oklch(0.975 0 0);--chatcn-press-scale:0.97;--chatcn-press-scale-icon:0.94;--chatcn-primary:var(--chatcn-gray-1000);--chatcn-primary-fg:var(--chatcn-bg);--chatcn-primary-hover:var(--chatcn-gray-900);--chatcn-radius-lg:12px;--chatcn-radius-md:8px;--chatcn-radius-sm:6px;--chatcn-radius-xs:4px;--chatcn-scrollbar:var(--chatcn-alpha-500);--chatcn-scrollbar-hover:var(--chatcn-alpha-600);--chatcn-shadow-md:0 0 0 1px oklch(0 0 0 / 0.06), 0 2px 4px -1px oklch(0 0 0 / 0.06), 0 8px 16px -4px oklch(0 0 0 / 0.08);--chatcn-shadow-sm:0 0 0 1px oklch(0 0 0 / 0.06), 0 1px 2px -1px oklch(0 0 0 / 0.06), 0 2px 4px oklch(0 0 0 / 0.04);--chatcn-shadow-xs:0 0 0 1px oklch(0 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.04);--chatcn-surface:oklch(1 0 0)}.dark{--chatcn-accent:var(--chatcn-gray-1000);--chatcn-accent-fg:var(--chatcn-bg);--chatcn-alpha-100:oklch(1 0 0 / 0.04);--chatcn-alpha-300:oklch(1 0 0 / 0.09);--chatcn-alpha-500:oklch(1 0 0 / 0.16);--chatcn-alpha-600:oklch(1 0 0 / 0.24);--chatcn-bg:oklch(0.145 0 0);--chatcn-border:var(--chatcn-gray-400);--chatcn-border-strong:var(--chatcn-gray-600);--chatcn-card:oklch(0.175 0 0);--chatcn-fg:var(--chatcn-gray-1000);--chatcn-fg-faint:var(--chatcn-gray-700);--chatcn-fg-muted:var(--chatcn-gray-900);--chatcn-fg-subtle:var(--chatcn-gray-800);--chatcn-fill:var(--chatcn-gray-100);--chatcn-fill-hover:var(--chatcn-gray-200);--chatcn-gray-100:oklch(0.195 0 0);--chatcn-gray-1000:oklch(0.970 0 0);--chatcn-gray-200:oklch(0.225 0 0);--chatcn-gray-400:oklch(0.285 0 0);--chatcn-gray-600:oklch(0.410 0 0);--chatcn-gray-700:oklch(0.500 0 0);--chatcn-gray-800:oklch(0.620 0 0);--chatcn-gray-900:oklch(0.720 0 0);--chatcn-inset:oklch(0.155 0 0);--chatcn-primary:var(--chatcn-gray-1000);--chatcn-primary-fg:var(--chatcn-bg);--chatcn-primary-hover:var(--chatcn-gray-900);--chatcn-scrollbar:var(--chatcn-alpha-500);--chatcn-scrollbar-hover:var(--chatcn-alpha-600);--chatcn-shadow-md:0 0 0 1px oklch(1 0 0 / 0.09), inset 0 1px 0 oklch(1 0 0 / 0.04), 0 8px 16px -4px oklch(0 0 0 / 0.5);--chatcn-shadow-sm:0 0 0 1px oklch(1 0 0 / 0.08), inset 0 1px 0 oklch(1 0 0 / 0.03), 0 2px 4px oklch(0 0 0 / 0.4);--chatcn-shadow-xs:0 0 0 1px oklch(1 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.4);--chatcn-surface:oklch(0.205 0 0)}.chatcn-focus{}.chatcn-focus:focus-visible{outline: 2px solid var(--chatcn-accent); outline-offset: 2px;}.chatcn-scroll{scrollbar-width: thin; scrollbar-color: var(--chatcn-scrollbar) transparent;}.chatcn-scroll:hover{scrollbar-color: var(--chatcn-scrollbar-hover) transparent;}.chatcn-scroll::-webkit-scrollbar{width: 10px; height: 10px;}.chatcn-scroll::-webkit-scrollbar-track, .chatcn-scroll::-webkit-scrollbar-corner{background: transparent;}.chatcn-scroll::-webkit-scrollbar-thumb{background-color: var(--chatcn-scrollbar); background-clip: content-box; border: 3px solid transparent; border-radius: 9999px;}.chatcn-scroll::-webkit-scrollbar-thumb:hover{background-color: var(--chatcn-scrollbar-hover);}@media (prefers-reduced-motion: reduce){:root{--chatcn-press-scale:1;--chatcn-press-scale-icon:1;--chatcn-enter-scale:1}}"
if (typeof document !== "undefined" && !document.getElementById("chatcn-approval-inbox")) {
  const style = document.createElement("style")
  style.id = "chatcn-approval-inbox"
  style.textContent = CHATCN_CSS
  document.head.appendChild(style)
}

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export interface PendingApproval {
  id: string
  /** Run the request came from. Used for the run filter. */
  runId: string
  runTitle: string
  /** Tool name from the model, for example `run_command`. Used for the tool filter and icon. */
  tool: string
  /** What will happen, as a verb phrase: "Run pnpm db:migrate". */
  title: React.ReactNode
  /** Mono context: the command, path or URL. */
  detail?: string
  /** Why the agent wants it. Shown when the row is expanded. */
  reason?: React.ReactNode
  /** Tool input, shown as JSON when the row is expanded. */
  input?: unknown
  /** Epoch ms when the request arrived. */
  requestedAt?: number
  icon?: React.ReactNode
}

export type ApprovalInboxScope = "once" | "always"

/* -------------------------------------------------------------------------------------------------
 * ApprovalInbox
 * -----------------------------------------------------------------------------------------------*/

export interface ApprovalInboxProps extends Omit<React.ComponentProps<"section">, "title"> {
  approvals: PendingApproval[]
  onApprove?: (ids: string[], scope: ApprovalInboxScope) => void
  onDeny?: (ids: string[], reason?: string) => void
  /** Heading. Default "Approvals". */
  title?: React.ReactNode
  /** Show the keyboard hint row under the list. Default true. */
  showShortcuts?: boolean
}

/** A clock that ticks every 30 s: "2 m ago" does not need a faster one. */
function useNow(active: boolean, fallback: number) {
  // Starts empty and reads the clock after mount: a render must not read it (Next.js prerender).
  // Until then times read relative to the newest request, so the first render is stable.
  const [now, setNow] = React.useState<number | null>(null)
  React.useEffect(() => {
    setNow(Date.now())
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [active])
  return now ?? fallback
}

const EXIT_MS = 160

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

type Icon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>

/** Shape elements an icon may contain. */
type IconElement = "path" | "circle" | "rect" | "ellipse" | "line" | "polyline" | "polygon"

/** An icon's drawing: a flat list of [element, attributes] pairs, lucide compatible. */
type IconNode = ReadonlyArray<readonly [IconElement, Readonly<Record<string, string>>]>

const toPascal = (name: string): string =>
  name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")

/**
 * Builds a React icon component from an icon node.
 * `name` is the kebab-case icon name, used for the class `chatcn-icon-<name>` and displayName.
 */
function createIcon(name: string, iconNode: IconNode): Icon {
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
  ["path", {"d":"M5 12h14"}],
]

const MinusIcon: Icon = /* @__PURE__ */ createIcon("minus", iconNode)

const iconNode2: IconNode = [
  ["path", {"d":"m4.5 12.75 3.23 3.23a2.5 2.5 0 0 0 3.54 0l8.48-8.48"}],
]

const CheckIcon: Icon = /* @__PURE__ */ createIcon("check", iconNode2)

/* -------------------------------------------------------------------------------------------------
 * Checkbox
 * -----------------------------------------------------------------------------------------------*/

function Check({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean | "mixed"
  onCheckedChange: (next: boolean) => void
  label: string
}) {
  const on = checked !== false
  return (
    // biome-ignore lint/a11y/useSemanticElements: a native checkbox cannot be styled to this spec in every engine, and this one needs the mixed state
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      data-slot="approval-inbox-check"
      onClick={() => onCheckedChange(checked !== true)}
      className={cn(
        "chatcn-focus rounded-(--chatcn-radius-sm) group/check relative grid size-7 shrink-0 place-items-center",
        "pointer-coarse:size-11",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-4 place-items-center rounded-[4px] [&_svg]:size-3",
          "ease-(--chatcn-ease-out) transition-[background-color,box-shadow] duration-150",
          on
            ? "bg-(color:--chatcn-accent) text-(color:--chatcn-accent-fg)"
            : "shadow-[inset_0_0_0_1px_var(--chatcn-border-strong)] group-hover/check:shadow-[inset_0_0_0_1px_var(--chatcn-fg-subtle)]",
        )}
      >
        {checked === "mixed" ? (
          <MinusIcon strokeWidth={2} />
        ) : (
          <CheckIcon
            strokeWidth={2}
            className={cn(
              "ease-(--chatcn-ease-out) transition-[opacity,scale] duration-150",
              on ? "scale-100 opacity-100" : "scale-50 opacity-0",
            )}
          />
        )}
      </span>
    </button>
  )
}

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

function Button({
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

/** A keyboard Enter or Space on a button arrives as a click with `detail === 0`. */
const fromKeyboard = (event: React.MouseEvent) => event.detail === 0

/* -------------------------------------------------------------------------------------------------
 * Root and trigger
 * -----------------------------------------------------------------------------------------------*/

/** Root. Controlled with `open` and `onOpenChange`, or uncontrolled. Modal by default. */
function Menu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root {...props} />
}

/** The button that opens the menu. Pass `render={<Button />}` to use your own element. */
function MenuTrigger(props: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="menu-trigger" {...props} />
}

const iconNode3: IconNode = [
  ["path", {"d":"m6 9.25 4.23 4.23a2.5 2.5 0 0 0 3.54 0L18 9.25"}],
]

const ChevronDownIcon: Icon = /* @__PURE__ */ createIcon("chevron-down", iconNode3)

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
function MenuContent({
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

/** Groups radio items. Controlled with `value` and `onValueChange`. */
function MenuRadioGroup(props: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup data-slot="menu-radio-group" {...props} />
}

/* -------------------------------------------------------------------------------------------------
 * Structure
 * -----------------------------------------------------------------------------------------------*/

function MenuGroup(props: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="menu-group" {...props} />
}

/** Names the group it sits in. Must be inside a `MenuGroup` or `MenuRadioGroup`. Sentence case. */
function MenuLabel({ className, ...props }: MenuPrimitive.GroupLabel.Props) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="menu-label"
      className={cn(
        "text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) flex h-7 items-center gap-1.5 px-2 font-medium select-none",
        "[&_svg]:size-3.5",
        className,
      )}
      {...props}
    />
  )
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

/** Reserved slot at the end of the row, so checking an item never shifts its label. */
function IndicatorSlot({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden="true" className="ms-auto grid size-4 shrink-0 place-items-center ps-1">
      {children}
    </span>
  )
}

/** One choice of a radio group. The check sits at the end of the row. */
function MenuRadioItem({
  className,
  children,
  ...props
}: MenuPrimitive.RadioItem.Props & { children?: React.ReactNode }) {
  return (
    <MenuPrimitive.RadioItem data-slot="menu-radio-item" className={cn(item, className)} {...props}>
      {children}
      <IndicatorSlot>
        <MenuPrimitive.RadioItemIndicator className="text-(color:--chatcn-fg) grid place-items-center">
          <CheckIcon />
        </MenuPrimitive.RadioItemIndicator>
      </IndicatorSlot>
    </MenuPrimitive.RadioItem>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Filter menu
 * -----------------------------------------------------------------------------------------------*/

function FilterMenu({
  label,
  allLabel,
  value,
  options,
  onValueChange,
  mono,
}: {
  label: string
  allLabel: string
  value: string
  options: { value: string; label: string; count: number }[]
  onValueChange: (value: string) => void
  mono?: boolean
}) {
  const current = options.find((o) => o.value === value)
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            size="xs"
            className={cn(
              "data-[popup-open]:bg-(color:--chatcn-fill-hover) data-[popup-open]:text-(color:--chatcn-fg) max-w-40 gap-1 pe-1.5",
              value !== "all" && "bg-(color:--chatcn-fill) text-(color:--chatcn-fg)",
            )}
          />
        }
      >
        <span className={cn("truncate", mono && value !== "all" && "font-mono")}>
          {current?.label ?? allLabel}
        </span>
        <ChevronDownIcon aria-hidden="true" className="opacity-60" />
      </MenuTrigger>
      <MenuContent align="end" className="w-60">
        <MenuRadioGroup value={value} onValueChange={(v) => onValueChange(v as string)}>
          <MenuGroup>
            <MenuLabel>{label}</MenuLabel>
            <MenuRadioItem value="all">{allLabel}</MenuRadioItem>
            {options.map((o) => (
              <MenuRadioItem key={o.value} value={o.value}>
                <span className={cn("min-w-0 flex-1 truncate", mono && "text-[0.8125rem]/[1.25rem] font-mono")}>
                  {o.label}
                </span>
                <span className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) tabular-nums">{o.count}</span>
              </MenuRadioItem>
            ))}
          </MenuGroup>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  )
}

const iconNode4: IconNode = [
  ["path", {"d":"M8.02 4h7.96a2 2 0 0 1 1.81 1.15l3.02 6.45a2 2 0 0 1 .19.85V17a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-4.55a2 2 0 0 1 .19-.85l3.02-6.45A2 2 0 0 1 8.02 4"}],
  ["path", {"d":"M3.5 12.5h3.57a1.5 1.5 0 0 1 1.34.83l.68 1.34a1.5 1.5 0 0 0 1.34.83h3.14a1.5 1.5 0 0 0 1.34-.83l.68-1.34a1.5 1.5 0 0 1 1.34-.83h3.57"}],
]

const InboxIcon: Icon = /* @__PURE__ */ createIcon("inbox", iconNode4)

const iconNode5: IconNode = [
  ["path", {"d":"M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3"}],
  ["path", {"d":"m7.5 8.75 1.87 1.87a1.25 1.25 0 0 1 0 1.76L7.5 14.25"}],
  ["path", {"d":"M12.5 15.25h4"}],
]

const SquareTerminalIcon: Icon = /* @__PURE__ */ createIcon("square-terminal", iconNode5)

const iconNode6: IconNode = [
  ["path", {"d":"M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0"}],
  ["path", {"d":"M12.72 3.8a11.9 11.9 0 0 1 0 16.4 1 1 0 0 1-1.44 0 11.9 11.9 0 0 1 0-16.4 1 1 0 0 1 1.44 0"}],
  ["path", {"d":"M3 12h2.25"}],
  ["path", {"d":"M10.75 12h2.5"}],
  ["path", {"d":"M18.75 12H21"}],
]

const GlobeIcon: Icon = /* @__PURE__ */ createIcon("globe", iconNode6)

const iconNode7: IconNode = [
  ["path", {"d":"M3.5 6h17"}],
  ["path", {"d":"M10 3h4"}],
  ["path", {"d":"m5.75 9.25.6 9.41A2.5 2.5 0 0 0 8.85 21h6.3a2.5 2.5 0 0 0 2.5-2.34l.6-9.41"}],
  ["path", {"d":"M10 11.5V17"}],
  ["path", {"d":"M14 11.5V17"}],
]

const Trash2Icon: Icon = /* @__PURE__ */ createIcon("trash-2", iconNode7)

const iconNode8: IconNode = [
  ["path", {"d":"m3.79 18.63.87-2.6a1.5 1.5 0 0 1 .36-.58l9.65-9.65a2.5 2.5 0 0 1 3.53 0 2.5 2.5 0 0 1 0 3.53l-9.65 9.65a1.5 1.5 0 0 1-.58.36l-2.6.87a1.25 1.25 0 0 1-1.58-1.58"}],
  ["path", {"d":"m13.25 7.21 3.54 3.54"}],
]

const PencilIcon: Icon = /* @__PURE__ */ createIcon("pencil", iconNode8)

const iconNode9: IconNode = [
  ["path", {"d":"M7 2.5h5.88a1.5 1.5 0 0 1 1.06.44l5.12 5.12a1.5 1.5 0 0 1 .44 1.06V19a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 19V5A2.5 2.5 0 0 1 7 2.5"}],
  ["path", {"d":"M13.5 3.25v3.5a1.75 1.75 0 0 0 1.75 1.75h3.5"}],
  ["path", {"d":"M8.25 12.5h7.5"}],
  ["path", {"d":"M8.25 16.5h7.5"}],
  ["path", {"d":"M8.25 8.5H10"}],
]

const FileTextIcon: Icon = /* @__PURE__ */ createIcon("file-text", iconNode9)

const iconNode10: IconNode = [
  ["path", {"d":"M7.5 8.5h9A1.5 1.5 0 0 1 18 10v1a6 6 0 0 1-6 6 6 6 0 0 1-6-6v-1a1.5 1.5 0 0 1 1.5-1.5"}],
  ["path", {"d":"M9.5 2.75V5.5"}],
  ["path", {"d":"M14.5 2.75V5.5"}],
  ["path", {"d":"M12 17v4.25"}],
]

const PlugIcon: Icon = /* @__PURE__ */ createIcon("plug", iconNode10)

const iconNode11: IconNode = [
  ["path", {"d":"M19.76 6.79a5.25 5.25 0 0 1-7.16 6.88l-6.22 6.21a1.6 1.6 0 0 1-2.26-2.26l6.21-6.22a5.25 5.25 0 0 1 6.88-7.16l-2.42 2.43 2.54 2.54Z"}],
]

const ToolIcon: Icon = /* @__PURE__ */ createIcon("tool", iconNode11)

function iconFor(tool: string) {
  const n = tool.toLowerCase()
  if (/bash|shell|command|terminal|exec|run/.test(n)) return <SquareTerminalIcon />
  if (/fetch|browse|url|http|navigate|click/.test(n)) return <GlobeIcon />
  if (/delete|remove|unlink|rm\b/.test(n)) return <Trash2Icon />
  if (/edit|write|patch|replace|create/.test(n)) return <PencilIcon />
  if (/read|open|view|file/.test(n)) return <FileTextIcon />
  if (/mcp|connector|plugin/.test(n)) return <PlugIcon />
  return <ToolIcon />
}

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/

const NBSP = " "

function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 45) return "now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m}${NBSP}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}${NBSP}h`
  return `${Math.round(h / 24)}${NBSP}d`
}

function stringify(value: unknown) {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/* -------------------------------------------------------------------------------------------------
 * Row
 * -----------------------------------------------------------------------------------------------*/

function ApprovalRow({
  approval,
  selected,
  leaving,
  instant,
  now,
  onSelect,
  onApprove,
  onDeny,
}: {
  approval: PendingApproval
  selected: boolean
  leaving: boolean
  instant: boolean
  now: number
  onSelect: (next: boolean) => void
  onApprove: (scope: ApprovalInboxScope, keyboard: boolean) => void
  onDeny: (reason: string | undefined, keyboard: boolean) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [note, setNote] = React.useState("")
  const hasDetails = approval.reason !== undefined || approval.input !== undefined

  return (
    <li
      data-slot="approval-inbox-row"
      data-id={approval.id}
      data-selected={selected ? "" : undefined}
      data-leaving={leaving ? "" : undefined}
      className={cn(
        "grid grid-rows-[1fr]",
        !instant && "ease-(--chatcn-ease-out) transition-[grid-template-rows,opacity] duration-160",
        leaving && "pointer-events-none grid-rows-[0fr] opacity-0",
        "motion-reduce:transition-opacity",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <Collapsible.Root
          open={open}
          onOpenChange={setOpen}
          render={<div />}
          className={cn(
            "group/row border-(color:--chatcn-border)/70 border-t",
            "ease-(--chatcn-ease-standard) transition-colors duration-150",
            selected && "bg-(color:--chatcn-alpha-100)",
          )}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: row-level shortcuts for keyboard users; every action also has a button */}
          <div
            className="flex min-w-0 items-start gap-1 py-2 ps-1.5 pe-2"
            onKeyDown={(event) => {
              if (event.target instanceof HTMLInputElement) return
              if (event.metaKey || event.ctrlKey || event.altKey) return
              const key = event.key.toLowerCase()
              if (key === "a") onApprove("once", true)
              else if (key === "d") onDeny(undefined, true)
              else if (key === "x") onSelect(!selected)
              else return
              event.preventDefault()
            }}
          >
            <Check
              checked={selected}
              onCheckedChange={onSelect}
              label={`Select ${typeof approval.title === "string" ? approval.title : "request"}`}
            />
            <Collapsible.Trigger
              disabled={!hasDetails}
              className={cn(
                "rounded-(--chatcn-radius-md) flex min-w-0 flex-1 items-start gap-2.5 px-1.5 py-1 text-start outline-none",
                "focus-visible:outline-(color:--chatcn-accent) focus-visible:outline-2 focus-visible:-outline-offset-2",
                "enabled:cursor-pointer",
              )}
            >
              <span
                aria-hidden="true"
                className="text-(color:--chatcn-fg-subtle) mt-0.5 grid size-4 shrink-0 place-items-center [&_svg]:size-4"
              >
                {approval.icon ?? iconFor(approval.tool)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[0.875rem]/[1.25rem] tracking-[-0.003em] text-(color:--chatcn-fg) flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 font-medium">{approval.title}</span>
                  {approval.detail ? (
                    <span className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) truncate font-mono">
                      {approval.detail}
                    </span>
                  ) : null}
                </span>
                <span className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) flex min-w-0 items-center gap-1.5">
                  {/* Keeps a few letters on narrow screens, so the line never starts with a separator. */}
                  <span className="min-w-12 truncate">{approval.runTitle}</span>
                  <span aria-hidden="true">·</span>
                  <span className="shrink-0 font-mono">{approval.tool}</span>
                  {approval.requestedAt !== undefined ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0 tabular-nums">
                        {ago(now - approval.requestedAt)}
                      </span>
                    </>
                  ) : null}
                </span>
              </span>
              {hasDetails ? (
                <ChevronDownIcon
                  aria-hidden="true"
                  className={cn(
                    "text-(color:--chatcn-fg-subtle) mt-0.5 size-4 shrink-0",
                    "ease-(--chatcn-ease-out) transition-transform duration-200 group-data-[open]/row:rotate-180 motion-reduce:transition-none",
                  )}
                />
              ) : null}
            </Collapsible.Trigger>
            <div className="flex shrink-0 items-center gap-1 pt-0.5">
              <Button
                size="sm"
                onClick={(event) => onDeny(undefined, fromKeyboard(event))}
                className="pointer-coarse:h-11"
              >
                Deny
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(event) => onApprove("once", fromKeyboard(event))}
                className="pointer-coarse:h-11"
              >
                Allow
              </Button>
            </div>
          </div>

          <Collapsible.Panel
            className={cn(
              "h-(--collapsible-panel-height) overflow-hidden",
              "ease-(--chatcn-ease-out) transition-[height,opacity] duration-200 motion-reduce:transition-none",
              "data-[ending-style]:h-0 data-[ending-style]:opacity-0 data-[starting-style]:h-0 data-[starting-style]:opacity-0",
            )}
          >
            {/* Starts under the title: check 28 + gap 4 + trigger padding 6 + icon 16 + gap 10, plus the row inset. */}
            <div className="flex flex-col gap-3 ps-[4.375rem] pe-3 pb-3 pointer-coarse:ps-[5.375rem]">
              {approval.reason ? (
                <p className="text-[0.8125rem]/[1.25rem] text-(color:--chatcn-fg-muted) text-pretty">{approval.reason}</p>
              ) : null}
              {approval.input !== undefined ? (
                <section
                  data-slot="approval-inbox-input"
                  aria-label="Tool input"
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: long input scrolls, so keyboard users must be able to reach it
                  tabIndex={0}
                  className="rounded-(--chatcn-radius-md) bg-(color:--chatcn-inset) chatcn-focus chatcn-scroll max-h-56 overflow-auto px-3 py-2.5"
                >
                  <pre className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-muted) font-mono [overflow-wrap:anywhere] whitespace-pre-wrap">
                    {stringify(approval.input)}
                  </pre>
                </section>
              ) : null}
              <form
                className="flex flex-wrap items-center gap-1.5"
                onSubmit={(event) => {
                  event.preventDefault()
                  onDeny(note.trim() || undefined, false)
                }}
              >
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Tell the agent what to do instead…"
                  aria-label="Note for the agent"
                  className={cn(
                    "rounded-(--chatcn-radius-sm) text-[0.8125rem]/[1.25rem] text-(color:--chatcn-fg) chatcn-focus h-7 min-w-40 flex-1 bg-transparent px-2",
                    "placeholder:text-(color:--chatcn-fg-subtle) shadow-[inset_0_0_0_1px_var(--chatcn-border)] pointer-coarse:h-11",
                  )}
                />
                <Button type="submit" size="sm" disabled={note.trim() === ""}>
                  Deny with note
                </Button>
                <Button size="sm" onClick={(event) => onApprove("always", fromKeyboard(event))}>
                  Always allow <span className="font-mono">{approval.tool}</span>
                </Button>
              </form>
            </div>
          </Collapsible.Panel>
        </Collapsible.Root>
      </div>
    </li>
  )
}

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

/**
 * Every pending approval across runs in one list. Select rows (or all) to approve or deny them in
 * one go, filter by run or tool, and expand any row to read the reason and the exact tool input.
 * A, D and X act on the focused row. Handled rows fold away; with the keyboard they go at once.
 */
export function ApprovalInbox({
  approvals,
  onApprove,
  onDeny,
  title = "Approvals",
  showShortcuts = true,
  className,
  ...props
}: ApprovalInboxProps) {
  const [runFilter, setRunFilter] = React.useState("all")
  const [toolFilter, setToolFilter] = React.useState("all")
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())
  const [leaving, setLeaving] = React.useState<Set<string>>(() => new Set())
  const [instant, setInstant] = React.useState(false)
  const timers = React.useRef<number[]>([])
  React.useEffect(
    () => () => {
      for (const t of timers.current) window.clearTimeout(t)
    },
    [],
  )
  const now = useNow(approvals.length > 0, Math.max(0, ...approvals.map((a) => a.requestedAt ?? 0)))
  const headingId = React.useId()
  const listRef = React.useRef<HTMLUListElement>(null)

  // Drop selections and filters that point at approvals that no longer exist.
  const ids = approvals.map((a) => a.id).join("|")
  React.useEffect(() => {
    const present = new Set(ids.split("|"))
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => present.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [ids])

  const runs = Array.from(
    approvals.reduce(
      (m, a) => m.set(a.runId, { label: a.runTitle, count: (m.get(a.runId)?.count ?? 0) + 1 }),
      new Map<string, { label: string; count: number }>(),
    ),
    ([value, { label, count }]) => ({ value, label, count }),
  )
  const tools = Array.from(
    approvals.reduce((m, a) => m.set(a.tool, (m.get(a.tool) ?? 0) + 1), new Map<string, number>()),
    ([value, count]) => ({ value, label: value, count }),
  )
  const effectiveRun =
    runFilter !== "all" && !runs.some((r) => r.value === runFilter) ? "all" : runFilter
  const effectiveTool =
    toolFilter !== "all" && !tools.some((t) => t.value === toolFilter) ? "all" : toolFilter

  const shown = approvals.filter(
    (a) =>
      (effectiveRun === "all" || a.runId === effectiveRun) &&
      (effectiveTool === "all" || a.tool === effectiveTool),
  )
  const shownSelected = shown.filter((a) => selected.has(a.id))
  const allChecked: boolean | "mixed" =
    shownSelected.length === 0 ? false : shownSelected.length === shown.length ? true : "mixed"

  /** Folds rows away, then reports. Keyboard actions skip the fold. */
  const settle = (targets: string[], keyboard: boolean, report: () => void) => {
    // Keep focus in the list: the next row that is not leaving gets it.
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-slot=approval-inbox-row]") ?? [],
    )
    const active = document.activeElement
    const focusedRow = rows.find((r) => r.contains(active))
    const shouldMove = focusedRow && targets.some((id) => focusedRow.dataset.id === id)
    const i = focusedRow ? rows.indexOf(focusedRow) : -1
    const rest = rows.filter((r) => !targets.includes(r.dataset.id ?? ""))
    const nextRow = rest.find((r) => rows.indexOf(r) > i) ?? rest[rest.length - 1]

    setInstant(keyboard)
    setLeaving((prev) => new Set([...prev, ...targets]))
    setSelected((prev) => new Set([...prev].filter((id) => !targets.includes(id))))
    const finish = () => {
      report()
      setLeaving((prev) => new Set([...prev].filter((id) => !targets.includes(id))))
      if (shouldMove) {
        const target =
          nextRow?.querySelector<HTMLElement>("[data-slot=approval-inbox-check]") ?? null
        if (target) target.focus()
        else listRef.current?.closest("section")?.querySelector<HTMLElement>("button")?.focus()
      }
    }
    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (keyboard || reduced) finish()
    else timers.current.push(window.setTimeout(finish, EXIT_MS))
  }

  const approve = (targets: string[], scope: ApprovalInboxScope, keyboard: boolean) =>
    settle(targets, keyboard, () => onApprove?.(targets, scope))
  const deny = (targets: string[], reason: string | undefined, keyboard: boolean) =>
    settle(targets, keyboard, () => onDeny?.(targets, reason))

  const batch = shownSelected.length > 0
  const filtered = effectiveRun !== "all" || effectiveTool !== "all"

  return (
    <section
      aria-labelledby={headingId}
      data-slot="approval-inbox"
      className={cn(
        "rounded-(--chatcn-radius-lg) bg-(color:--chatcn-card) shadow-(--chatcn-shadow-sm) flex min-w-0 flex-col overflow-hidden",
        "text-[0.875rem]/[1.25rem] tracking-[-0.003em] text-(color:--chatcn-fg) forced-colors:outline-1 forced-colors:outline-solid",
        className,
      )}
      {...props}
    >
      <header className="flex h-12 min-w-0 items-center gap-1 ps-1.5 pe-2">
        {approvals.length > 0 ? (
          <Check
            checked={allChecked}
            onCheckedChange={(next) =>
              setSelected(next ? new Set(shown.map((a) => a.id)) : new Set())
            }
            label="Select all shown"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1.5">
          <h2 id={headingId} className="text-[0.875rem]/[1.25rem] tracking-[-0.003em] min-w-0 font-medium">
            <span className="block truncate">
              {batch ? `${shownSelected.length} selected` : title}
            </span>
          </h2>
          {!batch && approvals.length > 0 ? (
            <span className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) shrink-0 whitespace-nowrap tabular-nums">
              {filtered ? `${shown.length} of ${approvals.length}` : `${approvals.length} waiting`}
            </span>
          ) : null}
        </div>
        {batch ? (
          <div
            key="batch"
            className="flex shrink-0 items-center gap-1 motion-safe:animate-[chatcn-tooltip-in_150ms_var(--chatcn-ease-out)]"
          >
            <Button
              size="sm"
              onClick={(event) =>
                deny(
                  shownSelected.map((a) => a.id),
                  undefined,
                  fromKeyboard(event),
                )
              }
            >
              Deny {shownSelected.length}
            </Button>
            <Button
              size="sm"
              variant="solid"
              onClick={(event) =>
                approve(
                  shownSelected.map((a) => a.id),
                  "once",
                  fromKeyboard(event),
                )
              }
            >
              Allow {shownSelected.length}
            </Button>
          </div>
        ) : approvals.length > 0 ? (
          <div key="filters" className="flex shrink-0 items-center gap-1">
            {runs.length > 1 ? (
              <FilterMenu
                label="Run"
                allLabel="All runs"
                value={effectiveRun}
                options={runs}
                onValueChange={setRunFilter}
              />
            ) : null}
            {tools.length > 1 ? (
              <FilterMenu
                label="Tool"
                allLabel="All tools"
                value={effectiveTool}
                options={tools}
                onValueChange={setToolFilter}
                mono
              />
            ) : null}
          </div>
        ) : null}
      </header>

      {approvals.length === 0 ? (
        <div
          data-slot="approval-inbox-empty"
          className="border-(color:--chatcn-border)/70 flex flex-col items-center gap-1 border-t px-6 py-12 text-center"
        >
          <InboxIcon aria-hidden="true" className="text-(color:--chatcn-fg-subtle) mb-2 size-5" />
          <p className="text-[0.875rem]/[1.25rem] tracking-[-0.003em] text-(color:--chatcn-fg) font-medium">Nothing waiting for you</p>
          <p className="text-[0.8125rem]/[1.25rem] text-(color:--chatcn-fg-subtle) max-w-72 text-pretty">
            Approvals from every run land here. Agents keep working on other steps while they wait.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <div className="border-(color:--chatcn-border)/70 flex flex-col items-center gap-2 border-t px-6 py-10 text-center">
          <p className="text-[0.8125rem]/[1.25rem] text-(color:--chatcn-fg-subtle)">No approvals match these filters.</p>
          <Button
            size="sm"
            onClick={() => {
              setRunFilter("all")
              setToolFilter("all")
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <ul ref={listRef} aria-labelledby={headingId} className="flex flex-col">
          {shown.map((approval) => (
            <ApprovalRow
              key={approval.id}
              approval={approval}
              selected={selected.has(approval.id)}
              leaving={leaving.has(approval.id)}
              instant={instant}
              now={now}
              onSelect={(next) =>
                setSelected((prev) => {
                  const out = new Set(prev)
                  if (next) out.add(approval.id)
                  else out.delete(approval.id)
                  return out
                })
              }
              onApprove={(scope, keyboard) => approve([approval.id], scope, keyboard)}
              onDeny={(reason, keyboard) => deny([approval.id], reason, keyboard)}
            />
          ))}
        </ul>
      )}

      {showShortcuts && shown.length > 0 ? (
        <footer className="border-(color:--chatcn-border)/70 text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-2.5 pointer-coarse:hidden">
          <span className="flex items-center gap-1.5">
            <Kbd>A</Kbd> Allow
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>D</Kbd> Deny
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>X</Kbd> Select
          </span>
          <span className="ms-auto">On the focused row</span>
        </footer>
      ) : null}
    </section>
  )
}

export default ApprovalInbox
