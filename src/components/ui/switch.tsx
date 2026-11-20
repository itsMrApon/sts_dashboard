"use client"

import * as React from "react"

import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"
import { useSakuga } from "@/components/sakuga/load"
import { useSakugaEnabled } from "@/components/sakuga/SakugaScope"

type SwitchProps = Omit<React.HTMLAttributes<HTMLElement>, "onChange" | "defaultChecked"> & {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  name?: string
  value?: string
  required?: boolean
}

/**
 * The app's switch: the Sakuga toggle (the knob smears across, the track floods). Same API as before
 * (checked / defaultChecked / onCheckedChange). It stays controlled: if the parent keeps the old
 * value, the toggle is put back.
 */
/** The plain switch, for buyer-facing pages (PlainControls). */
function PlainSwitch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

function Switch(props: SwitchProps) {
  // App screens get the Sakuga toggle; buyer-facing pages keep the plain switch.
  return useSakugaEnabled() ? <SakugaSwitch {...props} /> : <PlainSwitch {...(props as React.ComponentProps<typeof SwitchPrimitive.Root>)} />
}

function SakugaSwitch({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  name,
  value,
  "aria-label": ariaLabel,
  ...props
}: SwitchProps) {
  useSakuga("toggle")
  const ref = React.useRef<HTMLElement & { checked: boolean }>(null)
  const [uncontrolled, setUncontrolled] = React.useState(Boolean(defaultChecked))
  const on = checked ?? uncontrolled

  // Keep the element on the React value after every render (a rejected flip goes back).
  React.useLayoutEffect(() => {
    const element = ref.current
    if (element && element.checked !== on) element.checked = on
  })

  return (
    <sakuga-toggle
      ref={ref}
      data-slot="switch"
      data-state={on ? "checked" : "unchecked"}
      checked={on}
      disabled={disabled || undefined}
      label={ariaLabel}
      name={name}
      value={value}
      className={cn(className)}
      onChange={() => {
        // The element has already flipped itself; read its new state.
        const next = Boolean(ref.current?.checked)
        if (checked === undefined) setUncontrolled(next)
        onCheckedChange?.(next)
      }}
      {...props}
    />
  )
}

export { Switch }
