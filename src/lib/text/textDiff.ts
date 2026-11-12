export type DiffSegment = { kind: 'same' | 'added' | 'removed'; text: string }

const MAX_LCS_CELLS = 4_000_000

/** Lossless tokenizers: joining the tokens gives back the exact input (Bangla-safe, no normalization). */
export function tokenizeLines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/gu) ?? []
}

export function tokenizeWords(text: string): string[] {
  return text.split(/(\s+)/u).filter((token) => token.length > 0)
}

function mergeAdjacent(segments: DiffSegment[]): DiffSegment[] {
  const merged: DiffSegment[] = []
  for (const segment of segments) {
    const last = merged[merged.length - 1]
    if (last && last.kind === segment.kind) last.text += segment.text
    else merged.push({ ...segment })
  }
  return merged
}

/** Token-level LCS diff. Falls back to "replace all" for very large inputs to stay responsive. */
export function diffTokens(before: string[], after: string[]): DiffSegment[] {
  const rows = before.length
  const cols = after.length
  if (rows * cols > MAX_LCS_CELLS) {
    return mergeAdjacent([
      { kind: 'removed', text: before.join('') },
      { kind: 'added', text: after.join('') },
    ]).filter((segment) => segment.text)
  }

  const table: Uint32Array[] = Array.from({ length: rows + 1 }, () => new Uint32Array(cols + 1))
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i][j] =
        before[i] === after[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }

  const segments: DiffSegment[] = []
  let i = 0
  let j = 0
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      segments.push({ kind: 'same', text: before[i] })
      i += 1
      j += 1
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      segments.push({ kind: 'removed', text: before[i] })
      i += 1
    } else {
      segments.push({ kind: 'added', text: after[j] })
      j += 1
    }
  }
  while (i < rows) segments.push({ kind: 'removed', text: before[i++] })
  while (j < cols) segments.push({ kind: 'added', text: after[j++] })
  return mergeAdjacent(segments)
}

/**
 * Share of the original text that survived (0..1). Below ~0.4 an inline diff is noise
 * (e.g. a full translation), so callers should show before/after blocks instead.
 */
export function keptRatio(segments: DiffSegment[], beforeText: string): number {
  if (!beforeText.trim()) return 0
  const kept = segments.reduce((total, segment) => total + (segment.kind === 'same' ? segment.text.trim().length : 0), 0)
  return kept / beforeText.trim().length
}
