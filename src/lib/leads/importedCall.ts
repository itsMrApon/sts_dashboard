/**
 * Call notes added by hand on a lead: a Markdown export from Yogurt (or Granola, Otter…) or text
 * typed in. They are stored as a meeting like a Fathom call, with this prefix instead of a Fathom
 * recording id, so nothing tries to fetch them from Fathom.
 */
export const IMPORTED_CALL_PREFIX = 'import:'

export const CALL_NOTES_MIN = 20
export const CALL_NOTES_MAX = 100_000

export function isImportedCall(recordingId: string | null | undefined): boolean {
  return Boolean(recordingId?.startsWith(IMPORTED_CALL_PREFIX))
}

export type ParsedCallNotes = { title: string | null; date: Date | null; body: string }

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null
  const text = value.trim().replace(/^["'*\s]+|["'*\s]+$/g, '')
  // A date without a time means that day: noon local, so time zones don't move it a day.
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00` : text)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Reads an export's front matter (title, date) and first heading; the rest is the call. */
export function parseCallNotes(raw: string): ParsedCallNotes {
  let text = raw.replace(/\r\n?/g, '\n').trim()
  let title: string | null = null
  let date: Date | null = null

  const frontMatter = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (frontMatter) {
    for (const line of frontMatter[1].split('\n')) {
      const [key, ...rest] = line.split(':')
      const value = rest.join(':').trim()
      if (/^title$/i.test(key.trim()) && value) title = value.replace(/^["']|["']$/g, '')
      if (/^(date|created|start(ed)?(_at)?)$/i.test(key.trim()) && !date) date = parseDate(value)
    }
    text = text.slice(frontMatter[0].length).trim()
  }

  const heading = text.match(/^#\s+(.+)\n?/)
  if (heading) {
    title = title ?? heading[1].trim()
    text = text.slice(heading[0].length).trim()
  }

  if (!date) {
    const dateLine = text.match(/^\**(?:date|when)\**:\**\s*(.+)$/im)
    date = parseDate(dateLine?.[1])
  }

  return { title, date, body: text }
}
