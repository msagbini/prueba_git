import { PrismaService } from '../../prisma/prisma.service';
import { RecurringJobsService } from './recurring-jobs.service';

/**
 * Pure date-math tests for `nextDueOccurrence` — no database needed,
 * `PrismaService` is never actually used by these cases.
 */
describe('RecurringJobsService.nextDueOccurrence', () => {
  const service = new RecurringJobsService({} as PrismaService);
  const now = new Date('2026-01-01T00:00:00.000Z');

  it('returns the next occurrence when a daily rule has one due within the lookahead window', () => {
    const anchor = new Date('2025-12-25T09:00:00.000Z');
    const next = service.nextDueOccurrence('FREQ=DAILY', anchor, now);

    expect(next).not.toBeNull();
    expect(next?.toISOString()).toBe('2026-01-01T09:00:00.000Z');
  });

  it('accepts a rule string with the "RRULE:" prefix, same as without it', () => {
    const anchor = new Date('2025-12-25T09:00:00.000Z');
    const withPrefix = service.nextDueOccurrence('RRULE:FREQ=DAILY', anchor, now);
    const withoutPrefix = service.nextDueOccurrence('FREQ=DAILY', anchor, now);

    expect(withPrefix?.toISOString()).toBe(withoutPrefix?.toISOString());
  });

  it('returns null when nothing is due within the lookahead window', () => {
    const anchor = new Date('2025-12-25T09:00:00.000Z');
    // Yearly from Dec 25 — the next occurrence is ~a year out, well past a 7-day window.
    const next = service.nextDueOccurrence('FREQ=YEARLY', anchor, now);

    expect(next).toBeNull();
  });

  it('returns null for a malformed rule instead of throwing', () => {
    const anchor = new Date('2025-12-25T09:00:00.000Z');
    const next = service.nextDueOccurrence('not a valid rrule at all', anchor, now);

    expect(next).toBeNull();
  });

  it('respects INTERVAL (every 2 weeks), not just FREQ', () => {
    const anchor = new Date('2025-12-25T09:00:00.000Z'); // a Thursday
    // Plain weekly would land Jan 1 (within window); every-2-weeks skips
    // it and lands Jan 8 — 7 days after "now", outside the >7-day-exclusive window.
    const next = service.nextDueOccurrence('FREQ=WEEKLY;INTERVAL=2', anchor, now);

    expect(next).toBeNull();
  });
});
