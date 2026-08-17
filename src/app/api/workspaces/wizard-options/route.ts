import { NextResponse } from 'next/server'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'

/** Options for the universal Add-to-workspace wizard. */
export async function GET() {
  const auth = await onAuthenticateUser()
  if (!auth.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  }

  const userId = auth.user.id

  const [workspaces, agents] = await Promise.all([
    prismaClient.workspace.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        publishProfileId: true,
        publishProfile: { select: { name: true } },
      },
    }),
    prismaClient.liveKitAgent.findMany({
      where: {
        OR: [
          { publishAgents: { none: {} } },
          { publishAgents: { some: { publishProfile: { userId } } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, roomName: true },
    }),
  ])

  return NextResponse.json({
    workspaces: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      publishId: w.publishProfileId,
      publishName: w.publishProfile?.name ?? null,
    })),
    agents,
  })
}
