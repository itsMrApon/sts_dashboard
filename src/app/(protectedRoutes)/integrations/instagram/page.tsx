import { redirect } from 'next/navigation'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Instagram moved to Social. Old links (and bookmarks) land on the new page. */
export default async function OldInstagramPage({ searchParams }: Props) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') query.set(key, value)
  }
  redirect(`/social/instagram${query.size ? `?${query.toString()}` : ''}`)
}
