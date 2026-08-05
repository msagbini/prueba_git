/**
 * Port for transactional email. Only this interface is defined in Fase 2
 * — the concrete provider (SES, Postmark, etc.) is an infra decision
 * deferred past this phase (see docs/technical-log/phase-2.md); until
 * then, `ConsoleEmailService` implements it by logging.
 */
export abstract class EmailService {
  /**
   * Sends the email-verification link created at signup.
   * @param to the recipient's email address
   * @param token the raw (unhashed) verification token to embed in the link
   */
  abstract sendVerificationEmail(to: string, token: string): Promise<void>;

  /**
   * Sends the password-reset link.
   * @param to the recipient's email address
   * @param token the raw (unhashed) reset token to embed in the link
   */
  abstract sendPasswordResetEmail(to: string, token: string): Promise<void>;

  /**
   * Sends an organization invitation link.
   * @param to the invitee's email address
   * @param organizationName the inviting organization's display name
   * @param token the raw (unhashed) invitation token to embed in the link
   */
  abstract sendInvitationEmail(to: string, organizationName: string, token: string): Promise<void>;
}
