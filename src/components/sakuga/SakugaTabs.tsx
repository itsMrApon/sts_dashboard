'use client'

import { useEffect, useRef } from 'react'
import { useSakuga } from './load'

export type SakugaTabOption = { value: string; label: string }

type TabsElement = HTMLElement & { selected: number }

/**
 * Tabs where the raised tab slides to the one you pick (Sakuga). Controlled: pass value and onChange.
 * The element reads its options once, so a new set of options remounts it.
 */
export function SakugaTabs({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: SakugaTabOption[]
  value: string
  onChange: (value: string) => void
  label: string
  className?: string
}) {
  useSakuga('tabs')
  const ref = useRef<TabsElement>(null)
  const index = Math.max(0, options.findIndex((option) => option.value === value))

  // Follow the value when it changes from outside (the element animates its own clicks).
  useEffect(() => {
    const element = ref.current
    if (element && customElements.get('sakuga-tabs') && element.selected !== index) element.selected = index
  }, [index])

  return (
    <sakuga-tabs
      key={options.map((option) => `${option.value}:${option.label}`).join('|')}
      ref={ref}
      label={label}
      selected={index}
      className={className}
      onChange={(event: Event | React.SyntheticEvent) => {
        // React may pass its wrapper or the element's own event; the index is on the native one.
        const native = ('nativeEvent' in event ? event.nativeEvent : event) as CustomEvent<{ index: number; value: string }>
        const detail = native.detail
        const next = options[detail?.index ?? -1]
        if (next && next.value !== value) onChange(next.value)
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </sakuga-tabs>
  )
}
