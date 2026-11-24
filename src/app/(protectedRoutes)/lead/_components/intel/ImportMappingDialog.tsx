'use client'

import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  ImportPatchbay,
  type PatchColumn,
  type PatchField,
  type PatchMapping,
} from '@/components/ui/import-patchbay'
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABEL,
  IMPORT_FIELD_SYNONYMS,
  MAX_IMPORT_ROWS,
  type ImportColumnMapping,
} from '@/lib/leads/import/leadImportApps'

/** A file (or an n8n push) waiting to be mapped: its headers, a few rows, and where it came from. */
export type PendingSheet = {
  title: string
  badge: string
  headers: string[]
  rows: string[][]
  /** The mapping saved for this app last time, by header name. */
  saved: ImportColumnMapping
  confirmLabel: string
}

const KINDS: Partial<Record<(typeof IMPORT_FIELDS)[number], PatchField['kind']>> = {
  email: 'email',
  phone: 'phone',
  website: 'url',
}

const FIELDS: PatchField[] = IMPORT_FIELDS.map((field) => ({
  id: field,
  label: IMPORT_FIELD_LABEL[field],
  kind: KINDS[field] ?? 'text',
  required: field === 'name',
  synonyms: IMPORT_FIELD_SYNONYMS[field],
  hint: field === 'name' ? 'a person or a business' : field === 'position' ? 'their job title' : undefined,
}))

/**
 * Your patchbay, unflipped: the file's columns on the left, lead fields on the right. Opens with the
 * mapping this app used last time and auto-patches the rest, so a second export of the same kind
 * is usually one click.
 */
export function ImportMappingDialog({
  sheet,
  busy,
  onClose,
  onConfirm,
}: {
  sheet: PendingSheet | null
  busy: boolean
  onClose: () => void
  /** Gets the mapping by header name. */
  onConfirm: (mapping: ImportColumnMapping) => void
}) {
  return (
    <Dialog open={Boolean(sheet)} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92svh] gap-3 overflow-y-auto p-4 sm:max-w-3xl sm:p-5">
        <DialogHeader>
          <DialogTitle>Match the columns</DialogTitle>
          <DialogDescription>
            Drag a column onto the lead field it holds. Dashed cables are guesses: tap the field to confirm them.
          </DialogDescription>
        </DialogHeader>
        {sheet ? <Board key={sheet.title + sheet.headers.join('|')} sheet={sheet} busy={busy} onConfirm={onConfirm} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function Board({
  sheet,
  busy,
  onConfirm,
}: {
  sheet: PendingSheet
  busy: boolean
  onConfirm: (mapping: ImportColumnMapping) => void
}) {
  const columns: PatchColumn[] = useMemo(
    () =>
      sheet.headers.map((name, i) => ({
        id: `c${i}`,
        name,
        samples: sheet.rows
          .map((r) => r[i]?.trim())
          .filter(Boolean)
          .slice(0, 3),
      })),
    [sheet],
  )
  const initial = useMemo(() => {
    const out: PatchMapping = {}
    for (const field of IMPORT_FIELDS) {
      const header = sheet.saved[field]
      const index = header ? sheet.headers.indexOf(header) : -1
      if (index >= 0) out[field] = `c${index}`
    }
    return out
  }, [sheet])
  const [mapping, setMapping] = useState<PatchMapping>(initial)
  const over = Math.max(0, sheet.rows.length - MAX_IMPORT_ROWS)

  return (
    <>
      <ImportPatchbay
        columns={columns}
        fields={FIELDS}
        value={mapping}
        onValueChange={(next) => setMapping(next)}
        autoPatchOnMount
        badge={sheet.badge}
        fileName={sheet.title}
        rowCount={sheet.rows.length}
        rowHeight={46}
        confirmLabel={busy ? 'Importing…' : sheet.confirmLabel}
        onConfirm={(next) => {
          if (busy) return
          const byHeader: ImportColumnMapping = {}
          for (const field of IMPORT_FIELDS) {
            const id = next[field]
            if (id) byHeader[field] = sheet.headers[Number(id.slice(1))]
          }
          onConfirm(byHeader)
        }}
      />
      {over > 0 ? (
        <p className="text-muted-foreground text-xs">
          This file has {sheet.rows.length.toLocaleString()} rows. The first {MAX_IMPORT_ROWS.toLocaleString()} come
          in; split the rest into another file.
        </p>
      ) : null}
    </>
  )
}
