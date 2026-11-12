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
 * Framework-agnostic STS-AI client. One instance per site.
 * Handles the site-key → session exchange and refreshes the session before it expires.
 */
export function createSts(options) {
    const apiBase = options.apiBase.replace(/\/$/, '');
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
            if (init.body)
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
        },
    };
}
