const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * The current access token, held in memory only (never `localStorage`) —
 * see docs/architecture/auth.md. Reset on page reload; a real session
 * restore flow (silent refresh via the httpOnly cookie on app boot) is
 * Fase 5 work, not part of this scaffold.
 */
let accessToken: string | null = null;

/**
 * Sets the in-memory access token used by {@link apiFetch}.
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
 * Minimal typed fetch wrapper for the DOS API. Attaches the in-memory
 * access token and sends cookies (`credentials: 'include'`) so the
 * httpOnly refresh-token cookie is included — see
 * docs/architecture/auth.md for the token model this implements against.
 * Refresh-on-401 and other resilience behavior are Fase 5 work; this
 * scaffold only shapes the request/response contract.
 * @param path the API path, relative to `VITE_API_URL` (e.g. "/auth/me")
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  const body: unknown = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, body);
  }

  return body as T;
}
