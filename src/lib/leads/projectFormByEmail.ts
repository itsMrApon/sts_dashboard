import { prismaClient } from '@/lib/prismaClient'
import type { Prisma } from '@prisma/client'

export type ProjectFormSnapshot = {
  email: string
  name: string
  attendances: Array<{
    webinarId: string
    title: string
    kind: string
    attendedType: string
    joinedAt: string
  }>
}

/**
 * Lookup project/webinar registrant data by email for a presenter.
 * Forms today are name + email only (Attendee model).
 */
export async function projectFormByEmail(
  presenterUserId: string,
  email: string,
  webinarIds?: string[],
): Promise<ProjectFormSnapshot | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const attendee = await prismaClient.attendee.findUnique({
    where: { email: normalized },
    select: {
      id: true,
      email: true,
      name: true,
      Attendance: {
        where: {
          webinar: {
            presenterId: presenterUserId,
            ...(webinarIds && webinarIds.length > 0
              ? { id: { in: webinarIds } }
              : {}),
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          attendedType: true,
          joinedAt: true,
          webinar: {
            select: { id: true, title: true, kind: true },
          },
        },
      },
    },
  })

  if (!attendee) return null
  if (webinarIds && webinarIds.length > 0 && attendee.Attendance.length === 0) {
    return null
  }

  return {
    email: attendee.email,
    name: attendee.name,
    attendances: attendee.Attendance.map((a) => ({
      webinarId: a.webinar.id,
      title: a.webinar.title,
      kind: a.webinar.kind,
      attendedType: a.attendedType,
      joinedAt: a.joinedAt.toISOString(),
    })),
  }
}

export async function upsertLeadFromEmail(options: {
  userId: string
  email: string
  name?: string
  company?: string
  lastAppointmentAt?: Date | null
}) {
  const email = options.email.trim().toLowerCase()
  const form = await projectFormByEmail(options.userId, email)
  const name = options.name?.trim() || form?.name || email

  return prismaClient.callIntelLead.upsert({
    where: {
      userId_email: { userId: options.userId, email },
    },
    create: {
      userId: options.userId,
      email,
      name,
      company: options.company || null,
      lastAppointmentAt: options.lastAppointmentAt || null,
    },
    update: {
      name: options.name?.trim() || undefined,
      company: options.company || undefined,
      lastAppointmentAt: options.lastAppointmentAt || undefined,
    },
  })
}

export type JsonRecord = Prisma.InputJsonValue
