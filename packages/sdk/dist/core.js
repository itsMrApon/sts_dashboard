import { StsError, } from './types.js';
const SESSION_HEADER = 'X-Sts-Session';
const SITE_KEY_HEADER = 'X-Sts-Site-Key';
const REFRESH_MARGIN_MS = 60000;
const SESSION_ERRORS = new Set(['SESSION_REQUIRED', 'SESSION_INVALID', 'SESSION_EXPIRED']);
async function readJson(response) {
    return (await response.json().catch(() => ({})));
}
function toError(response, body) {
    return new StsError(body.error || `Request failed (${response.status})`, body.code || 'REQUEST_FAILED', response.status, body.fieldId ?? null);
}
/**
 * apiBase is where sts-ai runs, never the website itself. Same origin almost always means the
 * site and a local sts-ai were both given localhost:3000, so every call 404s on the website.
 */
function warnIfSameOrigin(apiBase) {
    if (typeof window === 'undefined' || !window.location?.origin)
        return;
    let origin;
    try {
        origin = new URL(apiBase, window.location.href).origin;
    }
    catch {
        return;
    }
    if (origin !== window.location.origin)
        return;
    console.error(`[sts-ai] apiBase is ${apiBase}, the same address as this website, so every call goes to the website instead of sts-ai. ` +
        'Set apiBase to where sts-ai runs: https://sudotechserve.com, or a local sts-ai on another port (e.g. http://localhost:3001).');
}
/**
 * Framework-agnostic STS-AI client. One instance per site.
 * Handles the site-key → session exchange and refreshes the session before it expires.
 */
export function createSts(options) {
    const apiBase = options.apiBase.replace(/\/$/, '');
    warnIfSameOrigin(apiBase);
    let session = null;
    let pending = null;
    async function openSession() {
        const response = await fetch(`${apiBase}/api/sdk/v1/session`, {
            method: 'POST',
            headers: { [SITE_KEY_HEADER]: options.siteKey },
        });
        const body = await readJson(response);
        if (!response.ok || !body.session)
            throw toError(response, body);
        session = {
            token: body.session.token,
            expiresAt: body.session.expiresAt,
            info: { business: body.business, services: body.services },
        };
        return session;
    }
    async function ensureSession(force = false) {
        if (!force && session && session.expiresAt - REFRESH_MARGIN_MS > Date.now())
            return session;
        if (!pending)
            pending = openSession().finally(() => (pending = null));
        return pending;
    }
    async function request(path, init = {}) {
        const send = async (force) => {
            const { token } = await ensureSession(force);
            const headers = new Headers(init.headers);
            headers.set(SESSION_HEADER, token);
            // JSON bodies only: a FormData upload sets its own multipart boundary.
            if (typeof init.body === 'string')
                headers.set('Content-Type', 'application/json');
            return fetch(`${apiBase}${path}`, { ...init, headers });
        };
        let response = await send(false);
        if (response.status === 401) {
            const body = await readJson(response.clone());
            if (body.code && SESSION_ERRORS.has(body.code))
                response = await send(true);
        }
        const body = await readJson(response);
        if (!response.ok)
            throw toError(response, body);
        return body;
    }
    return {
        apiBase,
        /** Business name + which services are on. Cached for the session. */
        async info() {
            return (await ensureSession()).info;
        },
        chat: {
            send(message) {
                return request('/api/sdk/v1/chat', { method: 'POST', body: JSON.stringify({ message }) });
            },
            /**
             * Sends a document the chat asked for (PDF or photo, up to 10 MB) to the business's Google
             * Drive. `documentId` is the id from `services.chat.documentRequests`, when you know it.
             * Pass the returned `message` to `send()` so the assistant can confirm it arrived.
             */
            attach(file, documentId) {
                const body = new FormData();
                body.append('file', file);
                if (documentId)
                    body.append('documentId', documentId);
                return request('/api/sdk/v1/chat/upload', { method: 'POST', body });
            },
        },
        speak: {
            /** LiveKit credentials for a new call. Use with `livekit-client` (the React hook does this for you). */
            connect(participantName) {
                return request('/api/sdk/v1/speak', {
                    method: 'POST',
                    body: JSON.stringify({ participantName }),
                });
            },
        },
        form: {
            async schema() {
                return (await request('/api/sdk/v1/form')).form;
            },
            async submit(values, consent) {
                const body = await request('/api/sdk/v1/form', {
                    method: 'POST',
                    body: JSON.stringify({ values, consent }),
                });
                return body.message;
            },
        },
        wizard: {
            async load(slug) {
                return (await request(`/api/sdk/v1/wizards/${encodeURIComponent(slug)}`)).wizard;
            },
        },
        business: {
            async get() {
                return (await request('/api/sdk/v1/business')).business;
            },
            /** The business's own answers to what customers ask most, for an FAQ block. */
            async answers() {
                return (await request('/api/sdk/v1/answers')).answers;
            },
            /** Reviews the business chose to show, newest first. */
            async reviews() {
                return (await request('/api/sdk/v1/reviews')).reviews;
            },
        },
    };
}
