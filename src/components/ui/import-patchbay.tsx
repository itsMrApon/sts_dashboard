"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

/** What a column's values look like, inferred from the samples rather than the header. */
export type ValueKind =
  "email" | "phone" | "url" | "date" | "number" | "currency" | "boolean" | "id" | "text"

export interface PatchColumn {
  /** Stable id. Use the file's column index when headers repeat. */
  id: string
  /** Header exactly as it appears in the file. `col_7` and `E-Mail_Addr` are both fine. */
  name: string
  /** A few real values from that column. Two to four is enough to infer the kind. */
  samples?: string[]
  /** Rows the caller already knows will not import, shown as a warning chip. */
  issues?: number
}

export interface PatchField {
  /** Field id in your schema; this is the key in the mapping object. */
  id: string
  /** Human label shown on the jack. */
  label: string
  /** Blocks `onConfirm` until a cable is patched into it. */
  required?: boolean
  /** What this field expects. Used to read the values, and to veto impossible pairs. */
  kind?: ValueKind
  /** One short line under the label. */
  hint?: string
  /** Extra header spellings that mean this field ("e-mail", "mobile", "org"). */
  synonyms?: string[]
}

/** `{ [fieldId]: columnId }`. One cable per jack: a column appears at most once. */
export type PatchMapping = { [fieldId: string]: string }

/*
 * Aliases instead of inline generics, on purpose. The 21st CLI's source scanner reads every
 * `<Name` as the start of a JSX element and scans to the end of the file for its closing tag,
 * recursing into every later `<Name` on the way, so its work doubles with each generic in the
 * file. Around ten is fine; this file had thirty-five and `21st publish` never finished.
 */
type KindTable = { [kind in ValueKind]: string }
type KindCounts = Map<ValueKind, number>
type StringMap = Map<string, string>
type NumberMap = Map<string, number>
type Ids = Set<string>
type ReadonlyIds = ReadonlySet<string>
/** `fromField`: the cable was lifted out of that field, so dropping it elsewhere moves it. */
type Held = { columnId: string; pointer: boolean; fromField?: string }
type Point = { x: number; y: number }
type ColumnInfo = { column: PatchColumn; kind: ValueKind; filled: number }
type InfoMap = Map<string, ColumnInfo>

export interface PatchSummary {
  /** Fields with a cable in them. */
  patched: number
  /** Fields on the board. */
  fields: number
  /** Patched by inference below `sureThreshold`; these hang dashed. */
  review: number
  /** Ids of required fields still empty. `onConfirm` is blocked while this is non-empty. */
  missingRequired: string[]
  /** Columns in the file that no field takes. */
  unusedColumns: number
  /** No required field is empty. */
  complete: boolean
}

export interface ImportPatchbayProps extends Omit<
  React.ComponentProps<"div">,
  "onChange" | "defaultValue"
> {
  /** Columns found in the uploaded file, in file order. */
  columns: PatchColumn[]
  /** Fields in your schema, in the order you want them on the board. */
  fields: PatchField[]
  /** Controlled mapping. */
  value?: PatchMapping
  /** Initial mapping when uncontrolled. */
  defaultValue?: PatchMapping
  /** Fires on every patch, unpatch and auto-patch with the new mapping and its summary. */
  onValueChange?: (mapping: PatchMapping, summary: PatchSummary) => void
  /** The primary action. The button stays disabled while a required field is empty. */
  onConfirm?: (mapping: PatchMapping) => void
  /** File name shown in the chip above the board. */
  fileName?: string
  /** Row count shown beside it. */
  rowCount?: number
  /** Below this score nothing is proposed (0–1). */
  threshold?: number
  /** At or above this score the cable is solid; between the two it is dashed and counted for review. */
  sureThreshold?: number
  /** Row height in px. Rows are a fixed height so every cable is arithmetic, not a measurement. */
  rowHeight?: number
  /** Widest the cable gutter gets, in px. It narrows to 20% of the board (floor 52px) when space is short. */
  gutterWidth?: number
  /** How far a cable droops, as a fraction of `gutterWidth`. Constant in px at every board width. */
  sag?: number
  /** Show two sample values under each column name. */
  showSamples?: boolean
  /** Show the inferred kind on columns and the expected kind on fields. */
  showKinds?: boolean
  /**
   * Let one column feed several fields. Off by default, because one cable per jack is what makes
   * "this column is silently imported twice" unrepresentable — but splitting one `full_name` into
   * First name and Last name is a real and common mapping, so it is one prop away.
   */
  reuseColumns?: boolean
  /** Run the matcher once on mount instead of waiting for the button. */
  autoPatchOnMount?: boolean
  /** Label of the auto-patch button; the count is appended. */
  autoPatchLabel?: string
  /** Label of the primary button. */
  confirmLabel?: string
  /**
   * Draw the fields on the left and the columns on the right. The mapping is unchanged (each field
   * still takes one column), only the sides swap, so a board can read "what you want ← where from".
   */
  flip?: boolean
  /** The square chip in the header. */
  badge?: string
  /** The line under the title; replaces the row and column count. */
  subtitle?: React.ReactNode
  /** The two list headings. */
  headings?: { columns: string; fields: string }
  /** Show the auto-patch button. Off when the matcher has nothing to go on (no samples, no headers). */
  showAutoPatch?: boolean
  /** Replaces the sentence beside the count in the footer. */
  describe?: (summary: PatchSummary) => string
}

/* -------------------------------------------------------------------------- */
/*  The sniffer: what kind of value is this?                                   */
/* -------------------------------------------------------------------------- */

const KIND_LABEL: KindTable = {
  email: "email",
  phone: "phone",
  url: "url",
  date: "date",
  number: "number",
  currency: "amount",
  boolean: "yes/no",
  id: "id",
  text: "text",
}

