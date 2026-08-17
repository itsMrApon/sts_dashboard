const SITE_KEY_HEADER = 'X-Sts-Site-Key';
function trimBase(url) {
    return url.replace(/\/$/, '');
}
async function fetchJson(url, siteKey) {
    let res;
    try {
        res = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                [SITE_KEY_HEADER]: siteKey,
            },
            cache: 'no-store',
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        throw new Error(msg.includes('Load failed') || msg.includes('Failed to fetch')
            ? `Cannot reach STS-AI. Check apiBase, CORS allowed origins, and that the server is running.`
            : msg);
    }
    const data = (await res.json().catch(() => ({})));
    if (!res.ok) {
        const detail = data.error || data.code;
        throw new Error(detail ? `${detail} (${res.status})` : `Request failed (${res.status})`);
    }
    return data;
}
export function createStsSiteClient(options) {
    const apiBase = trimBase(options.apiBase);
    const workspaceId = encodeURIComponent(options.workspaceId);
    async function getProfile() {
        return fetchJson(`${apiBase}/api/public/v1/workspaces/${workspaceId}/profile`, options.siteKey);
    }
    async function getServices(type = 'all') {
        const query = type && type !== 'all' ? `?type=${encodeURIComponent(type)}` : '';
        return fetchJson(`${apiBase}/api/public/v1/workspaces/${workspaceId}/services${query}`, options.siteKey);
    }
    return {
        getProfile,
        getServices,
    };
}
