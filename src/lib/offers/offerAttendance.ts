import 'server-only'
import { AttendedTypeEnum, type Attendee } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'

/**
 * Leads from the share link and the Live link are also written to the offer's attendance list,
 * so the pipeline (and the live room, which identifies visitors by Attendee) sees them.
 *
 * Attendee is keyed by email. WhatsApp-only leads get a reserved, never-deliverable address
 * (`whatsapp-<digits>@lead.invalid`); the real number stays on the Contact.
 */
const WHATSAPP_ATTENDEE_RE = /^whatsapp-(\d{8,15})@lead\.invalid$/

export function attendeeEmailFor(contact: { email: string | null; phone: string | null }): string {
  return contact.email ?? `whatsapp-${(contact.phone ?? '').replace(/\D/g, '')}@lead.invalid`
}

/** The E.164 number behind a WhatsApp-only attendee address, or null for a real email. */
export function phoneFromAttendeeEmail(email: string): string | null {
  const match = email.match(WHATSAPP_ATTENDEE_RE)
  return match ? `+${match[1]}` : null
}

export async function registerContactOnOffer(
  webinarId: string,
  contact: { email: string | null; phone: string | null; name: string | null },
): Promise<Attendee> {
  const email = attendeeEmailFor(contact)
  const name = contact.name ?? contact.email?.split('@')[0] ?? 'Guest'
  const attendee = await prismaClient.attendee.upsert({
    where: { email },
    create: { email, name },
    update: {},
  })
  await prismaClient.attendance.upsert({
    where: { attendeeId_webinarId: { attendeeId: attendee.id, webinarId } },
    create: { attendeeId: attendee.id, webinarId, attendedType: AttendedTypeEnum.REGISTERED },
    update: {},
  })
  return attendee
}
