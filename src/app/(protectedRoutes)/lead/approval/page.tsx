import { Suspense } from 'react'
import { loadPendingRequests, loadRecentDecisions, loadToolGrants } from '@/lib/agentBridge/bridge'
import { AGENT_AREAS, type AgentArea } from '@/lib/agentBridge/types'
import { LeadDashboardSkeleton } from '../_components/LeadDashboardSkeleton'
import { LeadSectionPage } from '../_components/LeadSectionPage'
import { ApprovalView } from './ApprovalView'

async function ApprovalLoader({ userId }: { userId: string }) {
  const [pending, decisions, grants] = await Promise.all([
    loadPendingRequests(userId),
    loadRecentDecisions(userId),
    loadToolGrants(userId),
  ])
  return (
    <ApprovalView
      pending={pending.map((r) => ({
        id: r.id,
        runId: r.runId,
        runTitle: r.runTitle,
        tool: r.tool,
        title: r.title,
        detail: r.detail ?? undefined,
        reason: r.reason ?? undefined,
        input: (r.input as { display?: unknown } | null)?.display ?? undefined,
        requestedAt: r.createdAt.getTime(),
        area: AGENT_AREAS[r.area as AgentArea]?.label ?? r.area,
        client: r.client,
      }))}
      decisions={decisions.map((d) => ({
        id: d.id,
        tool: d.tool,
        title: d.detail ? `${d.title} ${d.detail}` : d.title,
        status: d.status,
        error: d.error,
        note: d.note,
        autoApproved: d.autoApproved,
        decidedAt: d.decidedAt?.toISOString() ?? null,
      }))}
      grants={grants.map((g) => ({ id: g.id, tool: g.tool, createdAt: g.createdAt.toISOString() }))}
    />
  )
}

/**
 * /lead/approval: every change the creator's AI agent asked to make (knowledge, connections,
 * imports…), waiting for Allow or Deny. Nothing the agent asks for happens before this.
 */
export default function LeadApprovalPage() {
  return (
    <LeadSectionPage>
      {(user) => (
        <Suspense fallback={<LeadDashboardSkeleton />}>
          <ApprovalLoader userId={user.id} />
        </Suspense>
      )}
    </LeadSectionPage>
  )
}