/** Narrow boards keep the evidence but shorten it; truncating the words gives "ema" and "amo". */
const KIND_SHORT: KindTable = {
  email: "@",
  phone: "tel",
  url: "link",
  date: "date",
  number: "123",
  currency: "$",
  boolean: "y/n",
  id: "id",
  text: "abc",
}

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec"
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const RE_URL = /^(https?:\/\/|www\.)\S+\.\S+$/i
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RE_ISO = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/
const RE_SLASH = /^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/
const RE_MDY = new RegExp(`^(${MONTHS})[a-z]*\\.?\\s+\\d{1,2},?\\s+\\d{4}$`, "i")
const RE_DMY = new RegExp(`^\\d{1,2}\\s+(${MONTHS})[a-z]*\\.?\\s+\\d{4}$`, "i")
const RE_CUR_PRE = /^[-+]?[$€£¥₹]\s?[\d,]+(\.\d+)?$/
const RE_CUR_POST = /^[-+]?[\d,]+(\.\d+)?\s?(usd|eur|gbp|inr|chf)$/i
const RE_BOOL = /^(true|false|yes|no|y|n|t|f)$/i
const RE_PHONE = /^\+?[\d(][\d\s().-]{5,}$/
const RE_GROUPED = /^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/
const RE_PLAIN = /^[-+]?\d*\.?\d+$/

/** One value → one kind. Order matters: the narrow patterns are tried first. */
function sniffValue(raw: string): ValueKind {
  const v = raw.trim()
  if (!v) return "text"
  if (RE_EMAIL.test(v)) return "email"
  if (RE_URL.test(v)) return "url"
  if (RE_UUID.test(v)) return "id"
  if (RE_ISO.test(v) || RE_SLASH.test(v) || RE_MDY.test(v) || RE_DMY.test(v)) return "date"
  if (RE_CUR_PRE.test(v) || RE_CUR_POST.test(v)) return "currency"
  if (RE_BOOL.test(v)) return "boolean"
  // A phone needs a separator or a leading +; bare digits stay a number, which is the honest read.
  const digits = v.replace(/\D/g, "")
  if (RE_PHONE.test(v) && /[\s().+-]/.test(v) && digits.length >= 7 && digits.length <= 15)
    return "phone"
  if (RE_GROUPED.test(v) || RE_PLAIN.test(v)) return "number"
  return "text"
}

/** A column takes the kind at least 60% of its non-empty samples agree on, else "text". */
function sniffColumn(samples: readonly string[]): { kind: ValueKind; filled: number } {
  const values = samples.map((s) => (s ?? "").trim())
  const present = values.filter(Boolean)
  if (present.length === 0) return { kind: "text", filled: 0 }
  const counts: KindCounts = new Map()
  for (const v of present) {
    const k = sniffValue(v)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  let best: ValueKind = "text"
  let bestN = 0
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k
      bestN = n
    }
  }
  return {
    kind: bestN / present.length >= 0.6 ? best : "text",
    filled: present.length / values.length,
  }
}

/* -------------------------------------------------------------------------- */
/*  The matcher: how well does this column fit this field?                     */
/* -------------------------------------------------------------------------- */

/** Header tokens that mean the same thing. Matching happens on the group, not the word. */
const TOKEN_GROUPS: readonly (readonly string[])[] = [
  ["email", "emails", "mail", "e"],
  ["phone", "tel", "telephone", "mobile", "cell", "cellphone", "msisdn"],
  ["company", "org", "organisation", "organization", "employer", "business", "account"],
  ["first", "given", "forename", "fname"],
  ["last", "surname", "family", "lname"],
  ["full", "contact", "person", "customer", "user"],
  ["date", "on", "when", "time", "timestamp", "ts"],
  ["signed", "signup", "registered", "created", "joined", "since", "start"],
  ["zip", "postcode", "postal"],
  ["street", "addr", "line"],
  ["city", "town", "locality"],
  ["country", "nation"],
  ["state", "province", "region"],
  ["id", "identifier", "uuid", "key", "ref", "reference", "external"],
  ["amount", "total", "price", "cost", "revenue", "mrr", "spend"],
  ["title", "role", "position", "job"],
  ["website", "site", "url", "link", "homepage", "domain"],
  ["notes", "note", "comment", "comments", "description", "remarks"],
  ["status", "stage", "lifecycle"],
  ["plan", "tier", "subscription", "package", "product"],
  ["source", "channel", "origin", "campaign", "utm"],
]

const GROUP_OF: StringMap = new Map()
for (let g = 0; g < TOKEN_GROUPS.length; g++) {
  for (const t of TOKEN_GROUPS[g] ?? []) GROUP_OF.set(t, `g${g}`)
}

/** Tokens that carry almost no meaning on their own; they count for a third of a real one. */
const WEAK = new Set([
  "address",
  "name",
  "no",
  "num",
  "number",
  "field",
  "col",
  "column",
  "data",
  "info",
  "value",
  "the",
  "of",
  "1",
  "2",
  "3",
])

function tokenize(s: string): string[] {
  return s
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

const canon = (t: string): string => GROUP_OF.get(t) ?? t
const weightOf = (t: string): number => (WEAK.has(t) ? 0.35 : 1)
const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)
const compact = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "")

function trigrams(s: string): Ids {
  const out: Ids = new Set()
  const padded = `  ${s} `
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3))
  return out
}

/** Dice coefficient — catches abbreviations and typos that token matching misses ("emal", "phn"). */
function dice(a: string, b: string): number {
  if (!a || !b) return 0
  const A = trigrams(a)
  const B = trigrams(b)
  let shared = 0
  for (const t of A) if (B.has(t)) shared++
  return (2 * shared) / (A.size + B.size)
}

/** Header-name evidence, 0–1, taken against the field's label, id and synonyms. */
function nameScore(columnName: string, field: PatchField): number {
  const cols = tokenize(columnName)
  if (cols.length === 0) return 0
  const colSet = new Set(cols.map(canon))
  let best = 0
  for (const target of [field.label, field.id, ...(field.synonyms ?? [])]) {
    const want = tokenize(target)
    if (want.length === 0) continue
    const wantSet = new Set(want.map(canon))
    let matched = 0
    let wanted = 0
    for (const t of want) {
      wanted += weightOf(t)
      if (colSet.has(canon(t))) matched += weightOf(t)
    }
    let extra = 0
    for (const t of cols) if (!wantSet.has(canon(t))) extra += weightOf(t)
    const recall = wanted > 0 ? matched / wanted : 0
    const precision = matched > 0 ? matched / (matched + extra) : 0
    const byToken = recall * 0.75 + precision * 0.25
    const byShape = dice(compact(columnName), compact(target)) * 0.85
    best = Math.max(best, byToken, byShape)
  }
  return clamp01(best)
}

/** Kinds that are not equal but not nonsense either. Anything unlisted is a veto. */
const AFFINITY: { [a in ValueKind]?: { [b in ValueKind]?: number } } = {
  number: { currency: 0.7, id: 0.3, boolean: 0.25 },
  currency: { number: 0.7 },
  phone: { number: 0.35 },
  id: { number: 0.35, text: 0.25 },
  url: { text: 0.2 },
  date: { number: 0.15 },
}

/**
 * Kind score used when there is no kind evidence to weigh: the column carries no values, or the
 * field declares no `kind`. Neutral rather than low, so the header name decides. Scoring absent
 * evidence as *bad* evidence is what makes every cable hang dashed on a schema that omits `kind`.
 */
const NO_EVIDENCE_KIND = 0.55

