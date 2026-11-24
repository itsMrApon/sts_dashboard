/**
 * A small CSV reader for lead imports: quoted fields, quotes doubled inside them, line breaks inside
 * quotes, a byte-order mark, and comma, semicolon or tab separators (Excel in many locales saves
 * with semicolons). Values are returned exactly as written, so Bangla and other scripts survive.
 */

const SEPARATORS = [',', ';', '\t'] as const

/** Picks the separator that splits the first line into the most columns, ignoring quoted text. */
function guessSeparator(text: string): string {
  const firstLine = text.slice(0, text.search(/\r?\n/) === -1 ? text.length : text.search(/\r?\n/))
  const unquoted = firstLine.replace(/"[^"]*"/g, '')
  let best: string = ','
  let bestCount = 0
  for (const sep of SEPARATORS) {
    const count = unquoted.split(sep).length - 1
    if (count > bestCount) {
      best = sep
      bestCount = count
    }
  }
  return best
}

export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  const sep = guessSeparator(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
      continue
    }
    if (ch === '"' && field === '') quoted = true
    else if (ch === sep) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Blank lines (a trailing newline, spacer rows) are not leads.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

export type ParsedSheet = {
  /** Header names in file order; a blank header becomes "Column N". */
  headers: string[]
  /** Data rows, each padded to the header count. */
  rows: string[][]
}

export function sheetFromCsv(text: string): ParsedSheet {
  const all = parseCsv(text)
  if (all.length === 0) return { headers: [], rows: [] }
  const width = Math.max(...all.map((r) => r.length))
  const headers = Array.from({ length: width }, (_, i) => all[0][i]?.trim() || `Column ${i + 1}`)
  const rows = all.slice(1).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''))
  return { headers, rows }
}
