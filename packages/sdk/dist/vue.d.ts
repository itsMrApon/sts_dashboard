/**
 * Vue 3 / Nuxt 3 bindings. Install the plugin once, then use the composables in any component;
 * every value is a ref your own design binds to.
 *
 *   // Nuxt: plugins/sts-ai.client.ts (the sts-ai CLI writes this for you)
 *   export default defineNuxtPlugin((nuxtApp) => {
 *     nuxtApp.vueApp.use(createStsPlugin({ apiBase: 'https://sudotechserve.com', siteKey: 'sts_pk_live_…' }))
 *   })
 *
 *   // any component
 *   const { messages, send, status } = useStsChat()
 */
import { type App } from 'vue';
import { type StsClient } from './core.js';
import type { StsAnswer, StsBusiness, StsOptions, StsReview, StsSessionInfo, StsWizard, StsWizardStep } from './types.js';
/** `app.use(createStsPlugin({ apiBase, siteKey }))`: one client for the whole site. */
export declare function createStsPlugin(options: StsOptions): {
    install(app: App): void;
};
export declare function useSts(): StsClient;
/** Business name + which services are turned on in sts-ai. */
export declare function useStsInfo(): {
    info: import("vue").ShallowRef<StsSessionInfo | null, StsSessionInfo | null>;
    error: import("vue").ShallowRef<string | null, string | null>;
};
/** Chat AI as a service, for your own floating button, pop-up or page. */
export declare function useStsChat(): {
    /** false when Chat AI is off in sts-ai. */
    available: import("vue").ComputedRef<boolean>;
    greeting: import("vue").ComputedRef<string>;
    suggestions: import("vue").ComputedRef<string[]>;
    documentRequests: import("vue").ComputedRef<import("./types.js").StsDocumentRequest[]>;
    messages: import("vue").ComputedRef<import("./controllers.js").StsChatMessage[]>;
    status: import("vue").ComputedRef<"idle" | "thinking" | "error">;
    error: import("vue").ComputedRef<string | null>;
    send: (text: string) => Promise<void>;
    attach: (file: File, documentId?: string) => Promise<void>;
    reset: () => void;
};
/** Voice AI as a service: call `start()` from your orb or button; `agentLevel` animates it. */
export declare function useStsSpeak(): {
    state: import("vue").ComputedRef<"live" | "idle" | "error" | "connecting" | "ended">;
    isAgentSpeaking: import("vue").ComputedRef<boolean>;
    muted: import("vue").ComputedRef<boolean>;
    captions: import("vue").ComputedRef<import("./controllers.js").StsCaption[]>;
    agentLevel: import("vue").ComputedRef<number>;
    error: import("vue").ComputedRef<string | null>;
    start: (participantName?: string) => Promise<void>;
    stop: () => Promise<void>;
    setMuted: (value: boolean) => Promise<void>;
};
/** The business's form as a service: your fields and layout, its questions and inbox. */
export declare function useStsForm(): {
    form: import("vue").ComputedRef<import("./types.js").StsForm | null>;
    values: import("vue").ComputedRef<Record<string, import("./types.js").StsFormAnswer>>;
    consent: import("vue").ComputedRef<boolean>;
    status: import("vue").ComputedRef<"error" | "loading" | "ready" | "submitting" | "success" | "unavailable">;
    message: import("vue").ComputedRef<string | null>;
    fieldError: import("vue").ComputedRef<string | null>;
    setValue: (fieldId: string, value: import("./types.js").StsFormAnswer) => void;
    setConsent: (consent: boolean) => void;
    submit: () => Promise<void>;
};
/**
 * The voice tour on your own page. Tag sections with `data-sts-step="…"` and style
 * `[data-sts-active]`. `follow()` speaks each section as the visitor scrolls to it; `play('pricing')`
 * speaks one step from your own event.
 */
export declare function useStsWizard(slug?: string): {
    wizard: import("vue").ShallowRef<StsWizard | null, StsWizard | null>;
    ready: import("vue").ComputedRef<boolean>;
    step: import("vue").ShallowRef<StsWizardStep | null, StsWizardStep | null>;
    caption: import("vue").ComputedRef<string>;
    speaking: import("vue").ShallowRef<boolean, boolean>;
    playing: import("vue").ShallowRef<boolean, boolean>;
    error: import("vue").ShallowRef<string | null, string | null>;
    /** The tour leads: scrolls to each section and narrates it. Call from a click. */
    start: () => void;
    /** The visitor leads: each section speaks when they scroll to it. Call from a click first. */
    follow: () => void;
    /** One step from your own event, by id or `data-sts-step` name. */
    play: (name: string) => boolean;
    /** Call from any click so later `play()` calls can make sound. */
    unlock: () => void | undefined;
    stop: () => void;
    setMuted: (value: boolean) => void | undefined;
};
/** Business details (name, description, profile) for your own about or footer block. */
export declare function useStsBusiness(): {
    business: import("vue").ShallowRef<StsBusiness | null, StsBusiness | null>;
    error: import("vue").ShallowRef<string | null, string | null>;
    ready: import("vue").ComputedRef<boolean>;
};
/** The business's own answers, for an FAQ block. */
export declare function useStsAnswers(): {
    answers: import("vue").ComputedRef<StsAnswer[]>;
    error: import("vue").ShallowRef<string | null, string | null>;
    ready: import("vue").ComputedRef<boolean>;
};
/** Reviews the business chose to show. */
export declare function useStsReviews(): {
    reviews: import("vue").ComputedRef<StsReview[]>;
    error: import("vue").ShallowRef<string | null, string | null>;
    ready: import("vue").ComputedRef<boolean>;
};
declare module 'vue' {
    interface ComponentCustomProperties {
        $sts: StsClient;
    }
}
