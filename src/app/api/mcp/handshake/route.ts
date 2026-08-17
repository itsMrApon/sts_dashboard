import { NextRequest, NextResponse } from 'next/server'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { signMcpToken } from '@/lib/mcpAuth'

const DEFAULT_SCOPES = [
  'tenant.core.compact.read',
  'tenant.industry.compact.read',
  'tenant.social.compact.read',
  'tenant.services.list.read',
  'tenant.pricing.read',
  'tenant.links.read',
  'tenant.room.merged.read',
] as const

export async function POST(request: NextRequest) {
  const auth = await onAuthenticateUser()
  if (!auth.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  }

  const body = (await request.json()) as {
    tenantId?: string
    domain?: string
    scopes?: string[]
  }

  if (!body.tenantId || !body.domain) {
    return NextResponse.json({ error: 'tenantId and domain are required' }, { status: 400 })
  }

  const tenant = await prismaClient.workspace.findFirst({
    where: {
      id: body.tenantId,
      userId: auth.user.id,
    },
    select: { id: true, publishProfileId: true },
  })

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const scopes = (body.scopes?.length ? body.scopes : [...DEFAULT_SCOPES]).filter((scope) =>
    DEFAULT_SCOPES.includes(scope as (typeof DEFAULT_SCOPES)[number]),
  )

  const exp = Date.now() + 1000 * 60 * 60
  const token = signMcpToken({
    tenantId: tenant.id,
    publishProfileId: tenant.publishProfileId || null,
    domain: body.domain,
    scopes: scopes as (typeof DEFAULT_SCOPES)[number][],
    exp,
  })

  return NextResponse.json({
    token,
    expiresAt: exp,
    tenantId: tenant.id,
    scopes,
  })
}

