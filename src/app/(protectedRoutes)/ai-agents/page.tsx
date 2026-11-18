import { cookies } from 'next/headers'
import { getAssistantServiceSettings, listAssistants } from '@/actions/assistants'
import { getAgentEngineSettings } from '@/actions/agentEngine'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { LOOK_KEYS, isAssistantService, type AssistantService } from '@/lib/agents/assistantServices'
import { describeEngine, engineSpeaksBangla } from '@/lib/agents/engineOptions'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { isSmtpConfigured } from '@/lib/services/formSubmit'
import { sanitizeChatConfig, sanitizeFormConfig, sanitizeSpeakConfig } from '@/lib/services/types'
import { getOrCreateBusinessWizard } from '@/lib/wizard/wizardRepo'
import { loadServicesContext } from '../services/_lib/servicesContext'
import { RAIL_COOKIE } from './_components/railCookie'
import { AssistantWorkspace, type AssistantBehaviour } from './_components/AssistantWorkspace'

type Props = { searchParams: Promise<{ assistant?: string; new?: string; list?: string }> }

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** Drops a service's look keys: behaviour drafts never carry colours or the orb. */
function behaviourOnly(service: 'chat' | 'voice' | 'form', config: Record<string, unknown>) {
  const look: readonly string[] = LOOK_KEYS[service]
  return Object.fromEntries(Object.entries(config).filter(([key]) => !look.includes(key)))
}

/**
 * AI Agents: your assistants, one per service (Chat, Voice, Form, Tour). Each holds its prompt and
 * its service's behaviour; /services keeps only the looks, switch and website code.
 */
export default async function AiAgentsPage({ searchParams }: Props) {
  const [{ business, user }, params, cookieStore] = await Promise.all([loadServicesContext(), searchParams, cookies()])
  // The assistants rail starts collapsed (more room for the editor) until someone opens it.
  const railCollapsed = cookieStore.get(RAIL_COOKIE)?.value !== 'open'
  const [assistants, engineResult, services] = await Promise.all([
    listAssistants(),
    getAgentEngineSettings(),
    getBusinessServices(business.workspaceId),
  ])
  const engineView = engineResult.ok
    ? { engine: engineResult.engine, source: engineResult.source, voiceLabel: engineResult.voiceLabel }
    : null
  const engineSummary = engineView ? describeEngine(engineView.engine, engineView.voiceLabel) : null

  const newService: AssistantService | 'pick' | null = isAssistantService(params.new)
    ? params.new
    : params.new !== undefined || assistants.length === 0
      ? 'pick'
      : null
  // ?list (phones: Back) shows the list instead of opening the first assistant.
  const selected = newService || params.list !== undefined ? null : (assistants.find((assistant) => assistant.id === params.assistant) ?? assistants[0] ?? null)

  // The selected assistant's behaviour for each service it can run. It starts from what the live
  // service uses (so a new assistant isn't blank) and its own saved settings win.
  let behaviour: AssistantBehaviour | null = null
  if (selected) {
    const stored = await getAssistantServiceSettings(selected.id)
    const own = stored.ok ? stored.settings : {}
    behaviour = {
      chat: sanitizeChatConfig({ ...services.chat.config, ...behaviourOnly('chat', record(own.chat)) }),
      voice: sanitizeSpeakConfig({ ...services.speak.config, ...behaviourOnly('voice', record(own.voice)) }),
      form: sanitizeFormConfig({ ...services.form.config, ...behaviourOnly('form', record(own.form)) }),
    }
  }
  // Tour content belongs to the business tour; only a Tour-capable assistant edits it.
  const tour = selected && (selected.service === 'tour' || selected.service === null) ? await getOrCreateBusinessWizard(business) : null

  return (
    // Pull the workspace up into the layout's top padding and keep a small bottom gap: the list
    // and editor scroll inside it, so the extra page padding was just empty bands.
    <PageViewport bottomPad={16} className="flex min-h-0 w-full flex-col overflow-hidden md:-mt-6">
      <AssistantWorkspace
        key={selected?.id ?? `new-${newService}`}
        roomName={business.roomName}
        businessName={business.name}
        assistants={assistants}
        selected={selected}
        behaviour={behaviour}
        tour={tour}
        tourAssistantId={services.tour.agent?.id ?? null}
        newService={newService}
        engine={
          engineSummary
            ? { llm: engineSummary.llm, llmProvider: engineSummary.llmProvider, voice: engineSummary.voice, voiceProvider: engineSummary.voiceProvider, stt: engineSummary.stt }
            : null
        }
        railCollapsed={railCollapsed}
        voiceLabel={engineSummary ? `${engineSummary.voice} · ${engineSummary.voiceProvider}` : 'Default voice'}
        voiceSpeaksBangla={engineView ? engineSpeaksBangla(engineView.engine) : false}
        ownerEmail={user.email ?? ''}
        emailReady={isSmtpConfigured()}
      />
    </PageViewport>
  )
}
