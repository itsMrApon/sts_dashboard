import { Assistant } from '@vapi-ai/server-sdk/api';
import { create } from 'zustand';
import type { LiveKitUiAgentConfig } from '@/lib/livekit/livekitTypes';

type SourceType = 'vapi' | 'livekit';

type AiAgentStore = {
  assistant: Assistant | null;
  livekitAgent: LiveKitUiAgentConfig | null;
  source: SourceType;
  setAssistant: (assistant: Assistant) => void;
  setLivekitAgent: (agent: LiveKitUiAgentConfig) => void;
  setSource: (source: SourceType) => void;
  clearAiAssistant: () => void;
};

export const useAiAgentStore = create<AiAgentStore>((set) => ({
  assistant: null,
  livekitAgent: null,
  source: 'vapi',
  setAssistant: (assistant) => set({ assistant }),
  setLivekitAgent: (agent) => set({ livekitAgent: agent }),
  setSource: (source) => set({ source }),
  clearAiAssistant: () => set({ assistant: null, livekitAgent: null, source: 'vapi' }),
}));
