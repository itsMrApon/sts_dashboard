import { NextResponse } from 'next/server'
import { onAuthenticateUser } from '@/actions/auth'
import { getTenants } from '@/actions/tenants'

export async function GET() {
  const auth = await onAuthenticateUser()
  if (!auth.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  }

  const tenants = await getTenants(auth.user.id)
  return NextResponse.json(
    tenants.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      workspaceId: workspace.id,
      tenantId: workspace.id,
      publishId: workspace.publishProfileId?? null,
      publishName: workspace.publishProfile?.name ?? null,
    })),
  )
}
