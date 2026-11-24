import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { siteContentFromLegacy, type SiteDoc } from '@/lib/business/siteContent'
import { prismaClient } from '@/lib/prismaClient'
import { loadPublicBusiness, serviceAccess } from '@/lib/public/publicService'
import { PrintButton } from './_components/PrintButton'

type Props = { params: Promise<{ roomName: string }>; searchParams: Promise<{ service?: string }> }

/** The business's Docs, as the site shows them. Only content: no AI, no offers. */
const loadDocuments = cache(async (roomName: string) => {
  const loaded = await loadPublicBusiness(roomName)
  if (!loaded || serviceAccess(loaded, 'business') === 'off') return null
  const workspace = await prismaClient.workspace.findUnique({
    where: { id: loaded.business.workspaceId },
    select: { contextVertical: true, contextCoreJson: true, contextIndustryJson: true, contextSocialJson: true },
  })
  const content = siteContentFromLegacy({
    businessName: loaded.business.name,
    vertical: workspace?.contextVertical ?? null,
    core: workspace?.contextCoreJson,
    industry: workspace?.contextIndustryJson,
    social: workspace?.contextSocialJson,
  })
  return { loaded, content }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomName } = await params
  const site = await loadDocuments(decodeURIComponent(roomName))
  if (!site) return { title: 'Documents', robots: { index: false } }
  return {
    title: `Documents checklist · ${site.loaded.business.name}`,
    robots: site.loaded.sitePublished ? undefined : { index: false },
  }
}

function DocRow({ doc }: { doc: SiteDoc }) {
  return (
    <li className="flex gap-3 border-b border-zinc-200 py-2.5 last:border-0 print:break-inside-avoid">
      <span aria-hidden className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-2 border-zinc-500" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {doc.name || doc.formCode}
          {doc.formCode && doc.name ? <span className="ml-2 font-mono text-sm text-zinc-500">{doc.formCode}</span> : null}
        </p>
        {doc.issuer ? <p className="text-sm text-zinc-600">From: {doc.issuer}</p> : null}
        {doc.pdfUrl ? (
          <p className="break-all text-xs text-zinc-500">
            <a href={doc.pdfUrl} className="underline print:no-underline">
              {doc.pdfUrl}
            </a>
          </p>
        ) : null}
      </div>
    </li>
  )
}

/**
 * Docs as a printable checklist: the documents a customer needs for each service, with the
 * business's contact details. The browser prints it or saves it as a PDF, and shapes Bangla
 * text correctly, which the React PDF libraries do not. `?service=<id>` prints one service.
 */
export default async function BusinessDocumentsPage({ params, searchParams }: Props) {
  const [{ roomName }, query] = await Promise.all([params, searchParams])
  const site = await loadDocuments(decodeURIComponent(roomName))
  if (!site) notFound()
  const { loaded, content } = site
  const docs = content.docs.filter((doc) => doc.name.trim() || doc.formCode.trim())
  const services = content.services
    .filter((service) => service.active && (!query.service || service.id === query.service))
    .map((service) => ({ service, docs: docs.filter((doc) => doc.serviceIds.includes(service.id)) }))
    .filter((group) => group.docs.length > 0)
  const activeIds = new Set(content.services.filter((service) => service.active).map((service) => service.id))
  const general = query.service ? [] : docs.filter((doc) => !doc.serviceIds.some((id) => activeIds.has(id)))
  const footer = content.footer
  const backHref = `/business/${encodeURIComponent(loaded.business.roomName)}`
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-zinc-100 py-6 text-zinc-900 print:bg-white print:py-0">
      <style>{'@page { size: A4; margin: 16mm; } @media print { body { background: #fff !important; } }'}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-4 print:hidden">
        <Link href={backHref} className="text-sm text-zinc-600 hover:text-zinc-900">
          ← Back to {loaded.business.name}
        </Link>
        <PrintButton />
      </div>

      <article className="mx-auto max-w-[210mm] bg-white px-8 py-10 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <header className="mb-6 border-b-2 border-zinc-900 pb-4">
          <p className="text-sm uppercase tracking-wide text-zinc-500">Documents checklist</p>
          <h1 className="text-2xl font-semibold">{loaded.business.name}</h1>
          {content.footer.tagline ? <p className="text-sm text-zinc-600">{content.footer.tagline}</p> : null}
          <p className="mt-2 text-xs text-zinc-500">Printed {today}. Tick each one as you get it ready.</p>
        </header>

        {services.length === 0 && general.length === 0 ? (
          <p className="text-zinc-600">This business hasn&apos;t listed any documents yet.</p>
        ) : null}

        {services.map(({ service, docs: serviceDocs }) => (
          <section key={service.id} className="mb-6 print:break-inside-avoid-page">
            <h2 className="text-lg font-semibold">{service.name}</h2>
            {service.summary ? <p className="mb-1 text-sm text-zinc-600">{service.summary}</p> : null}
            <ul>
              {serviceDocs.map((doc) => (
                <DocRow key={doc.id} doc={doc} />
              ))}
            </ul>
          </section>
        ))}

        {general.length > 0 ? (
          <section className="mb-6">
            <h2 className="text-lg font-semibold">{services.length > 0 ? 'Other documents' : 'Documents'}</h2>
            <ul>
              {general.map((doc) => (
                <DocRow key={doc.id} doc={doc} />
              ))}
            </ul>
          </section>
        ) : null}

        {footer.phone || footer.email || footer.address || footer.hours ? (
          <footer className="mt-8 border-t border-zinc-300 pt-4 text-sm text-zinc-700 print:break-inside-avoid">
            <p className="mb-1 font-medium">Questions? Contact {loaded.business.name}</p>
            {footer.phone ? <p>Phone: {footer.phone}</p> : null}
            {footer.email ? <p>Email: {footer.email}</p> : null}
            {footer.address ? <p>Address: {footer.address}</p> : null}
            {footer.hours ? <p>Hours: {footer.hours}</p> : null}
          </footer>
        ) : null}
      </article>
    </div>
  )
}
