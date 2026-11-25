import { ExternalLink } from 'lucide-react'
import type { SetupLink } from '@/lib/email/smtpProviders'

/**
 * "Where to get it": the outside websites a creator opens to set up an integration, in the
 * order they need them. Links open in a new tab so the half-filled form stays put.
 */
export function SetupLinks({
  title = 'Where to get it',
  links,
  note,
}: {
  title?: string
  links: (SetupLink & { detail?: string })[]
  note?: string
}) {
  if (links.length === 0) return null
  return (
    <section className="rounded-xl border bg-card p-4 text-sm">
      <h2 className="mb-2 font-medium">{title}</h2>
      <ol className="space-y-1.5">
        {links.map((link, index) => (
          <li key={`${index}-${link.href}`} className="flex gap-2">
            <span className="w-4 shrink-0 text-right text-xs leading-5 text-muted-foreground">{index + 1}.</span>
            <span className="min-w-0">
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
              >
                {link.label}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
              {link.detail ? <span className="text-muted-foreground"> · {link.detail}</span> : null}
            </span>
          </li>
        ))}
      </ol>
      {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
    </section>
  )
}
