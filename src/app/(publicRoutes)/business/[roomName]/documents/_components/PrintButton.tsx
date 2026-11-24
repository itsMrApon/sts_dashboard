'use client'

import { Printer } from 'lucide-react'

/** Opens the browser's print dialog, where "Save as PDF" makes the PDF. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700"
    >
      <Printer className="size-4" aria-hidden />
      Print or save as PDF
    </button>
  )
}
