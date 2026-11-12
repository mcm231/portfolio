// Every call this site makes to /api/*. One file holds the urls, so a route
// change lands in one place and no page script writes a path.
//
// Each call returns the parsed answer, or throws an ApiError. The error
// carries the status and the sentence the server wrote, so a page can show
// that sentence without reading the body itself.

export class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

async function request(url, options) {
    let response;

    try {
        response = await fetch(url, options);
    } catch {
        // No answer at all: the network is down, or the host is unreachable.
        throw new ApiError('The site did not answer. Check the network.', 0);
    }

    if (response.status === 204) return null;

    const body = await response.text();
    let parsed = null;

    try {
        parsed = body ? JSON.parse(body) : null;
    } catch {
        parsed = null;
    }

    if (!response.ok) {
        const message =
            (parsed && parsed.error) || `The request failed with status ${response.status}.`;
        throw new ApiError(message, response.status);
    }

    return parsed;
}

export const api = {
    // The url of a picture, or of its small copy. An <img> reads this.
    imageUrl(key) {
        return `/api/images?id=${encodeURIComponent(key)}`;
    },

    // The url of a project download.
    fileUrl(key) {
        return `/api/files?key=${encodeURIComponent(key)}`;
    },

    // Whether this visitor holds the upload permission.
    session() {
        return request('/api/session', { cache: 'no-store' });
    },

    // Every row, newest work included. The filters are optional.
    rows({ tag, medium } = {}) {
        const query = new URLSearchParams();
        if (tag) query.set('tag', tag);
        if (medium) query.set('medium', medium);

        const suffix = query.toString() ? `?${query}` : '';
        return request(`/api/image-metadata${suffix}`);
    },

    row(id) {
        return request(`/api/image-metadata?id=${encodeURIComponent(id)}`);
    },

    // Every term in use, with a count, most used first.
    vocabulary() {
        return request('/api/vocabulary');
    },

    // The bytes of a picture, for the page that makes the small copies.
    async imageBlob(key) {
        const response = await fetch(api.imageUrl(key));
        if (!response.ok) throw new ApiError(`Could not read "${key}".`, response.status);
        return response.blob();
    },

    saveRow(form) {
        return request('/api/upload', { method: 'POST', body: form });
    },

    deleteRow(id) {
        return request(`/api/upload?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    saveThumbnail(form) {
        return request('/api/thumbnail', { method: 'POST', body: form });
    },

    sendMessage(form) {
        return request('/api/contact', { method: 'POST', body: form });
    },

    messages() {
        return request('/api/messages', { cache: 'no-store' });
    },

    deleteMessage(key) {
        return request(`/api/messages?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
    },
};
