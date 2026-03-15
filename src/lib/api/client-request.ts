/**
 * Fetch wrapper for API requests.
 *
 * Auth identity is resolved server-side via x-user-email header or
 * DEV_DEFAULT_USER_EMAIL env var. No manual headers needed from the client.
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    return fetch(input, init);
}
