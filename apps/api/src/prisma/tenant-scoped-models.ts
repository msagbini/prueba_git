import type { Prisma } from '@prisma/client';

/**
 * Every Prisma model (by its PascalCase model name, as seen by Client
 * Extensions) that carries an `organizationId` column and must be
 * auto-scoped by {@link tenantScopingExtension}. Deliberately excludes:
 * - The 8 global identity/reference tables (User, Role, Permission,
 *   RolePermission, IndustryVertical, PasswordResetToken,
 *   EmailVerificationToken, Plan) — see schema.prisma's header comment.
 * - `Organization` itself, whose tenant boundary is its own `id`, not an
 *   `organizationId` column — callers filter explicitly by id, and RLS
 *   (policied on id) is the enforcement layer for that table.
 */
export const TENANT_SCOPED_MODELS: ReadonlySet<Prisma.ModelName> = new Set<Prisma.ModelName>([
  'OrganizationMembership',
  'UserInvitation',
  'RefreshToken',
  'Client',
  'ClientAddress',
  'ServiceCategory',
  'Service',
  'Job',
  'JobService',
  'JobAssignment',
  'StaffProfile',
  'Invoice',
  'InvoiceLineItem',
  'Payment',
  'AuditLog',
  'Subscription',
]);

/**
 * Type guard narrowing a Prisma model name to one that is tenant-scoped.
 * @param model the Prisma model name reported by a Client Extension hook
 * @returns whether `model` is a member of {@link TENANT_SCOPED_MODELS}
 */
export function isTenantScopedModel(
  model: Prisma.ModelName | undefined,
): model is Prisma.ModelName {
  return model !== undefined && TENANT_SCOPED_MODELS.has(model);
}
