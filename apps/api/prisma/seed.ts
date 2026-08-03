/**
 * Seeds reference data that must exist before any organization can sign
 * up: the fixed system roles, their permissions, the supported industry
 * verticals, and the subscription plans DOS itself sells. Run via
 * `pnpm prisma:seed`. Idempotent — safe to re-run (uses upsert
 * throughout).
 */
import { PrismaClient, RoleCode, IndustryVerticalCode, PlanCode } from '@prisma/client';

const prisma = new PrismaClient();

/** Permission codes grouped by the module they govern, mirroring the RBAC matrix in docs/architecture/auth.md. */
const PERMISSIONS = [
  {
    code: 'organizations.manage',
    module: 'organizations',
    description: 'Manage organization settings',
  },
  { code: 'users.manage', module: 'users', description: 'Invite, update and remove members' },
  { code: 'clients.manage', module: 'clients', description: 'Create, update and delete clients' },
  { code: 'clients.read', module: 'clients', description: 'View clients' },
  { code: 'services.manage', module: 'services', description: 'Manage the service catalog' },
  { code: 'services.read', module: 'services', description: 'View the service catalog' },
  { code: 'jobs.manage', module: 'jobs', description: 'Create, update, delete and assign jobs' },
  { code: 'jobs.read', module: 'jobs', description: 'View jobs' },
  { code: 'staff.manage', module: 'staff', description: 'Manage staff profiles' },
  { code: 'staff.read', module: 'staff', description: 'View staff profiles' },
  { code: 'invoices.manage', module: 'invoices', description: 'Create, update and void invoices' },
  { code: 'invoices.read', module: 'invoices', description: 'View invoices' },
  { code: 'payments.manage', module: 'payments', description: 'Record and manage payments' },
  { code: 'payments.read', module: 'payments', description: 'View payments' },
  { code: 'audit_logs.read', module: 'audit_logs', description: 'View the audit log' },
] as const;

/** Which permission codes each system role grants, per the RBAC matrix in docs/architecture/auth.md. */
const ROLE_PERMISSIONS: Record<RoleCode, readonly string[]> = {
  [RoleCode.OWNER]: PERMISSIONS.map((p) => p.code),
  [RoleCode.ADMIN]: PERMISSIONS.map((p) => p.code).filter((c) => c !== 'organizations.manage'),
  [RoleCode.DISPATCHER]: [
    'clients.manage',
    'clients.read',
    'services.read',
    'jobs.manage',
    'jobs.read',
    'staff.read',
    'invoices.manage',
    'invoices.read',
    'payments.manage',
    'payments.read',
  ],
  [RoleCode.STAFF]: ['jobs.read', 'staff.read'],
  [RoleCode.CLIENT]: ['jobs.read', 'invoices.read', 'payments.read'],
};

const ROLES: { code: RoleCode; name: string; description: string }[] = [
  {
    code: RoleCode.OWNER,
    name: 'Owner',
    description: 'Full control over the organization, including billing and org settings',
  },
  {
    code: RoleCode.ADMIN,
    name: 'Admin',
    description: 'Full operational control, excluding organization-level settings',
  },
  {
    code: RoleCode.DISPATCHER,
    name: 'Dispatcher',
    description: 'Day-to-day scheduling and client operations',
  },
  {
    code: RoleCode.STAFF,
    name: 'Staff',
    description: 'Field staff — sees and updates their own assigned jobs',
  },
  {
    code: RoleCode.CLIENT,
    name: 'Client',
    description: 'A customer with portal access to their own records',
  },
];

const INDUSTRY_VERTICALS: { code: IndustryVerticalCode; name: string; description: string }[] = [
  {
    code: IndustryVerticalCode.CLEANING,
    name: 'Cleaning',
    description: 'Residential, commercial, office and deep cleaning',
  },
  {
    code: IndustryVerticalCode.CONSTRUCTION_CLEANING,
    name: 'Construction cleaning',
    description: 'Post-construction and renovation cleanup',
  },
  {
    code: IndustryVerticalCode.MAINTENANCE,
    name: 'Maintenance',
    description: 'Recurring facility and property maintenance',
  },
  {
    code: IndustryVerticalCode.LANDSCAPING,
    name: 'Landscaping',
    description: 'Lawn care and grounds maintenance',
  },
  {
    code: IndustryVerticalCode.GENERAL_FIELD_SERVICE,
    name: 'General field service',
    description: 'Other dispatched, on-site service work',
  },
];

/**
 * The tiers DOS itself sells to organizations (Fase 4) — not the
 * cleaning business's own service catalog. `null` limits mean
 * unlimited. `stripePriceId` is left unset here; wiring a real Stripe
 * catalog is a deploy-time configuration step, not something seeded
 * with fake ids (see docs/technical-log/phase-4.md).
 */
const PLANS: {
  code: PlanCode;
  name: string;
  description: string;
  priceMonthlyCents: number;
  maxClients: number | null;
  maxActiveJobs: number | null;
  maxStaff: number | null;
}[] = [
  {
    code: PlanCode.FREE,
    name: 'Free',
    description: 'Get started at no cost — enough to run a small operation.',
    priceMonthlyCents: 0,
    maxClients: 10,
    maxActiveJobs: 20,
    maxStaff: 2,
  },
  {
    code: PlanCode.PRO,
    name: 'Pro',
    description: 'For growing teams juggling more clients and staff.',
    priceMonthlyCents: 4900,
    maxClients: 100,
    maxActiveJobs: 500,
    maxStaff: 10,
  },
  {
    code: PlanCode.BUSINESS,
    name: 'Business',
    description: 'No limits — for established operations at scale.',
    priceMonthlyCents: 14900,
    maxClients: null,
    maxActiveJobs: null,
    maxStaff: null,
  },
];

/** Upserts permissions, roles, role-permission grants, and industry verticals. */
async function main(): Promise<void> {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { module: permission.module, description: permission.description },
      create: permission,
    });
  }

  for (const role of ROLES) {
    const created = await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: { ...role, isSystemRole: true },
    });

    const permissionCodes = ROLE_PERMISSIONS[role.code];
    const permissions = await prisma.permission.findMany({
      where: { code: { in: [...permissionCodes] } },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: created.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: created.id, permissionId: permission.id })),
    });
  }

  for (const vertical of INDUSTRY_VERTICALS) {
    await prisma.industryVertical.upsert({
      where: { code: vertical.code },
      update: { name: vertical.name, description: vertical.description },
      create: vertical,
    });
  }

  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        priceMonthlyCents: plan.priceMonthlyCents,
        maxClients: plan.maxClients,
        maxActiveJobs: plan.maxActiveJobs,
        maxStaff: plan.maxStaff,
      },
      create: plan,
    });
  }

  console.log('Seed complete: roles, permissions, role_permissions, industry_verticals, plans.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
