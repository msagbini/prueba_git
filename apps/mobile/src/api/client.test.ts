import { apiFetch, decodeJwtRole, ApiError, setAccessToken } from './client';

/**
 * Builds a syntactically valid JWT with the given payload — signature is
 * irrelevant since {@link decodeJwtRole} never verifies it.
 * @param payload the claims to encode
 * @returns a three-segment `header.payload.signature` string
 */
function fakeJwt(payload: Record<string, unknown>): string {
  const base64url = (obj: object): string =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base64url({ alg: 'HS256' })}.${base64url(payload)}.signature`;
}

describe('decodeJwtRole', () => {
  it('reads the role claim out of a well-formed token', () => {
    expect(decodeJwtRole(fakeJwt({ sub: 'u1', role: 'CLIENT' }))).toBe('CLIENT');
  });

  it('returns null for a token missing the role claim', () => {
    expect(decodeJwtRole(fakeJwt({ sub: 'u1' }))).toBeNull();
  });

  it('returns null for a malformed token instead of throwing', () => {
    expect(decodeJwtRole('not-a-jwt')).toBeNull();
    expect(decodeJwtRole('')).toBeNull();
  });
});

describe('apiFetch', () => {
  afterEach(() => {
    setAccessToken(null);
    jest.restoreAllMocks();
  });

  it('attaches the Authorization header when an access token is set', async () => {
    setAccessToken('token-123');
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await apiFetch('/jobs');

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer token-123');
  });

  it('omits the Authorization header when no access token is set', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await apiFetch('/plans');

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.has('Authorization')).toBe(false);
  });

  it('returns null for a 204 response without parsing a body', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiFetch('/auth/logout', { method: 'POST' })).resolves.toBeNull();
  });

  it('throws ApiError with the status and parsed body for a non-ok response', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }));

    await expect(apiFetch('/reports/revenue')).rejects.toMatchObject(
      new ApiError(403, { message: 'Forbidden' }),
    );
  });
});
