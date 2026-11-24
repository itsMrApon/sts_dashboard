import { NextResponse } from 'next/server'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { checkRateLimit } from '@/lib/embed/rateLimit'
import { buildLeadsXlsx } from '@/lib/leads/exportLeadsXlsx'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Every lead the signed-in creator has, newest activity first, as an .xlsx download. */
export async function GET() {
  const auth = await onAuthenticateUser()
  if (!auth.user) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })

  const limit = await checkRateLimit(`lead-export:${auth.user.id}`, 10, 60_000)
  if (!limit.ok) return NextResponse.json({ error: 'Too many exports. Wait a minute.' }, { status: 429 })

  const leads = await prismaClient.callIntelLead.findMany({
    where: { userId: auth.user.id },
    orderBy: [{ updatedAt: 'desc' }],
    select: { name: true, position: true, company: true, address: true, phone: true, notes: true },
  })

  const file = buildLeadsXlsx(leads)
  const day = new Date().toISOString().slice(0, 10)
  return new NextResponse(Buffer.from(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="leads-${day}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
