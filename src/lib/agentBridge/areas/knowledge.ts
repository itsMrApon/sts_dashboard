import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { AgentInputError, int, str, type AgentTool } from '../types'

const ANSWER_MAX = 2000
const DESCRIPTION_MAX = 2000

/**
 * Business knowledge the creator's agent can refine from their conversations: answers to what
 * customers ask (Questions; every sts-ai assistant uses answered ones) and the business description.
 */
export const KNOWLEDGE_TOOLS: AgentTool[] = [
  {
    kind: 'read',
    name: 'list_open_questions',
    area: 'knowledge',
    title: 'Unanswered customer questions',
    description:
      'Questions customers asked the business’s AI assistants that have no answer yet, most asked first. Use the creator’s conversation with you to suggest answers with propose_answer.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Default 20.' } },
      additionalProperties: false,
    },
    async run(ctx, input) {
      const rows = await prismaClient.questionGroup.findMany({
        where: { userId: ctx.userId, status: 'OPEN' },
        orderBy: [{ askedCount: 'desc' }, { lastAskedAt: 'desc' }],
        take: int(input, 'limit', { min: 1, max: 50, fallback: 20 }),
        select: { id: true, label: true, examples: true, askedCount: true },
      })
      if (rows.length === 0) return 'No open questions right now.'
      return { text: JSON.stringify(rows, null, 2), structured: { questions: rows } }
    },
  },
  {
    kind: 'read',
    name: 'list_answers',
    area: 'knowledge',
    title: 'Answers already given',
    description: 'Questions the creator already answered. Their assistants use these answers word for word.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Default 30.' } },
      additionalProperties: false,
    },
    async run(ctx, input) {
      const rows = await prismaClient.questionGroup.findMany({
        where: { userId: ctx.userId, status: 'ANSWERED' },
        orderBy: { answeredAt: 'desc' },
        take: int(input, 'limit', { min: 1, max: 100, fallback: 30 }),
        select: { id: true, label: true, answer: true },
      })
      if (rows.length === 0) return 'No answers yet.'
      return { text: JSON.stringify(rows, null, 2), structured: { answers: rows } }
    },
  },
  {
    kind: 'write',
    policy: 'direct',
    name: 'propose_answer',
    area: 'knowledge',
    title: 'Answer a customer question',
    description:
      'Suggest an answer the business’s assistants will use. Pass question_id to answer an open question (from list_open_questions), or question to add a new one. Write the answer in the creator’s words and language; Bangla stays in Bangla script. Saved at once (the creator sees it in Questions).',
    inputSchema: {
      type: 'object',
      properties: {
        question_id: { type: 'string', description: 'An open question’s id.' },
        question: { type: 'string', description: 'A new question, as a customer would ask it.' },
        answer: { type: 'string', description: 'The answer, up to 2000 characters.' },
      },
      required: ['answer'],
      additionalProperties: false,
    },
    async propose(ctx, input) {
      const answer = str(input, 'answer', { max: ANSWER_MAX, required: true })
      const questionId = str(input, 'question_id', { max: 64 })
      let label = str(input, 'question', { max: 200 })
      if (questionId) {
        const group = await prismaClient.questionGroup.findFirst({
          where: { id: questionId, userId: ctx.userId },
          select: { label: true },
        })
        if (!group) throw new AgentInputError('No question with that question_id. Call list_open_questions.')
        label = group.label
      } else if (!label) {
        throw new AgentInputError('Pass question_id or question.')
      }
      return {
        title: 'Answer',
        detail: label,
        display: { question: label, answer },
        payload: { questionId: questionId || null, question: label, answer },
      }
    },
    async apply(ctx, payload) {
      const answer = String(payload.answer)
      const now = new Date()
      if (payload.questionId) {
        const updated = await prismaClient.questionGroup.updateMany({
          where: { id: String(payload.questionId), userId: ctx.userId },
          data: { answer, status: 'ANSWERED', answeredAt: now },
        })
        if (updated.count === 0) throw new Error('That question is gone.')
        return { answered: payload.question }
      }
      const created = await prismaClient.questionGroup.create({
        data: {
          userId: ctx.userId,
          label: String(payload.question),
          examples: [String(payload.question)],
          status: 'ANSWERED',
          answer,
          answeredAt: now,
        },
        select: { id: true },
      })
      return { added: payload.question, questionId: created.id }
    },
  },
  {
    kind: 'write',
    policy: 'direct',
    name: 'propose_business_description',
    area: 'knowledge',
    title: 'Update the business description',
    description:
      'Suggest a better business description (what the business does, for whom, where, what makes it different) from what the creator told you. Every assistant and page uses it. Saved at once; confirm the wording with the creator first.',
    inputSchema: {
      type: 'object',
      properties: { description: { type: 'string', description: 'Up to 2000 characters.' } },
      required: ['description'],
      additionalProperties: false,
    },
    async propose(ctx, input) {
      const description = str(input, 'description', { max: DESCRIPTION_MAX, required: true })
      const current = await prismaClient.publishProfile.findUnique({ where: { userId: ctx.userId }, select: { description: true } })
      if (!current) throw new AgentInputError('This account has no business yet.')
      return {
        title: 'Update description',
        detail: description.slice(0, 90),
        display: { before: current.description ?? '', after: description },
        payload: { description },
      }
    },
    async apply(ctx, payload) {
      await prismaClient.publishProfile.update({ where: { userId: ctx.userId }, data: { description: String(payload.description) } })
      return { updated: 'business description' }
    },
  },
]
