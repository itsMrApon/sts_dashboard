/**
 * Framework-free controllers for each service. They hold the state (messages, call state,
 * form values) and tell you when it changes, so any UI can use them: React and Vue wrap them,
 * and plain JavaScript can call them straight from `window.addEventListener`.
 *
 *   const chat = createChat(sts)
 *   chat.subscribe((state) => render(state.messages))
 *   await chat.send('Hi!')
 */
import type { StsClient } from './core.js';
import { type StsChatLinks, type StsForm, type StsFormAnswer } from './types.js';
type Listener<T> = (state: T) => void;
export type StsChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    links?: StsChatLinks;
};
export type StsChatState = {
    messages: StsChatMessage[];
    status: 'idle' | 'thinking' | 'error';
    error: string | null;
};
/** Chat AI as a service: your floating button, pop-up or page draws it; this keeps the conversation. */
export declare function createChat(sts: StsClient): {
    readonly state: StsChatState;
    subscribe: (listener: Listener<StsChatState>) => () => void;
    send: (text: string) => Promise<void>;
    attach: (file: File, documentId?: string) => Promise<void>;
    reset: () => void;
};
export type StsChatController = ReturnType<typeof createChat>;
/** One line of live captions. `final` is false while the words are still coming in. */
export type StsCaption = {
    id: string;
    speaker: 'agent' | 'visitor';
    text: string;
    final: boolean;
};
export type StsVoiceState = {
    state: 'idle' | 'connecting' | 'live' | 'ended' | 'error';
    isAgentSpeaking: boolean;
    muted: boolean;
    captions: StsCaption[];
    /** The AI's voice loudness, 0 to 1, about ten times a second: drive an orb or bars with it. */
    agentLevel: number;
    error: string | null;
};
/**
 * Voice AI as a service: a real-time call with the business's AI over WebRTC (LiveKit is
 * included). Your orb, call button and captions are yours; call `start()` from a click.
 */
export declare function createVoice(sts: StsClient): {
    readonly state: StsVoiceState;
    subscribe: (listener: Listener<StsVoiceState>) => () => void;
    start: (participantName?: string) => Promise<void>;
    stop: () => Promise<void>;
    setMuted: (value: boolean) => Promise<void>;
};
export type StsVoiceController = ReturnType<typeof createVoice>;
export type StsFormState = {
    form: StsForm | null;
    values: Record<string, StsFormAnswer>;
    consent: boolean;
    status: 'loading' | 'ready' | 'submitting' | 'success' | 'error' | 'unavailable';
    message: string | null;
    /** The field the server refused, to highlight it. */
    fieldError: string | null;
};
/** The business's form as a service: your fields and layout, its questions and its inbox. */
export declare function createForm(sts: StsClient): {
    readonly state: StsFormState;
    subscribe: (listener: Listener<StsFormState>) => () => void;
    setValue: (fieldId: string, value: StsFormAnswer) => void;
    setConsent: (consent: boolean) => void;
    submit: () => Promise<void>;
};
export type StsFormController = ReturnType<typeof createForm>;
export {};
