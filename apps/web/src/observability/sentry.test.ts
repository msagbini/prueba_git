import * as Sentry from '@sentry/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureException, initSentry } from './sentry';

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
}));

describe('initSentry', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('initializes the SDK with VITE_SENTRY_DSN', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@sentry.example.com/1');

    initSentry();

    expect(Sentry.init).toHaveBeenCalledWith({ dsn: 'https://public@sentry.example.com/1' });
  });

  it('initializes with an undefined dsn when unset — a safe no-op per the Sentry SDK', () => {
    vi.stubEnv('VITE_SENTRY_DSN', undefined);

    initSentry();

    expect(Sentry.init).toHaveBeenCalledWith({ dsn: undefined });
  });
});

describe('captureException', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reports the error with the component stack attached', () => {
    const error = new Error('boom');

    captureException(error, 'in <App>');

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      contexts: { react: { componentStack: 'in <App>' } },
    });
  });

  it('reports with no context when no component stack is given', () => {
    const error = new Error('boom');

    captureException(error);

    expect(Sentry.captureException).toHaveBeenCalledWith(error, undefined);
  });
});
