import { redirect } from 'next/navigation'
import { prismaClient } from '@/lib/prismaClient'

type Props = {
  params: Promise<{
    projectId: string
  }>
}

/** Old "chat" entry for a project: the live chat now lives in the host room (/live/[slug]/room). */
export default async function ProjectChatPage({ params }: Props) {
  const { projectId } = await params
  const project = await prismaClient.webinar.findUnique({ where: { id: projectId }, select: { slug: true } })
  redirect(project?.slug ? `/live/${project.slug}/room` : `/projects/${projectId}`)
}
