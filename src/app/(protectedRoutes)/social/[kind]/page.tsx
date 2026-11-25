import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { isKindSegment } from '@/lib/social/library'
import { SocialShell } from '../_components/SocialShell'
import { SocialGallery } from '../_components/SocialGallery'

/** /social/<all|skills|prompts|workflows|plugins|reports|saved>: the library gallery. */
export default async function SocialLibraryPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  if (!isKindSegment(kind)) notFound()

  return (
    <SocialShell
      title="Library"
      description="Open a card to see how it works, then copy the prompt into your agent."
    >
      <Suspense>
        <SocialGallery initialSegment={kind} />
      </Suspense>
    </SocialShell>
  )
}
