import { type StsAnswer, type StsReview, type StsBusiness, type StsChatReply, type StsChatUpload, type StsForm, type StsFormAnswer, type StsOptions, type StsSessionInfo, type StsSpeakConnection, type StsWizard } from './types.js';
/**
 * Framework-agnostic STS-AI client. One instance per site.
 * Handles the site-key → session exchange and refreshes the session before it expires.
 */
export declare function createSts(options: StsOptions): {
    apiBase: string;
    /** Business name + which services are on. Cached for the session. */
    info(): Promise<StsSessionInfo>;
    chat: {
        send(message: string): Promise<StsChatReply>;
        /**
         * Sends a document the chat asked for (PDF or photo, up to 10 MB) to the business's Google
         * Drive. `documentId` is the id from `services.chat.documentRequests`, when you know it.
         * Pass the returned `message` to `send()` so the assistant can confirm it arrived.
         */
        attach(file: File, documentId?: string): Promise<StsChatUpload>;
    };
    speak: {
        /** LiveKit credentials for a new call. Use with `livekit-client` (the React hook does this for you). */
        connect(participantName?: string): Promise<StsSpeakConnection>;
    };
    form: {
        schema(): Promise<StsForm>;
        submit(values: Record<string, StsFormAnswer>, consent: boolean): Promise<string>;
    };
    wizard: {
        load(slug: string): Promise<StsWizard>;
    };
    business: {
        get(): Promise<StsBusiness>;
        /** The business's own answers to what customers ask most, for an FAQ block. */
        answers(): Promise<StsAnswer[]>;
        /** Reviews the business chose to show, newest first. */
        reviews(): Promise<StsReview[]>;
    };
};
export type StsClient = ReturnType<typeof createSts>;
