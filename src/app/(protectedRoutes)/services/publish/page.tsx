import { redirect } from 'next/navigation'

/** The old Business page: each part is now its own service page. Old links land on the right one. */
const MOVED: Record<string, string> = {
  services: '/services/menu',
  keyDates: '/services/menu',
  docs: '/services/docs',
  social: '/services/links',
  footer: '/services/contact',
}

export default async function OldBusinessPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section } = await searchParams
  redirect((section && MOVED[section]) || '/services')
}
