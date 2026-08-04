import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { EnvConfig } from '../../../config/env.validation';
import { SmtpEmailService } from './smtp-email.service';

jest.mock('nodemailer');

/**
 * Minimal fake of the `ConfigService<EnvConfig, true>` slice this service reads.
 * @param overrides env values to override the defaults with
 * @returns a fake ConfigService exposing only `get()`
 */
function fakeConfig(overrides: Partial<EnvConfig> = {}): ConfigService<EnvConfig, true> {
  const values: Partial<EnvConfig> = {
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_USER: 'apikey',
    SMTP_PASSWORD: 'secret',
    SMTP_FROM: 'DOS <no-reply@dos.example.com>',
    WEB_APP_URL: 'https://app.dos.example.com',
    ...overrides,
  };
  return { get: (key: keyof EnvConfig) => values[key] } as ConfigService<EnvConfig, true>;
}

describe('SmtpEmailService', () => {
  const sendMail = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    sendMail.mockClear();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  });

  it('builds the transport from SMTP_* config, with auth when SMTP_USER is set', () => {
    new SmtpEmailService(fakeConfig());

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'apikey', pass: 'secret' },
    });
  });

  it('omits auth entirely when SMTP_USER is unset (some relays allow unauthenticated local delivery)', () => {
    new SmtpEmailService(fakeConfig({ SMTP_USER: undefined }));

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: undefined }),
    );
  });

  it('sends the verification email with a WEB_APP_URL-based link', async () => {
    const service = new SmtpEmailService(fakeConfig());

    await service.sendVerificationEmail('user@test.local', 'tok123');

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'DOS <no-reply@dos.example.com>',
        to: 'user@test.local',
        subject: 'Verify your email',
        text: expect.stringContaining('https://app.dos.example.com/verify-email?token=tok123'),
      }),
    );
  });

  it('sends the password reset email with a WEB_APP_URL-based link', async () => {
    const service = new SmtpEmailService(fakeConfig());

    await service.sendPasswordResetEmail('user@test.local', 'reset-tok');

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('https://app.dos.example.com/reset-password?token=reset-tok'),
      }),
    );
  });

  it('sends the invitation email naming the organization, with a WEB_APP_URL-based link', async () => {
    const service = new SmtpEmailService(fakeConfig());

    await service.sendInvitationEmail('invitee@test.local', 'Acme Cleaning', 'invite-tok');

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "You're invited to join Acme Cleaning on DOS",
        text: expect.stringContaining('https://app.dos.example.com/accept-invitation/invite-tok'),
      }),
    );
  });

  it('logs rather than throws when the SMTP transport rejects', async () => {
    sendMail.mockRejectedValueOnce(new Error('connection refused'));
    const service = new SmtpEmailService(fakeConfig());

    await expect(
      service.sendVerificationEmail('user@test.local', 'tok123'),
    ).resolves.toBeUndefined();
  });
});
