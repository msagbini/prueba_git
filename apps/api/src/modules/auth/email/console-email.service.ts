import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * Fase 2 placeholder {@link EmailService}: logs instead of sending.
 * Swapping in a real provider later means implementing this interface
 * and changing one DI binding in `auth.module.ts` — nothing else in the
 * codebase depends on how email is actually delivered.
 */
@Injectable()
export class ConsoleEmailService extends EmailService {
  private readonly logger = new Logger(ConsoleEmailService.name);

  /**
   * Logs the verification link instead of sending it.
   * @param to the recipient's email address
   * @param token the raw verification token
   * @returns nothing (resolves once logged)
   */
  async sendVerificationEmail(to: string, token: string): Promise<void> {
    this.logger.log(`[stub email] Verification link for ${to}: token=${token}`);
    return Promise.resolve();
  }

  /**
   * Logs the password-reset link instead of sending it.
   * @param to the recipient's email address
   * @param token the raw reset token
   * @returns nothing (resolves once logged)
   */
  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    this.logger.log(`[stub email] Password reset link for ${to}: token=${token}`);
    return Promise.resolve();
  }

  /**
   * Logs the invitation link instead of sending it.
   * @param to the invitee's email address
   * @param organizationName the inviting organization's display name
   * @param token the raw invitation token
   * @returns nothing (resolves once logged)
   */
  async sendInvitationEmail(to: string, organizationName: string, token: string): Promise<void> {
    this.logger.log(
      `[stub email] Invitation to join "${organizationName}" for ${to}: token=${token}`,
    );
    return Promise.resolve();
  }
}
