import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { EnvConfig } from '../../../config/env.validation';
import { EmailService } from './email.service';

/**
 * Real transactional email over SMTP (`nodemailer`), bound in
 * `AuthModule` whenever `SMTP_HOST` is set — see `ConsoleEmailService`
 * for the fallback used otherwise. Link URLs are built from
 * `WEB_APP_URL`; the corresponding web pages (`/verify-email`,
 * `/reset-password`, `/accept-invitation/:token`) don't exist yet in
 * `apps/web` as of Fase 9 — that's a separate, tracked follow-up, not
 * this service's concern (the API's own token-based endpoints work
 * regardless of what UI, if any, calls them).
 */
@Injectable()
export class SmtpEmailService extends EmailService {
  private readonly logger = new Logger(SmtpEmailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly webAppUrl: string;

  /**
   * Constructs the SMTP transport from validated env config.
   * @param config the application's validated environment configuration
   */
  constructor(config: ConfigService<EnvConfig, true>) {
    super();
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORT', { infer: true }),
      secure: config.get('SMTP_SECURE', { infer: true }),
      auth: config.get('SMTP_USER', { infer: true })
        ? {
            user: config.get('SMTP_USER', { infer: true }),
            pass: config.get('SMTP_PASSWORD', { infer: true }),
          }
        : undefined,
    });
    this.from = config.get('SMTP_FROM', { infer: true });
    this.webAppUrl = config.get('WEB_APP_URL', { infer: true });
  }

  /**
   * Sends the email-verification link created at signup.
   * @param to the recipient's email address
   * @param token the raw (unhashed) verification token to embed in the link
   */
  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const link = `${this.webAppUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await this.send(
      to,
      'Verify your email',
      `Confirm your email address to finish setting up your account: ${link}`,
    );
  }

  /**
   * Sends the password-reset link.
   * @param to the recipient's email address
   * @param token the raw (unhashed) reset token to embed in the link
   */
  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const link = `${this.webAppUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.send(
      to,
      'Reset your password',
      `Reset your DOS password: ${link}\n\nIf you didn't request this, ignore this email.`,
    );
  }

  /**
   * Sends an organization invitation link.
   * @param to the invitee's email address
   * @param organizationName the inviting organization's display name
   * @param token the raw (unhashed) invitation token to embed in the link
   */
  async sendInvitationEmail(to: string, organizationName: string, token: string): Promise<void> {
    const link = `${this.webAppUrl}/accept-invitation/${encodeURIComponent(token)}`;
    await this.send(
      to,
      `You're invited to join ${organizationName} on DOS`,
      `Join ${organizationName}: ${link}`,
    );
  }

  /**
   * Sends a plain-text email, logging (not throwing) on failure — a
   * transient SMTP outage shouldn't fail the signup/invite/reset request
   * that triggered it; the caller has already done the thing the email is
   * just notifying about.
   * @param to the recipient's email address
   * @param subject the email subject line
   * @param text the plain-text email body
   */
  private async send(to: string, subject: string, text: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
    } catch (err) {
      this.logger.error(
        `Failed to send "${subject}" to ${to}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
