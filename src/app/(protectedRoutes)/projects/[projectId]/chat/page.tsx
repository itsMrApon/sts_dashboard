import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{
    projectId: string
  }>
}

export default async function ProjectChatPage({ params }: Props) {
  const { projectId } = await params
  redirect(`/live-project/${projectId}`)
}
