"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { useSakuga } from "@/components/sakuga/load"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>

/**
 * No icon before a button's label: a leading icon component (lucide and the like) is dropped when the
 * button also has text. Icon-only buttons and loading spinners (animate-spin) keep theirs.
 */
function withoutLeadingIcon(children: React.ReactNode): React.ReactNode {
  const items = React.Children.toArray(children)
  if (items.length < 2) return children
  const [first, ...rest] = items
  if (!React.isValidElement<{ className?: string }>(first) || typeof first.type === "string") return children
  const type = first.type as { displayName?: string; render?: unknown }
  const isIcon = typeof type === "object" && typeof type.render === "function" && Boolean(type.displayName)
  if (!isIcon || first.props.className?.includes("animate-spin")) return children
  const hasLabel = rest.some((item) => typeof item === "string" || typeof item === "number" || React.isValidElement(item))
  return hasLabel ? rest : children
}

/**
 * A Sakuga button draws its own look, so only layout classes (width, margins, flex, position,
 * visibility) are kept from className; colours, padding, heights and borders meant for the old
 * button would paint a box behind the drawing.
 */
const LAYOUT_CLASS =
  /^(?:[a-z0-9-]+:)*-?(?:w-|min-w-|max-w-|flex|grow|shrink|basis-|self-|justify-self-|place-self-|order-|col-|row-|m[trblxy]?-|hidden$|block$|inline|contents$|sr-only$|absolute$|relative$|fixed$|sticky$|inset-|top-|left-|right-|bottom-|z-|size-full$)/
function layoutClasses(className?: string): string {
  return (className ?? "").split(/\s+/).filter((token) => LAYOUT_CLASS.test(token)).join(" ")
}

/** Labelled buttons react like an anime cut (Sakuga); link, ghost and icon-only buttons stay plain. */
const SAKUGA_VARIANTS = new Set<ButtonVariant>(["default", "destructive", "outline", "secondary"])
const SAKUGA_SIZES = new Set<ButtonSize>(["default", "sm", "lg"])

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const sakuga = !asChild && SAKUGA_VARIANTS.has(variant ?? "default") && SAKUGA_SIZES.has(size ?? "default")
  useSakuga(sakuga ? "button" : null)

  if (sakuga) {
    // The custom element fires an ordinary click (and submits its form when type="submit").
    // Primary (default, destructive) gets the impact frame; outline and secondary get the small squash.
    const { type = "button", disabled, children, ref, onClick, ...rest } = props
    const element = (
      <sakuga-button
        ref={ref as unknown as React.Ref<HTMLElement>}
        data-slot="button"
        data-variant={variant ?? "default"}
        data-size={size ?? "default"}
        variant={variant === "outline" || variant === "secondary" ? "secondary" : undefined}
        type={type}
        disabled={disabled || undefined}
        aria-disabled={disabled || undefined}
        className={cn("inline-block", layoutClasses(className))}
        onClick={(event: React.MouseEvent<HTMLElement>) => {
          onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>)
          // Before the script has loaded, the element can't submit its form yet.
          if (type === "submit" && !event.defaultPrevented && !customElements.get("sakuga-button")) {
            event.currentTarget.closest("form")?.requestSubmit()
          }
        }}
        {...(rest as React.HTMLAttributes<HTMLElement>)}
      >
        {withoutLeadingIcon(children)}
      </sakuga-button>
    )
    if (type !== "submit") return element
    // A custom element isn't a native submit button, so Enter in a field would stop submitting the
    // form. A hidden native one keeps that working.
    return (
      <>
        {element}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} disabled={disabled} />
      </>
    )
  }

  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
      {...(asChild ? {} : { children: withoutLeadingIcon(props.children) })}
    />
  )
}

export { Button, buttonVariants }
