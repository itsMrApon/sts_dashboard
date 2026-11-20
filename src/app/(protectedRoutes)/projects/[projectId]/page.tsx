import { notFound, redirect } from 'next/navigation'

type Props = { params: Promise<{ projectId: string }> }

/** Product and webinar settings live in the project popup on /projects now; old links open it there. */
export default async function OfferSettingsPage({ params }: Props) {
  const { projectId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) notFound()
  redirect(`/projects?edit=${projectId}`)
}
