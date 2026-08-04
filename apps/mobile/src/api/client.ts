import { API_BASE_URL } from './config';

/** The current access token, held in memory and attached to every request. */
let accessToken: string | null = null;

/**
 * Sets the in-memory access token used by {@link apiFetch}. The mobile app
 * additionally persists both tokens to the platform secure storage (see
 * `src/auth/tokenStorage.ts`) — this in-memory copy is just what gets
 * attached to outgoing requests without an async read on every call.
 * @param token the access token to attach to future requests, or null to clear it
 */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Thrown by {@link apiFetch} when the API responds with a non-ok status. */
export class ApiError extends Error {
  /**
   * Creates an ApiError.
   * @param status the HTTP status code
   * @param body the parsed response body, if any
   */
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`);
  }
}

/**
 * Minimal typed fetch wrapper for the DOS API, mirroring `apps/web`'s
 * `src/api/client.ts`. Unlike the web client, this never sends
 * `credentials: 'include'` — the mobile app doesn't use the httpOnly
 * refresh-token cookie at all; both tokens travel in the auth response
 * body and are persisted via `src/auth/tokenStorage.ts` instead (see
 * docs/architecture/auth.md's mobile token-storage section).
 * @param path the API path, relative to {@link API_BASE_URL} (e.g. "/auth/me")
 * @param init standard fetch options
 * @returns the parsed JSON response body
 * @throws ApiError if the response status is not ok
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  const body: unknown = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, body);
  }

  return body as T;
}
