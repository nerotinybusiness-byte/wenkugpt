/**
 * Fetch wrapper for API requests.
 *
 * Clerk sends session cookies automatically on same-origin requests,
 * so no manual identity headers are needed.
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    return fetch(input, init);
}