/**
 * What a pair keeps when the values veto it. Tuned so only a near-perfect header (name ≥ 0.91)
 * clears the 0.4 floor, and nothing vetoed can ever reach `sureThreshold` — a contradicted pair is
 * a question, never an answer.
 */
const VETOED_WEIGHT = 0.44

/** Value evidence, −1 to 1. −1 means the values contradict the field (see `VETOED_WEIGHT`). */
function kindScore(column: ValueKind, field?: ValueKind): number {
  if (!field) return NO_EVIDENCE_KIND
  // Two untyped ends agreeing is the weakest agreement there is. Scoring it as an exact match would
  // let a column of junk claim any free text field on kind alone; at 0.5 the header names decide.
  if (field === "text" && column === "text") return 0.5
  if (field === column) return 1
  if (field === "text") return 0.35 // a text field takes anything, weakly
  if (column === "text") return 0.1 // nothing legible in the values: no evidence either way
  return AFFINITY[field]?.[column] ?? -1
}

/* -------------------------------------------------------------------------- */
/*  Geometry — every coordinate is arithmetic on a row index, never a measure   */
/* -------------------------------------------------------------------------- */

const ROW_GAP = 8

const rowCenter = (index: number, rowHeight: number): number =>
  index * (rowHeight + ROW_GAP) + rowHeight / 2

/**
 * Cables are drawn in a 100-unit-wide viewBox that is stretched to whatever width the gutter ends up
 * with, so the board is fluid down to 390px without measuring anything: the x axis is unitless, the
 * y axis is real pixels (row arithmetic), and `droop` is a pixel offset that therefore stays constant
 * at every width. Strokes carry `vector-effect="non-scaling-stroke"` so the anisotropic scale cannot
 * smear them.
 */
const CABLE_UNITS = 100

/** A hanging patch cable: both ends horizontal, the middle sagging under its own weight. */
function cablePath(y0: number, y1: number, droop: number): string {
  return `M 0 ${y0} C 42 ${(y0 + droop).toFixed(2)}, 58 ${(y1 + droop).toFixed(2)}, ${CABLE_UNITS} ${y1}`
}

/** The cable in your hand: plugged at the jack, the free end following the pointer. */
function looseCable(y0: number, x: number, y: number, droop: number): string {
  return `M 0 ${y0} C 50 ${(y0 + droop).toFixed(2)}, ${(x - 20).toFixed(2)} ${y.toFixed(2)}, ${x.toFixed(2)} ${y.toFixed(2)}`
}

/* -------------------------------------------------------------------------- */
/*  Summary                                                                    */
/* -------------------------------------------------------------------------- */

function summarize(
  mapping: PatchMapping,
  columns: PatchColumn[],
  fields: PatchField[],
  guesses: ReadonlyIds
): PatchSummary {
  const used = new Set(Object.values(mapping))
  const missingRequired = fields.filter((f) => f.required && !mapping[f.id]).map((f) => f.id)
  return {
    patched: fields.filter((f) => mapping[f.id]).length,
    fields: fields.length,
    review: fields.filter((f) => mapping[f.id] && guesses.has(f.id)).length,
    missingRequired,
    unusedColumns: columns.filter((c) => !used.has(c.id)).length,
    complete: missingRequired.length === 0,
  }
}

/* -------------------------------------------------------------------------- */
/*  Styles for the two flourishes (the resting state never depends on them)    */
/* -------------------------------------------------------------------------- */

const CSS = `
@keyframes ip-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes ip-seat{0%{transform:scale(1)}45%{transform:scale(1.12)}100%{transform:scale(1)}}
.ip-draw{animation:ip-draw 260ms cubic-bezier(.22,1,.36,1)}
.ip-seat{animation:ip-seat 200ms cubic-bezier(.22,1,.36,1)}
@media (prefers-reduced-motion:reduce){.ip-draw,.ip-seat{animation:none}}
`

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

const STAGGER_MS = 55

/** Travel, in px, before a press counts as a drag rather than a tap. */
const DRAG_SLOP = 5

/**
 * A column mapper for file imports, built like a patchbay: one jack per column in the file, one per
 * field in your schema, and a cable between them. `Auto-patch` reads the sample values as well as the
 * header names, so a column called `col_7` full of ISO dates still finds `Signed up`; matches it is
 * unsure of stay dashed until a human confirms them.
 *
 * Drag a jack to patch it, or use the keyboard: Enter picks a column up, arrows choose the field,
 * Enter drops it in.
 */
