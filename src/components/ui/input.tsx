"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useSakuga } from "@/components/sakuga/load"

/** Text-like fields are the Sakuga input; dates, files, checkboxes and the rest stay native. */
const SAKUGA_TYPES = new Set<string | undefined>([undefined, "text", "email", "tel", "url", "search", "password", "number"])

const NATIVE_CLASSES =
  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  // A left icon sits inside the field (pl-*): the drawn frame can't make room for it, so keep native there.
  const sakuga = SAKUGA_TYPES.has(type) && !/(^|\s)pl-/.test(className ?? "")
  useSakuga(sakuga ? "input" : null)

  if (!sakuga) {
    return <input type={type} data-slot="input" className={cn(NATIVE_CLASSES, className)} {...props} />
  }

  // The element keeps a real <input> inside. Its input events reach the host, and the host's value is
  // the field's value, so onChange handlers that read event.target.value keep working.
  const { ref, onChange, value, defaultValue, ...rest } = props
  return (
    <sakuga-input
      ref={ref as unknown as React.Ref<HTMLElement>}
      data-slot="input"
      type={type}
      value={value ?? defaultValue}
      className={cn("w-full min-w-0", className)}
      onInput={onChange as unknown as React.FormEventHandler<HTMLElement>}
      {...(rest as React.HTMLAttributes<HTMLElement>)}
    />
  )
}

export { Input }
