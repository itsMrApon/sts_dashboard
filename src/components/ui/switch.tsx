"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useSakuga } from "@/components/sakuga/load"

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
function Switch({
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
