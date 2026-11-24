'use server'

import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { runQuestionsForCreator } from '@/lib/questions/collectQuestions'

type Result = { ok: true; message?: string } | { ok: false; error: string }

const ANSWER_MAX = 2000

async function currentUserId(): Promise<string | null> {
  const auth = await onAuthenticateUser()
  return auth.user?.id ?? null
}

function revalidateQuestions(webinarId: string | null) {
  revalidatePath(webinarId ? `/projects/${webinarId}/questions` : '/projects/questions')
}

/** Saves the creator's answer. From now on every agent can use it. Bangla is kept as typed. */
export async function answerQuestionGroup(input: { id: string; answer: string }): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  const answer = input.answer.trim().slice(0, ANSWER_MAX)
  if (!answer) return { ok: false, error: 'Write an answer first.' }
  const group = await prismaClient.questionGroup.findFirst({ where: { id: input.id, userId }, select: { webinarId: true } })
  if (!group) return { ok: false, error: 'That question is gone. Refresh the page.' }
  await prismaClient.questionGroup.update({
    where: { id: input.id },
    data: { answer, status: 'ANSWERED', answeredAt: new Date() },
  })
  revalidateQuestions(group.webinarId)
  return { ok: true }
}

/** Hides a question group (IGNORED) or brings it back (OPEN, or ANSWERED when it has an answer). */
export async function setQuestionGroupHidden(input: { id: string; hidden: boolean }): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  const group = await prismaClient.questionGroup.findFirst({
    where: { id: input.id, userId },
    select: { webinarId: true, answer: true },
  })
  if (!group) return { ok: false, error: 'That question is gone. Refresh the page.' }
  await prismaClient.questionGroup.update({
    where: { id: input.id },
    data: { status: input.hidden ? 'IGNORED' : group.answer ? 'ANSWERED' : 'OPEN' },
  })
  revalidateQuestions(group.webinarId)
  return { ok: true }
}

/** Regroups this creator's questions now instead of waiting for Monday. */
export async function refreshQuestionsNow(): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  try {
    const summary = await runQuestionsForCreator(userId)
    revalidatePath('/projects', 'layout')
    if (summary.status === 'skipped') {
      return summary.reason === 'no-gemini-key'
        ? { ok: false, error: 'Add your Gemini API key in AI Agents → Config first.' }
        : { ok: true, message: 'No questions from customers yet.' }
    }
    if (summary.errors.length > 0) return { ok: false, error: `Some groups failed: ${summary.errors[0]}` }
    return { ok: true, message: `Grouped ${summary.questions} questions into ${summary.groups} groups.` }
  } catch (error) {
    console.error('[questions] refresh failed', error)
    return { ok: false, error: 'Could not group questions right now. Try again in a minute.' }
  }
}
