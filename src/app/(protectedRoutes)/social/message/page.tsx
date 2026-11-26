import { redirect } from 'next/navigation'

/** Messages moved to the top-right button: this address opens its panel (and a conversation, with ?t=). */
export default async function SocialMessagePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams
  redirect(`/social?inbox=${encodeURIComponent(t || '1')}`)
}
