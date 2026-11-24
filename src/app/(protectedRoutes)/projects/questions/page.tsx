import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { loadQuestionGroups } from '@/lib/questions/questionGroups'
import { QuestionGroupsView } from '../_components/QuestionGroupsView'

/** General questions: from website chats that were not about any one project. */
export default async function GeneralQuestionsPage() {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')
  const groups = await loadQuestionGroups(auth.user.id, null)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-2">
      <Link href="/projects" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Projects
      </Link>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">General questions</h1>
        <p className="text-sm text-muted-foreground">
          What customers asked in your website chat when they were not looking at a project.
        </p>
      </div>
      <QuestionGroupsView groups={groups} general />
    </div>
  )
}
