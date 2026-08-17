'use client'

function stringifyContent(content: unknown): string {
  if (typeof content === 'string') return content
  try {
    return JSON.stringify(content, null, 2)
  } catch {
    return String(content)
  }
}

export function CompactMarkdown({ content }: { content: unknown }) {
  return (
    <pre className="max-h-56 max-w-full overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
      {stringifyContent(content)}
    </pre>
  )
}
