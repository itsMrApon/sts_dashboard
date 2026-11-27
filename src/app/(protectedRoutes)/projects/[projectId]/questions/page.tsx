import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { loadQuestionGroups } from '@/lib/questions/questionGroups'
import { QuestionGroupsView } from '../../_components/QuestionGroupsView'

type Props = { params: Promise<{ projectId: string }> }

/** One project's questions: what buyers asked its AI, grouped, with the creator's answers. */
export default async function ProjectQuestionsPage({ params }: Props) {
  const [{ projectId }, auth] = await Promise.all([params, onAuthenticateUser()])
  if (!auth.user) redirect('/sign-in')
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) notFound()

  const project = await prismaClient.webinar.findFirst({
    where: { id: projectId, presenterId: auth.user.id, deletedAt: null },
    select: { id: true, title: true },
  })
  if (!project) notFound()
  const groups = await loadQuestionGroups(auth.user.id, project.id)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-2">
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <Link href="/projects" className="inline-flex items-center gap-1.5 hover:text-foreground">
          <ArrowLeft className="size-4" />
          Projects
        </Link>
        <Link href="/projects?inbox=1" className="hover:text-foreground">
          Conversations
        </Link>
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Questions · {project.title}</h1>
        <p className="text-sm text-muted-foreground">What buyers asked this project&apos;s AI, grouped by meaning.</p>
      </div>
      <QuestionGroupsView groups={groups} general={false} />
    </div>
  )
}
