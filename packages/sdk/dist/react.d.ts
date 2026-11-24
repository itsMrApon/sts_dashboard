import { type ReactNode } from 'react';
import { type StsClient } from './core.js';
import { type StsAnswer, type StsReview, type StsBusiness, type StsBusinessService, type StsChatLinks, type StsContactCard, type StsForm, type StsFormAnswer, type StsLiveSession, type StsOffer, type StsDoc, type StsSessionInfo, type StsWizard, type StsWizardStep } from './types.js';
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
    /** Documents the assistant may ask for; show your attach button when this is not empty. */
    documentRequests: import("./types.js").StsDocumentRequest[];
    messages: StsChatMessage[];
    send: (text: string) => Promise<void>;
    attach: (file: File, documentId?: string) => Promise<void>;
    reset: () => void;
    status: "error" | "idle" | "thinking";
    error: string | null;
};
type SpeakState = 'idle' | 'connecting' | 'live' | 'ended' | 'error';
/** One line of live captions. `final` is false while the words are still coming in. */
export type StsCaption = {
    id: string;
    speaker: 'agent' | 'visitor';
    text: string;
    final: boolean;
};
/**
 * Voice call over WebRTC. Requires `livekit-client` installed on your site. Headless like the
 * chat: your designer builds the call button, mute button, captions and any animation.
 */
export declare function useStsSpeak(): {
    state: SpeakState;
    start: (participantName?: string) => Promise<void>;
    stop: () => Promise<void>;
    isAgentSpeaking: boolean;
    muted: boolean;
    setMuted: (value: boolean) => Promise<void>;
    captions: StsCaption[];
    agentLevel: number;
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
    follow: () => void;
    savedSound: () => "on" | "off" | null;
    rememberSound: (choice: "on" | "off") => void;
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
/**
 * The business's own answers to the questions customers ask most, for an FAQ block your
 * designer styles. Pair each with `useStsChat().send(question)` for an "Ask more" button.
 */
export declare function useStsAnswers(): {
    answers: StsAnswer[];
    ready: boolean;
    error: string | null;
};
/** Reviews the business chose to show, for a reviews block your designer styles. */
export declare function useStsReviews(): {
    reviews: StsReview[];
    ready: boolean;
    error: string | null;
};
export type { StsChatLinks, StsForm, StsSessionInfo, StsWizard, StsWizardStep, StsBusiness, StsBusinessService, StsDoc, StsOffer, StsContactCard, StsLiveSession, };