export function ImportPatchbay({
  columns,
  fields,
  value,
  defaultValue,
  onValueChange,
  onConfirm,
  fileName,
  rowCount,
  threshold = 0.4,
  sureThreshold = 0.68,
  rowHeight = 52,
  gutterWidth = 96,
  sag = 0.18,
  showSamples = true,
  showKinds = true,
  reuseColumns = false,
  autoPatchOnMount = false,
  autoPatchLabel = "Auto-patch",
  confirmLabel = "Import",
  flip = false,
  badge = "CSV",
  subtitle,
  headings = { columns: "In the file", fields: "Your fields" },
  showAutoPatch = true,
  describe,
  className,
  style,
  ref,
  ...rest
}: ImportPatchbayProps) {
  const uid = React.useId()
  const [internal, setInternal] = React.useState((defaultValue ?? {}) as PatchMapping)
  const mapping = value ?? internal

  /** Field ids whose cable came from an inference the matcher was not sure about. */
  const [guesses, setGuesses] = React.useState((): ReadonlyIds => new Set())
  /** Cables not yet revealed by the stagger timers. Timers own visibility; CSS only decorates. */
  const [pending, setPending] = React.useState((): ReadonlyIds => new Set())
  /** Cables currently playing the draw flourish. */
  const [drawing, setDrawing] = React.useState((): ReadonlyIds => new Set())

  const [held, setHeld] = React.useState(null as Held | null)
  const [candidate, setCandidate] = React.useState(null as number | null)
  const [activeColumn, setActiveColumn] = React.useState(0)
  const [activeField, setActiveField] = React.useState(0)
  const [message, setMessage] = React.useState("")

  const boardRef = React.useRef(null as HTMLDivElement | null)
  const gutterRef = React.useRef(null as SVGSVGElement | null)
  const looseRef = React.useRef(null as SVGPathElement | null)
  const gutterRect = React.useRef(null as DOMRect | null)
  const loosePoint = React.useRef(null as Point | null)
  const columnRefs = React.useRef([] as (HTMLButtonElement | null)[])
  const fieldRefs = React.useRef([] as (HTMLButtonElement | null)[])
  const timers = React.useRef([] as number[])
  /** Where the press started and whether it has travelled far enough to count as a drag. */
  const pressAt = React.useRef(null as Point | null)
  const moved = React.useRef(false)

  React.useEffect(() => {
    const pool = timers.current
    return () => {
      for (const t of pool) window.clearTimeout(t)
      pool.length = 0
      // StrictMode runs this cleanup right after mount, which cancels the reveal that
      // `autoPatchOnMount` just scheduled. Show everything rather than leave cables hidden.
      setPending(new Set())
      setDrawing(new Set())
    }
  }, [])

  /* ---------------------------- derived data ----------------------------- */

  const infos = React.useMemo(
    () => columns.map((c) => ({ column: c, ...sniffColumn(c.samples ?? []) })),
    [columns]
  )

  /** Every column/field pair, scored once. */
  const scores = React.useMemo(() => {
    // Process of elimination: one column of a kind and one field wanting it is real evidence.
    const columnKinds: KindCounts = new Map()
    for (const i of infos) columnKinds.set(i.kind, (columnKinds.get(i.kind) ?? 0) + 1)
    const fieldKinds: KindCounts = new Map()
    for (const f of fields) if (f.kind) fieldKinds.set(f.kind, (fieldKinds.get(f.kind) ?? 0) + 1)

    const table: NumberMap = new Map()
    for (const info of infos) {
      for (const field of fields) {
        // A column with no values at all is not "text", it is silence: judge it on its header alone
        // with a neutral kind score rather than penalising it for evidence nobody gave us.
        const hasValues = info.filled > 0
        const k = hasValues ? kindScore(info.kind, field.kind) : NO_EVIDENCE_KIND
        const n = nameScore(info.column.name, field)
        if (k < 0) {
          // The values contradict the field, so this must never be proposed on the strength of the
          // values. But two unrepresentative sample rows must not permanently disqualify an
          // unambiguous header either: a near-perfect name still surfaces, and always as a guess.
          table.set(`${info.column.id}|${field.id}`, clamp01(VETOED_WEIGHT * n))
          continue
        }
        let s = 0.55 * n + 0.45 * k
        if (n > 0.25 && k >= 0.7) s += 0.12 // name and values agree
        if (
          info.kind !== "text" &&
          field.kind === info.kind &&
          columnKinds.get(info.kind) === 1 &&
          fieldKinds.get(info.kind) === 1
        )
          s += 0.25
        if (hasValues && info.filled < 0.5) s *= 0.85 // a mostly empty column is weaker evidence
        table.set(`${info.column.id}|${field.id}`, clamp01(s))
      }
    }
    return table
  }, [infos, fields])

  const scoreOf = React.useCallback(
    (columnId: string, fieldId: string) => scores.get(`${columnId}|${fieldId}`) ?? 0,
    [scores]
  )

  /**
   * Strongest pair first, one cable per jack, existing patches left alone. Greedy rather than
   * globally optimal on purpose: it is explainable, and the user can always re-patch.
   */
  const proposals = React.useMemo(() => {
    const takenFields = new Set(Object.keys(mapping).filter((f) => mapping[f]))
    const takenColumns = new Set(Object.values(mapping))
    const pairs: { columnId: string; fieldId: string; score: number; margin: number }[] = []
    for (const info of infos) {
      if (takenColumns.has(info.column.id)) continue
      for (const field of fields) {
        if (takenFields.has(field.id)) continue
        const s = scoreOf(info.column.id, field.id)
        if (s < threshold) continue
        // How much better this field is for this column than the column's next-best home anywhere.
        // A column with somewhere better to be has a weaker claim than one with nowhere else to go.
        let elsewhere = 0
        for (const other of fields) {
          if (other.id === field.id) continue
          const s2 = scoreOf(info.column.id, other.id)
          if (s2 > elsewhere) elsewhere = s2
        }
        pairs.push({ columnId: info.column.id, fieldId: field.id, score: s, margin: s - elsewhere })
      }
    }
    // Score, then margin. Sorting on score alone left the flagship case (two date columns, one date
    // field, both scoring 0.450) decided by the order the columns happen to appear in the file.
    pairs.sort((a, b) => b.score - a.score || b.margin - a.margin)
    const outColumns: Ids = new Set()
    const outFields: Ids = new Set()
    const picked: typeof pairs = []
    for (const p of pairs) {
      if (outColumns.has(p.columnId) || outFields.has(p.fieldId)) continue
      // Still tied after the margin: two columns fit this field equally well and have equally
      // little claim elsewhere. That is a coin flip, and a coin flip presented as a match is worse
      // than an empty jack asking the question, so propose neither.
      const rival = pairs.some(
        (q) =>
          q.fieldId === p.fieldId &&
          q.columnId !== p.columnId &&
          !outColumns.has(q.columnId) &&
          Math.abs(q.score - p.score) < 1e-9 &&
          Math.abs(q.margin - p.margin) < 1e-9
      )
      if (rival) continue
      outColumns.add(p.columnId)
      outFields.add(p.fieldId)
      picked.push(p)
    }
    return picked
  }, [infos, fields, mapping, scoreOf, threshold])

  const summary = React.useMemo(
    () => summarize(mapping, columns, fields, guesses),
    [mapping, columns, fields, guesses]
  )

  const columnToField = React.useMemo(() => {
    const out: StringMap = new Map()
    for (const [fieldId, columnId] of Object.entries(mapping))
      if (columnId) out.set(columnId, fieldId)
    return out
  }, [mapping])

  const columnIndex = React.useMemo(() => {
    const out: NumberMap = new Map()
    columns.forEach((c, i) => out.set(c.id, i))
    return out
  }, [columns])

  const infoById = React.useMemo(() => {
    const out: InfoMap = new Map()
    for (const i of infos) out.set(i.column.id, i)
    return out
  }, [infos])

  /* ------------------------------- commits -------------------------------- */

  const commit = React.useCallback(
    (next: PatchMapping, nextGuesses: ReadonlyIds, note: string) => {
      if (value === undefined) setInternal(next)
      setGuesses(nextGuesses)
      setMessage(note)
      onValueChange?.(next, summarize(next, columns, fields, nextGuesses))
    },
    [value, onValueChange, columns, fields]
  )

  const reveal = React.useCallback((ids: string[], stagger: boolean) => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
    if (reduce || ids.length === 0) return
    // Timers own the reveal so a browser that never runs an animation frame still shows every cable.
    setPending(new Set(stagger ? ids : []))
    ids.forEach((id, i) => {
      const at = stagger ? i * STAGGER_MS : 0
      const t = window.setTimeout(() => {
        setPending((prev) => {
          const nextSet = new Set(prev)
          nextSet.delete(id)
          return nextSet
        })
        setDrawing((prev) => new Set(prev).add(id))
        const off = window.setTimeout(
          () =>
            setDrawing((prev) => {
              const nextSet = new Set(prev)
              nextSet.delete(id)
              return nextSet
            }),
          320
        )
        timers.current.push(off)
      }, at)
      timers.current.push(t)
    })
  }, [])

  const patch = React.useCallback(
    (columnId: string, fieldId: string, asGuess = false, fromField?: string) => {
      const next: PatchMapping = {}
      const vacated: string[] = []
      for (const [f, c] of Object.entries(mapping)) {
        if (c && (reuseColumns || c !== columnId)) next[f] = c
        else if (c) vacated.push(f)
      }
      // With reuse on, a column can sit in several fields, so a cable lifted from one field has to
      // leave it explicitly; without reuse the loop above already moved it.
      if (fromField && fromField !== fieldId && next[fromField] === columnId) {
        delete next[fromField]
        vacated.push(fromField)
      }
      next[fieldId] = columnId
      const nextGuesses = new Set(guesses)
      // The cable left these fields, so their "needs review" flag left with it.
      for (const f of vacated) nextGuesses.delete(f)
      if (asGuess) nextGuesses.add(fieldId)
      else nextGuesses.delete(fieldId)
      const column = columns.find((c) => c.id === columnId)
      const field = fields.find((f) => f.id === fieldId)
      commit(
        next,
        nextGuesses,
        `Patched ${column?.name ?? "column"} into ${field?.label ?? "field"}.`
      )
      reveal([fieldId], false)
    },
    [mapping, guesses, columns, fields, commit, reveal, reuseColumns]
  )

  const unpatch = React.useCallback(
    (fieldId: string) => {
      if (!mapping[fieldId]) return
      const next: PatchMapping = {}
      for (const [f, c] of Object.entries(mapping)) if (c && f !== fieldId) next[f] = c
      const nextGuesses = new Set(guesses)
      nextGuesses.delete(fieldId)
      const field = fields.find((f) => f.id === fieldId)
      commit(next, nextGuesses, `Unpatched ${field?.label ?? "field"}.`)
    },
    [mapping, guesses, fields, commit]
  )

  const autoPatch = React.useCallback(() => {
    if (proposals.length === 0) return
    const next: PatchMapping = { ...mapping }
    const nextGuesses = new Set(guesses)
    for (const p of proposals) {
      next[p.fieldId] = p.columnId
      if (p.score < sureThreshold) nextGuesses.add(p.fieldId)
      else nextGuesses.delete(p.fieldId)
    }
    const unsure = proposals.filter((p) => p.score < sureThreshold).length
    commit(
      next,
      nextGuesses,
      `Patched ${proposals.length} ${proposals.length === 1 ? "column" : "columns"}` +
        (unsure > 0 ? `, ${unsure} to review.` : ".")
    )
    reveal(
      proposals.map((p) => p.fieldId),
      true
    )
  }, [proposals, mapping, guesses, sureThreshold, commit, reveal])

  const didMount = React.useRef(false)
  React.useEffect(() => {
    if (didMount.current || !autoPatchOnMount) return
    didMount.current = true
    autoPatch()
  }, [autoPatchOnMount, autoPatch])

  /* ------------------------------- pointer -------------------------------- */

  const pointTo = React.useCallback(
    (clientX: number, clientY: number) => {
      const rect = gutterRect.current
      if (!rect || rect.width === 0) return
      // The pointer is in CSS pixels; the cable lives in the 100-unit x axis, which runs from the
      // column side to the field side (right to left on a flipped board, where the gutter is mirrored).
      const x = ((flip ? rect.right - clientX : clientX - rect.left) / rect.width) * CABLE_UNITS
      const y = clientY - rect.top
      loosePoint.current = { x, y }
      const path = looseRef.current
      if (path && held) {
        const from = rowCenter(columnIndex.get(held.columnId) ?? 0, rowHeight)
        path.setAttribute("d", looseCable(from, x, y, gutterWidth * sag))
      }
      // Which field row is the pointer over? Pure arithmetic on the shared top edge — no hit-testing.
      const armed = x > CABLE_UNITS * 0.3
      const index = Math.floor(y / (rowHeight + ROW_GAP))
      const within = y - index * (rowHeight + ROW_GAP) <= rowHeight
      const next = armed && within && index >= 0 && index < fields.length ? index : null
      setCandidate((prev) => (prev === next ? prev : next))
    },
    [held, columnIndex, rowHeight, gutterWidth, sag, fields.length, flip]
  )

  React.useEffect(() => {
    if (!held?.pointer) return
    const move = (e: PointerEvent) => {
      const from = pressAt.current
      if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > DRAG_SLOP)
        moved.current = true
      pointTo(e.clientX, e.clientY)
    }
    const up = () => {
      if (!moved.current) {
        // A tap, not a drag: latch the cable so the next tap on a field drops it in. Without this
        // the pointer model is unusable on touch, where dragging scrolls the page, and a plain
        // click on a desktop would resolve to "dropped on nothing".
        const name = columns.find((c) => c.id === held.columnId)?.name ?? "column"
        setHeld({ columnId: held.columnId, pointer: false, fromField: held.fromField })
        loosePoint.current = null
        setMessage(`Holding ${name}. Tap a field to patch it, or press Escape.`)
        return
      }
      const target = candidate !== null ? fields[candidate] : undefined
      // Dropping on nothing puts the cable back. Unpatching is only ever explicit — losing a
      // mapping to a slipped drag is data loss in an import wizard.
      if (target) patch(held.columnId, target.id, false, held.fromField)
      else setMessage("Dropped on nothing. Nothing changed.")
      setHeld(null)
      setCandidate(null)
      loosePoint.current = null
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
    }
  }, [held, candidate, fields, columns, patch, pointTo])

  const pickUp = React.useCallback(
    (columnId: string, pointer: boolean, e?: React.PointerEvent, fromField?: string) => {
      gutterRect.current = gutterRef.current?.getBoundingClientRect() ?? null
      const alreadyIn = fromField ?? columnToField.get(columnId)
      setHeld({ columnId, pointer, fromField })
      setCandidate(alreadyIn ? fields.findIndex((f) => f.id === alreadyIn) : null)
      const column = columns.find((c) => c.id === columnId)
      setMessage(
        pointer
          ? `Holding ${column?.name ?? "column"}. Drop it on a field.`
          : `Holding ${column?.name ?? "column"}. Arrow keys choose a field, Enter patches, Escape drops it.`
      )
      if (e) pointTo(e.clientX, e.clientY)
    },
    [columnToField, fields, columns, pointTo]
  )

  const cancelHold = React.useCallback(() => {
    setHeld(null)
    setCandidate(null)
    loosePoint.current = null
    setMessage("Cancelled.")
  }, [])

  /* ------------------------------ keyboard -------------------------------- */

  const focusColumn = (i: number) => {
    const next = Math.max(0, Math.min(columns.length - 1, i))
    setActiveColumn(next)
    columnRefs.current[next]?.focus()
  }
  const focusField = (i: number) => {
    const next = Math.max(0, Math.min(fields.length - 1, i))
    setActiveField(next)
    fieldRefs.current[next]?.focus()
  }

  const onColumnKeyDown = (e: React.KeyboardEvent, index: number, columnId: string) => {
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0
    if (step !== 0) {
      e.preventDefault()
      if (held) {
        const from = candidate ?? -1
        const next = Math.max(0, Math.min(fields.length - 1, from + step))
        setCandidate(next)
        setMessage(`${fields[next]?.label ?? ""} — press Enter to patch.`)
      } else {
        focusColumn(index + step)
      }
      return
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault()
      focusColumn(e.key === "Home" ? 0 : columns.length - 1)
      return
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      if (!held) {
        pickUp(columnId, false)
      } else if (candidate !== null && fields[candidate]) {
        patch(held.columnId, fields[candidate].id, false, held.fromField)
        setHeld(null)
        setCandidate(null)
      } else {
        setMessage("Choose a field with the arrow keys first.")
      }
      return
    }
    if (e.key === "Escape" && held) {
      e.preventDefault()
      cancelHold()
      return
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      const fieldId = columnToField.get(columnId)
      if (fieldId) {
        e.preventDefault()
        unpatch(fieldId)
      }
    }
  }

  const onFieldKeyDown = (e: React.KeyboardEvent, index: number, fieldId: string) => {
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0
    if (step !== 0) {
      e.preventDefault()
      focusField(index + step)
      return
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault()
      focusField(e.key === "Home" ? 0 : fields.length - 1)
      return
    }
    if (e.key === "Escape" && held) {
      e.preventDefault()
      cancelHold()
      return
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (mapping[fieldId]) {
        e.preventDefault()
        unpatch(fieldId)
      }
    }
  }

  const onFieldActivate = (fieldId: string) => {
    if (held) {
      patch(held.columnId, fieldId, false, held.fromField)
      setHeld(null)
      setCandidate(null)
      return
    }
    if (guesses.has(fieldId)) {
      const next = new Set(guesses)
      next.delete(fieldId)
      setGuesses(next)
      const field = fields.find((f) => f.id === fieldId)
      setMessage(`Confirmed ${field?.label ?? "field"}.`)
      return
    }
    // Never unpatch on a plain click: pick the cable up instead, so a misclick costs a keystroke
    // rather than a mapping. Unpatching stays on Delete/Backspace.
    const columnId = mapping[fieldId]
    if (columnId) pickUp(columnId, false, undefined, fieldId)
  }

  /* -------------------------------- render -------------------------------- */

  const boardHeight =
    Math.max(columns.length, fields.length) * (rowHeight + ROW_GAP) - ROW_GAP || rowHeight
  // A pixel offset, kept off the fluid x axis so a cable droops the same at 390px and at 1280px.
  const droop = gutterWidth * sag

  const cables = fields.flatMap((field, fieldIdx) => {
    const columnId = mapping[field.id]
    if (!columnId) return []
    const colIdx = columnIndex.get(columnId)
    if (colIdx === undefined) return []
    return [
      {
        key: field.id,
        d: cablePath(rowCenter(colIdx, rowHeight), rowCenter(fieldIdx, rowHeight), droop),
        guess: guesses.has(field.id),
        hidden: pending.has(field.id),
        drawing: drawing.has(field.id),
        lit: held?.columnId === columnId,
      },
    ]
  })

  const heldFrom = held ? rowCenter(columnIndex.get(held.columnId) ?? 0, rowHeight) : 0
  const looseD = held
    ? candidate !== null && !held.pointer
      ? cablePath(heldFrom, rowCenter(candidate, rowHeight), droop)
      : loosePoint.current
        ? looseCable(heldFrom, loosePoint.current.x, loosePoint.current.y, droop)
        : cablePath(heldFrom, heldFrom, droop)
    : ""

  const missingLabels = summary.missingRequired
    .map((id) => fields.find((f) => f.id === id)?.label)
    .filter(Boolean)

  const blocked = !summary.complete || columns.length === 0

  // A column no field takes is dropped from the import without ever being mentioned. Say it.
  const unusedNote =
    summary.unusedColumns > 0
      ? `, and ${summary.unusedColumns} column${summary.unusedColumns === 1 ? "" : "s"} will not be imported.`
      : ""

  const verdict = describe
    ? describe(summary)
    : columns.length === 0
      ? "Nothing to map yet."
      : missingLabels.length > 0
        ? `${missingLabels.join(", ")} still ${missingLabels.length === 1 ? "needs" : "need"} a column.`
        : summary.review > 0
          ? `${summary.review} match${summary.review === 1 ? "" : "es"} to review` + unusedNote
          : "Every required field has a column" + (unusedNote || ".")

  return (
    <div
      data-slot="import-patchbay"
      ref={ref}
      style={style}
      className={cn(
        "bg-card text-card-foreground border-border w-full overflow-hidden rounded-xl border shadow-sm",
        className
      )}
      {...rest}
    >
      <style>{CSS}</style>

      {/* file chip + the matcher's own button */}
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            // text-foreground, not muted: muted on bg-muted measures 4.35:1 in light, under the floor.
            className="border-border bg-muted text-foreground flex size-8 flex-none items-center justify-center rounded-md border font-mono text-[10px] font-medium"
          >
            {badge}
          </span>
          <span className="min-w-0">
            <span className="text-foreground block truncate text-sm font-medium">
              {fileName ?? "Uploaded file"}
            </span>
            <span className="text-muted-foreground block text-xs tabular-nums">
              {subtitle ?? (
                <>
                  {rowCount !== undefined ? `${rowCount.toLocaleString()} rows · ` : ""}
                  {columns.length} {columns.length === 1 ? "column" : "columns"}
                </>
              )}
            </span>
          </span>
        </div>
        {showAutoPatch ? (
        <button
          type="button"
          data-slot="cta-primary"
          id="auto-patch"
          onClick={autoPatch}
          disabled={proposals.length === 0}
          className={cn(
            // h-11, not h-9: this is the component's primary affordance and a touch target.
            "border-border bg-background text-foreground inline-flex h-11 flex-none items-center gap-2 rounded-full border px-4 text-sm font-medium",
            "transition-[background-color,border-color,transform] duration-150 ease-out",
            "hover:bg-muted focus-visible:ring-ring/50 active:scale-[0.98] focus-visible:ring-[3px] focus-visible:outline-none",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="text-primary size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M2 4.5h3.5a3 3 0 0 1 3 3v1a3 3 0 0 0 3 3H14" />
            <path d="M11.5 9 14 11.5 11.5 14" />
          </svg>
          {autoPatchLabel}
          {proposals.length > 0 ? ` ${proposals.length}` : ""}
        </button>
        ) : null}
      </div>

      {/* the board */}
      <div className="@container/board px-4 pt-4 pb-1">
        <div
          hidden={columns.length === 0}
          className={cn(
            "text-muted-foreground mb-2 flex items-center text-[11px] font-medium tracking-wide uppercase",
            flip && "flex-row-reverse"
          )}
        >
          <span className="min-w-0 flex-1">{headings.columns}</span>
          {/* Same track as the gutter below, so the two headings stay over their own lists. */}
          <span
            aria-hidden="true"
            className="flex-none"
            style={{ width: `clamp(52px, 20%, ${gutterWidth}px)` }}
          />
          <span className="min-w-0 flex-1">{headings.fields}</span>
        </div>

        {columns.length === 0 ? (
          <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-10 text-center text-sm">
            Upload a file to see its columns here.
          </p>
        ) : (
          <div
            ref={boardRef}
            className={cn("flex items-start", flip && "flex-row-reverse")}
            onBlur={(e) => {
              // Tabbing out of the board with a cable in hand would leave it hanging with no visible
              // way back; Escape is not discoverable once focus has gone.
              if (held && !held.pointer && !e.currentTarget.contains(e.relatedTarget)) cancelHold()
            }}
          >
            {/* columns in the file */}
            <ul
              aria-label="Columns in the file"
              className="flex min-w-0 flex-1 flex-col"
              style={{ gap: ROW_GAP }}
            >
              {columns.map((column, i) => {
                const info = infoById.get(column.id)
                const intoField = columnToField.get(column.id)
                const isHeld = held?.columnId === column.id
                const samples = (column.samples ?? []).filter(Boolean).slice(0, 2)
                return (
                  <li key={column.id} style={{ height: rowHeight }}>
                    <button
                      type="button"
                      data-slot="column-jack"
                      data-patched={intoField ? "" : undefined}
                      ref={(el) => {
                        columnRefs.current[i] = el
                        columnRefs.current.length = columns.length
                      }}
                      tabIndex={i === Math.min(activeColumn, columns.length - 1) ? 0 : -1}
                      onFocus={() => setActiveColumn(i)}
                      onKeyDown={(e) => onColumnKeyDown(e, i, column.id)}
                      // pan-y, not none: a vertical swipe still scrolls the page on touch (this
                      // board can be taller than a phone), and patching by touch goes through
                      // tap-to-hold rather than through a drag.
                      style={{ touchAction: "pan-y" }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return
                        // Own the focus ourselves: the browser's own mousedown focus would undo it.
                        e.preventDefault()
                        columnRefs.current[i]?.focus()
                        pressAt.current = { x: e.clientX, y: e.clientY }
                        moved.current = false
                        pickUp(column.id, true, e)
                      }}
                      className={cn(
                        "group border-border relative flex h-full w-full items-center gap-2.5 rounded-lg border text-left",
                        flip ? "pr-3 pl-5" : "pr-5 pl-3",
                        "transition-[border-color,background-color] duration-150 ease-out",
                        "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
                        // No background tint on a patched row: at 4.5% over white it drags the 11px
                        // sample values from 4.74:1 to 4.33:1, under the 4.5 floor. The cable, the
                        // filled jack and the border carry the state instead.
                        "bg-background",
                        intoField ? "border-primary/40" : "hover:border-foreground/25",
                        isHeld && "border-primary bg-primary/10"
                      )}
                    >
                      <span aria-hidden="true" className="min-w-0 flex-1">
                        <span className="text-foreground block truncate text-[13px] font-medium">
                          {column.name}
                        </span>
                        {showSamples && samples.length > 0 ? (
                          <span className="text-muted-foreground block truncate font-mono text-[11px]">
                            {samples.join("  ·  ")}
                          </span>
                        ) : null}
                      </span>
                      {showKinds && info ? (
                        <span
                          aria-hidden="true"
                          // Bare label rather than a filled chip: on bg-muted/60 it measures exactly
                          // 4.50:1, and the row is calmer with the jacks as the only objects on it.
                          // The detected kind is the evidence for the whole idea, so a narrow
                          // board abbreviates it rather than dropping it.
                          className="text-muted-foreground flex-none font-mono text-[10px]"
                        >
                          <span className="hidden @[420px]/board:inline">
                            {KIND_LABEL[info.kind]}
                          </span>
                          <span className="@[420px]/board:hidden">{KIND_SHORT[info.kind]}</span>
                        </span>
                      ) : null}
                      {column.issues ? (
                        <span
                          aria-hidden="true"
                          className="text-destructive flex-none font-mono text-[10px] tabular-nums"
                        >
                          {column.issues} bad
                        </span>
                      ) : null}
                      {/* the jack: its centre sits exactly on the gutter's left edge */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "border-border bg-background absolute top-1/2 flex size-3.5 -translate-y-1/2 items-center justify-center rounded-full border-2",
                          flip ? "-left-[7px]" : "-right-[7px]",
                          (intoField || isHeld) && "border-primary"
                        )}
                      >
                        {intoField || isHeld ? (
                          <span className="bg-primary size-1.5 rounded-full" />
                        ) : null}
                      </span>
                      <span className="sr-only">
                        {`Column ${column.name}, ${i + 1} of ${columns.length}. `}
                        {info ? `Values look like ${KIND_LABEL[info.kind]}. ` : ""}
                        {intoField
                          ? `Patched into ${fields.find((f) => f.id === intoField)?.label}. Press Enter to move the cable, Delete to unpatch.`
                          : "Not patched. Press Enter to pick it up."}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            {/* the cables */}
            <svg
              aria-hidden="true"
              ref={gutterRef}
              height={boardHeight}
              viewBox={`0 0 ${CABLE_UNITS} ${boardHeight}`}
              // Stretched, not letterboxed: the x axis takes whatever width is left, the y axis stays
              // in pixels so the cable ends keep meeting the jacks exactly.
              preserveAspectRatio="none"
              style={{
                width: `clamp(52px, 20%, ${gutterWidth}px)`,
                height: boardHeight,
                // Mirrored on a flipped board, so the same paths run from the columns (now on the
                // right) to the fields (now on the left).
                transform: flip ? "scaleX(-1)" : undefined,
              }}
              className="flex-none overflow-visible"
            >
              {cables.map((c) => (
                <path
                  key={c.key}
                  data-slot="cable"
                  d={c.d}
                  // `pathLength` normalises the path to 1 so the draw animation is one dash sliding
                  // in, whatever the cable's real length. A guess never draws, and it must keep a
                  // dash pattern in real pixels — under pathLength=1 a "5 4" dash would be longer
                  // than the whole path and render solid.
                  pathLength={c.guess ? undefined : 1}
                  fill="none"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  strokeWidth={c.lit ? 2.4 : 1.75}
                  strokeDasharray={c.guess ? "5 4" : 1}
                  className={cn(
                    c.guess ? "stroke-muted-foreground" : "stroke-primary",
                    c.drawing && !c.guess && "ip-draw"
                  )}
                  // Only the reveal timers may hide a cable; a guess is dimmed by its token and
                  // its dash pattern, never by an opacity that would drop it under the 3:1 floor.
                  style={{ opacity: c.hidden ? 0 : 1 }}
                />
              ))}
              {held ? (
                <path
                  ref={looseRef}
                  d={looseD}
                  fill="none"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  strokeWidth={2.4}
                  // A keyboard preview is a proposal, not a patch: dash it so the two never look alike.
                  strokeDasharray={held.pointer ? undefined : "5 4"}
                  className="stroke-primary"
                />
              ) : null}
            </svg>

            {/* fields in your schema */}
            <ul
              aria-label="Fields in your schema"
              className="flex min-w-0 flex-1 flex-col"
              style={{ gap: ROW_GAP }}
            >
              {fields.map((field, i) => {
                const columnId = mapping[field.id]
                const column = columnId ? columns.find((c) => c.id === columnId) : undefined
                const isCandidate = held !== null && candidate === i
                const isGuess = guesses.has(field.id)
                const info = columnId ? infoById.get(columnId) : undefined
                const mismatch =
                  info &&
                  field.kind &&
                  field.kind !== "text" &&
                  kindScore(info.kind, field.kind) < 0.5
                const missing = field.required && !columnId
                return (
                  <li key={field.id} style={{ height: rowHeight }}>
                    <button
                      type="button"
                      data-slot="field-jack"
                      data-patched={columnId ? "" : undefined}
                      id={`${uid}-field-${field.id}`}
                      ref={(el) => {
                        fieldRefs.current[i] = el
                        fieldRefs.current.length = fields.length
                      }}
                      tabIndex={i === Math.min(activeField, fields.length - 1) ? 0 : -1}
                      onFocus={() => setActiveField(i)}
                      onKeyDown={(e) => onFieldKeyDown(e, i, field.id)}
                      onPointerEnter={() => held?.pointer && setCandidate(i)}
                      onClick={() => onFieldActivate(field.id)}
                      className={cn(
                        "border-border relative flex h-full w-full items-center gap-2.5 rounded-lg border text-left",
                        flip ? "pr-5 pl-3" : "pr-3 pl-5",
                        "transition-[border-color,background-color] duration-150 ease-out",
                        "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
                        "bg-background",
                        columnId ? "border-primary/40" : "hover:border-foreground/25",
                        missing && "border-destructive/40 border-dashed",
                        isCandidate && "border-primary ring-primary/40 ring-2"
                      )}
                    >
                      <span aria-hidden="true" className="min-w-0 flex-1">
                        <span className="text-foreground flex items-center gap-1 text-[13px] font-medium">
                          <span className="truncate">{field.label}</span>
                          {field.required ? (
                            <span className="text-muted-foreground flex-none text-[11px]">*</span>
                          ) : null}
                        </span>
                        <span className="text-muted-foreground block truncate text-[11px]">
                          {column ? (
                            <span className="font-mono">{column.name}</span>
                          ) : (
                            (field.hint ??
                            (showKinds && field.kind
                              ? `expects ${KIND_LABEL[field.kind]}`
                              : "empty"))
                          )}
                        </span>
                      </span>
                      {isGuess ? (
                        <span
                          aria-hidden="true"
                          className="text-muted-foreground border-border bg-background flex-none rounded-full border px-2 py-0.5 text-[10px] font-medium"
                        >
                          review
                        </span>
                      ) : mismatch ? (
                        <span
                          aria-hidden="true"
                          className="text-destructive flex-none font-mono text-[10px]"
                        >
                          {info ? KIND_LABEL[info.kind] : ""}?
                        </span>
                      ) : null}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "border-border bg-background absolute top-1/2 flex size-3.5 -translate-y-1/2 items-center justify-center rounded-full border-2",
                          flip ? "-right-[7px]" : "-left-[7px]",
                          (columnId || isCandidate) && "border-primary",
                          missing && "border-destructive/60"
                        )}
                      >
                        {columnId ? (
                          <span
                            className={cn(
                              "bg-primary size-1.5 rounded-full",
                              drawing.has(field.id) && "ip-seat"
                            )}
                          />
                        ) : null}
                      </span>
                      <span className="sr-only">
                        {`${field.label}${field.required ? ", required" : ""}, field ${i + 1} of ${fields.length}. `}
                        {column
                          ? `Patched from ${column.name}.${isGuess ? " Low confidence: press Enter to confirm." : " Press Delete to unpatch."}`
                          : held
                            ? "Empty. Press Enter to patch the held column here."
                            : "Empty."}
                        {/* The visible badge is aria-hidden, so the warning has to be said here too. */}
                        {mismatch && info && field.kind
                          ? ` Warning: those values look like ${KIND_LABEL[info.kind]}, but this field expects ${KIND_LABEL[field.kind]}.`
                          : ""}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {/* verdict + primary action */}
      <div className="border-border mt-3 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
        <p id={`${uid}-verdict`} className="text-muted-foreground min-w-0 text-xs">
          <span className="text-foreground font-medium tabular-nums">
            {summary.patched} of {summary.fields} patched
          </span>
          <span className="mx-1.5" aria-hidden="true">
            ·
          </span>
          <span className={cn(missingLabels.length > 0 && "text-destructive")}>{verdict}</span>
        </p>
        <button
          type="button"
          data-slot="confirm"
          aria-disabled={blocked || undefined}
          aria-describedby={`${uid}-verdict`}
          onClick={() => (blocked ? setMessage(verdict) : onConfirm?.(mapping))}
          className={cn(
            "inline-flex h-11 flex-none items-center rounded-full px-5 text-sm font-medium",
            "transition-[background-color,color,transform] duration-150 ease-out",
            "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
            blocked
              ? "bg-muted text-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
          )}
        >
          {confirmLabel}
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {message}
      </p>
    </div>
  )
}

export default ImportPatchbay
