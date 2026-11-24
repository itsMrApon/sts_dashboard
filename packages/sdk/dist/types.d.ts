export type StsOptions = {
    /** Your STS-AI app URL, e.g. https://app.sts-ai.com */
    apiBase: string;
    /** Publishable site key (sts_pk_live_…). Safe in the browser; only works on your allowed website. */
    siteKey: string;
};
/** `select` is a multiple-choice question; `multiple` says whether several answers are allowed. */
export type FormFieldType = 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'url' | 'date' | 'select' | 'yesno' | 'rating';
/** Brand colour picked in the dashboard, as a hex string (e.g. "#8b5cf6"). */
export type StsAccent = string;
export type StsFormField = {
    id: string;
    label: string;
    type: FormFieldType;
    required: boolean;
    options: string[];
    /** `select` only: several choices may be picked (send them as a string array). */
    multiple: boolean;
    /** `rating` only: 5 = 1–5 stars, 10 = a 0–10 scale. Send the score as a string. */
    scale: 5 | 10;
    placeholder: string;
    helpText: string;
};
/** One answer: a string, or a string array for a multi-answer `select` question. */
export type StsFormAnswer = string | string[];
export type StsForm = {
    title: string;
    description: string;
    fields: StsFormField[];
    consentText: string;
    submitLabel: string;
    successMessage: string;
    accent: StsAccent;
    /** Background of the hosted form; use it as a hint for your own design. */
    theme: 'light' | 'dark';
    /** Send the visitor here after a successful submit, when set. */
    redirectUrl: string | null;
};
export type StsChatConfig = {
    greeting: string;
    suggestions: string[];
    maxMessageLength: number;
    includeLinks: boolean;
    /** Name for your chat header. */
    assistantName: string;
    inputPlaceholder: string;
    /** Show this when a reply fails. */
    fallbackMessage: string;
    showHumanHandoff: boolean;
    /** Documents the assistant may ask for. Show an attach button when this is not empty. */
    documentRequests: StsDocumentRequest[];
    accent: StsAccent;
};
export type StsSpeakConfig = {
    maxCallMinutes: number;
    firstMessage: string | null;
    language: 'en' | 'bn';
    callButtonLabel: string;
    /** Warn the caller this many seconds before the limit (0 = no warning). */
    endWarningSeconds: number;
    showHumanHandoff: boolean;
};
export type StsSessionInfo = {
    business: {
        name: string;
        description: string | null;
        aiName: string | null;
    };
    /** `null` = that service is turned off in the STS-AI dashboard. */
    services: {
        chat: StsChatConfig | null;
        speak: StsSpeakConfig | null;
        form: StsForm | null;
        wizards: {
            slug: string;
            name: string;
            language: string;
        }[];
    };
};
export type StsChatLinks = {
    products: {
        name: string;
        url: string;
        buyUrl?: string;
    }[];
    buyNow: string | null;
    social: {
        platform: string;
        label: string;
        url?: string;
    }[];
} | null;
export type StsChatReply = {
    reply: string;
    links: StsChatLinks;
};
/** One question customers ask and the business's own answer to it. */
export type StsAnswer = {
    question: string;
    answer: string;
};
/** A document the chat may ask for. `accept` tells your file picker what to allow. */
export type StsDocumentRequest = {
    id: string;
    name: string;
    when: string;
    accept: 'pdf' | 'image' | 'any';
};
/** A file saved to the business's Google Drive. `message` is what to send next in the chat. */
export type StsChatUpload = {
    ok: true;
    file: {
        name: string;
        url: string | null;
    };
    message: string;
};
export type StsSpeakConnection = {
    serverUrl: string;
    roomName: string;
    participantName: string;
    participantToken: string;
    maxCallMinutes: number;
};
export type StsWizardStep = {
    id: string;
    heading: string;
    body: string;
    narration: string;
    /** `data-sts-step` value of the section on your page, if set. */
    target: string | null;
    ctaLabel: string | null;
    ctaUrl: string | null;
    audioUrl: string | null;
};
export type StsWizard = {
    slug: string;
    name: string;
    guideName: string;
    language: 'en' | 'bn';
    steps: StsWizardStep[];
};
/** A document customers need (Docs). serviceIds ties it to Menu services ("Used for"); may be empty. */
export type StsDoc = {
    id: string;
    name: string;
    formCode: string;
    issuer: string;
    pdfUrl: string;
    serviceIds: string[];
};
/** One entry on the Menu. Products you sell online come as `offers` instead. */
export type StsBusinessService = {
    id: string;
    name: string;
    category: string;
    summary: string;
    price: string;
};
/** A product or project from Projects, with every way to order that is on. */
export type StsOffer = {
    title: string;
    description: string | null;
    kind: 'PRODUCT' | 'PROJECT';
    featured: boolean;
    /** The single link to use for one button. */
    primaryUrl: string;
    links: {
        share: string | null;
        pay: string | null;
        live: string | null;
    };
};
/** An upcoming or running live session (a webinar from Projects). */
export type StsLiveSession = {
    slug: string;
    title: string;
    description: string | null;
    thumbnail: string | null;
    /** ISO times. */
    startsAt: string;
    endsAt: string | null;
    status: 'scheduled' | 'waiting' | 'live';
    /** Waiting room with a countdown, then the session. */
    joinUrl: string;
    /** Sign up or buy first, when that way to order is on. */
    shareUrl: string | null;
};
/** Contact: how visitors reach the business, plus the footer's tagline and legal links. */
export type StsContactCard = {
    email: string;
    phone: string;
    address: string;
    hours: string;
    mapUrl: string;
    credentials: string[];
    tagline: string;
    copyright: string;
    privacyUrl: string;
    termsUrl: string;
};
export type StsBusinessSite = {
    seo: {
        title: string;
        description: string;
        ogImage: string;
    };
    services: StsBusinessService[];
    docs: StsDoc[];
    /** Live settings: the heading and button text to use around `business.live`. */
    live: {
        enabled: boolean;
        title: string;
        joinLabel: string;
        maxSessions: number;
    };
    keyDates: {
        id: string;
        date: string;
        title: string;
    }[];
    social: {
        followLabel: string;
        accounts: {
            id: string;
            platform: string;
            handle: string;
            url: string;
        }[];
    };
    footer: StsContactCard;
    appearance: {
        accent: StsAccent;
        heroAlign: 'center' | 'left';
        show: {
            offers: boolean;
            services: boolean;
            keyDates: boolean;
            social: boolean;
            terms: boolean;
        };
        actions: {
            chat: boolean;
            speak: boolean;
            form: boolean;
            wizard: boolean;
        };
    };
};
export type StsBusiness = {
    name: string;
    description: string | null;
    profile: Record<string, unknown> | null;
    publishedAt: string | null;
    /** Products and projects from Projects (added automatically when created). Empty until published. */
    offers: StsOffer[];
    /** Live: upcoming and running webinars with a Join link, soonest first. Empty until published. */
    live: StsLiveSession[];
    /** Published content from Messages → Business; null until the business is published. */
    site: StsBusinessSite | null;
};
export declare class StsError extends Error {
    readonly code: string;
    readonly status: number;
    readonly fieldId: string | null;
    constructor(message: string, code: string, status: number, fieldId?: string | null);
}
