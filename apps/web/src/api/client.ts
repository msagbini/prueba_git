const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * The current access token, held in memory only (never `localStorage`) —
 * see docs/architecture/auth.md. Reset on page reload; `AuthContext`
 * restores it on boot via a silent `POST /auth/refresh` against the
 * httpOnly cookie (see `src/context/AuthContext.tsx`).
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
 * Reads the `role` claim out of an access token's payload, without
 * verifying the signature — this is display-only (which nav links to
 * show), never an authorization decision, so there's nothing to gain
 * from a real JWT library here: every route this role gates is also
 * enforced server-side by `PermissionsGuard` against the same token.
 * @param token the access token issued by `POST /auth/login` et al.
 * @returns the token's `role` claim, or null if the token can't be parsed
 */
export function decodeJwtRole(token: string): string | null {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) return null;
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const payload: unknown = JSON.parse(atob(base64));
    if (typeof payload !== 'object' || payload === null || !('role' in payload)) return null;
    const role = (payload as { role: unknown }).role;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}

/**
 * Fetches a binary response (e.g. a generated PDF) and triggers a
 * browser download, reusing the same auth/credentials handling as
 * {@link apiFetch}. Kept separate from `apiFetch` rather than adding a
 * `responseType` option to it — every other call site wants parsed
 * JSON, this is the one exception, and object-URL cleanup only makes
 * sense here.
 * @param path the API path, relative to `VITE_API_URL`
 * @param fallbackFileName used if the response has no `Content-Disposition` filename
 * @throws ApiError if the response status is not ok
 */
export async function downloadFile(path: string, fallbackFileName: string): Promise<void> {
  const headers = new Headers();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { headers, credentials: 'include' });
  if (!response.ok) {
    throw new ApiError(response.status, null);
  }

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackFileName;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Minimal typed fetch wrapper for the DOS API. Attaches the in-memory
 * access token and sends cookies (`credentials: 'include'`) so the
 * httpOnly refresh-token cookie is included — see
 * docs/architecture/auth.md for the token model this implements against.
 * Does not itself retry a 401 with a silent refresh — `AuthContext`
 * performs the one refresh call it needs (session restore on boot)
 * directly; a general refresh-and-retry interceptor here is more
 * machinery than this app's current call sites need.
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
