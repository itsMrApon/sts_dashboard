import { NextResponse } from 'next/server'
import { onAuthenticateUser } from '@/actions/auth'
import { getWorkspaces } from '@/actions/workspaces'

export async function GET() {
  const auth = await onAuthenticateUser()
  if (!auth.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  }

  const workspaces = await getWorkspaces(auth.user.id)
  return NextResponse.json(
    workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      workspaceId: workspace.id,
      tenantId: workspace.id,
      publishId: workspace.publishProfileId?? null,
      publishName: workspace.publishProfile?.name ?? null,
    })),
  )
}
