import { type ReactNode } from 'react';
import { type StsClient } from './core.js';
import { type StsBusiness, type StsBusinessService, type StsChatLinks, type StsContactCard, type StsForm, type StsFormAnswer, type StsLiveSession, type StsOffer, type StsDoc, type StsSessionInfo, type StsWizard, type StsWizardStep } from './types.js';
/** Wrap your site once. Every hook below talks to your STS-AI business through this client. */
export declare function StsProvider({ apiBase, siteKey, children }: {
    apiBase: string;
    siteKey: string;
    children: ReactNode;
}): import("react").JSX.Element;
export declare function useSts(): StsClient;
/** Business name + which services are turned on. */
export declare function useStsInfo(): {
    info: StsSessionInfo | null;
    error: string | null;
};
export type StsChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    links?: StsChatLinks;
};
export declare function useStsChat(): {
    /** false when Chat AI is off in the dashboard. */
    available: boolean;
    greeting: string;
    suggestions: string[];
    maxMessageLength: number;
    messages: StsChatMessage[];
    send: (text: string) => Promise<void>;
    reset: () => void;
    status: "error" | "idle" | "thinking";
    error: string | null;
};
type SpeakState = 'idle' | 'connecting' | 'live' | 'ended' | 'error';
/** Voice call over WebRTC. Requires `livekit-client` installed on your site. */
export declare function useStsSpeak(): {
    state: SpeakState;
    start: (participantName?: string) => Promise<void>;
    stop: () => Promise<void>;
    isAgentSpeaking: boolean;
    error: string | null;
};
export declare function useStsForm(): {
    form: StsForm | null;
    values: Record<string, StsFormAnswer>;
    setValue: (fieldId: string, value: StsFormAnswer) => void;
    consent: boolean;
    setConsent: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    submit: () => Promise<void>;
    status: "error" | "loading" | "ready" | "submitting" | "success" | "unavailable";
    message: string | null;
    fieldError: string | null;
};
/**
 * Voice tour across your own page. Tag sections with `data-sts-step="…"`; style `[data-sts-active]`.
 * Each business has one wizard, so `slug` is optional.
 */
export declare function useStsWizard(slug?: string): {
    wizard: StsWizard | null;
    ready: boolean;
    start: () => void;
    stop: () => void;
    playing: boolean;
    speaking: boolean;
    step: StsWizardStep | null;
    stepIndex: number;
    caption: string;
    muted: boolean;
    setMuted: (value: boolean) => void;
    error: string | null;
};
export declare function useStsBusiness(): {
    business: StsBusiness | null;
    error: string | null;
};
export type { StsChatLinks, StsForm, StsSessionInfo, StsWizard, StsWizardStep, StsBusiness, StsBusinessService, StsDoc, StsOffer, StsContactCard, StsLiveSession, };
