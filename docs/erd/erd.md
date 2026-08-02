# Entity-relationship diagram

Generated from `apps/api/prisma/schema.prisma` after the
`identity_and_tenancy` and `business_entities` migrations (see
`docs/technical-log/phase-2.md`). Every table/column here should trace back
to a documented requirement — see `docs/architecture/overview.md` for the
product modules this maps to, and `docs/architecture/multi-tenancy.md` for
what `organizationId` presence/absence on each table means.

**Global tables** (no `organizationId` — intentional exceptions, not
oversights): `User`, `Role`, `Permission`, `RolePermission`,
`IndustryVertical`, `PasswordResetToken`, `EmailVerificationToken`.
Every other table is tenant-scoped and carries `organizationId` directly.

```mermaid
erDiagram
    IndustryVertical ||--o{ Organization : "configures"
    Organization ||--o{ OrganizationMembership : "has"
    Organization ||--o{ UserInvitation : "has"
    Organization ||--o{ RefreshToken : "has"
    Organization ||--o{ Client : "has"
    Organization ||--o{ ClientAddress : "has"
    Organization ||--o{ ServiceCategory : "has"
    Organization ||--o{ Service : "has"
    Organization ||--o{ Job : "has"
    Organization ||--o{ JobService : "has"
    Organization ||--o{ JobAssignment : "has"
    Organization ||--o{ StaffProfile : "has"
    Organization ||--o{ Invoice : "has"
    Organization ||--o{ InvoiceLineItem : "has"
    Organization ||--o{ Payment : "has"
    Organization ||--o{ AuditLog : "has (nullable)"

    User ||--o{ OrganizationMembership : "holds"
    User ||--o{ RefreshToken : "owns"
    User ||--o{ PasswordResetToken : "owns"
    User ||--o{ EmailVerificationToken : "owns"
    User ||--o{ UserInvitation : "sent (invitedBy)"
    User ||--o{ Job : "created (createdBy)"
    User ||--o{ AuditLog : "acted (actor, nullable)"

    Role ||--o{ OrganizationMembership : "grants"
    Role ||--o{ RolePermission : "has"
    Role ||--o{ UserInvitation : "proposes"
    Permission ||--o{ RolePermission : "has"

    OrganizationMembership ||--o{ RefreshToken : "scopes"
    OrganizationMembership |o--o| StaffProfile : "is (optional 1:1)"
    OrganizationMembership ||--o{ JobAssignment : "assigned to"
    Client |o--o{ OrganizationMembership : "is (client role, optional)"

    Client ||--o{ ClientAddress : "has"
    Client ||--o{ Job : "requested"
    Client ||--o{ Invoice : "billed"

    ServiceCategory |o--o{ Service : "groups (optional)"
    Service ||--o{ JobService : "used in"
    Service |o--o{ InvoiceLineItem : "billed as (optional)"

    Job ||--o{ JobService : "includes"
    Job ||--o{ JobAssignment : "has"
    Job |o--o{ InvoiceLineItem : "billed via (optional)"
    Job |o--o{ Job : "recurs from (parentJob, optional)"
    ClientAddress |o--o{ Job : "serviced at (optional)"

    Invoice ||--o{ InvoiceLineItem : "has"
    Invoice ||--o{ Payment : "settled by"

    RefreshToken |o--o| RefreshToken : "replaced by (optional)"

    IndustryVertical {
        uuid id PK
        string code UK
        string name
        string description
    }

    Organization {
        uuid id PK
        string name
        string slug UK
        uuid industryVerticalId FK
        string timezone
        string locale
        enum status
        json settings
        datetime createdAt
        datetime updatedAt
    }

    User {
        uuid id PK
        string email UK
        string passwordHash
        string firstName
        string lastName
        string phone
        enum status
        datetime emailVerifiedAt
        datetime lastLoginAt
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    Role {
        uuid id PK
        enum code UK
        string name
        string description
        boolean isSystemRole
    }

    Permission {
        uuid id PK
        string code UK
        string module
        string description
    }

    RolePermission {
        uuid roleId PK_FK
        uuid permissionId PK_FK
    }

    OrganizationMembership {
        uuid id PK
        uuid organizationId FK
        uuid userId FK
        uuid roleId FK
        uuid clientId FK "nullable, Client role only"
        enum status
        datetime joinedAt
        datetime createdAt
        datetime updatedAt
    }

    UserInvitation {
        uuid id PK
        uuid organizationId FK
        string email
        uuid roleId FK
        uuid invitedByUserId FK
        string tokenHash UK
        enum status
        datetime expiresAt
        datetime createdAt
    }

    RefreshToken {
        uuid id PK
        uuid organizationId FK
        uuid userId FK
        uuid membershipId FK
        string tokenHash UK
        datetime expiresAt
        datetime revokedAt
        uuid replacedByTokenId FK "nullable"
        string userAgent
        string ipAddress
        datetime createdAt
    }

    PasswordResetToken {
        uuid id PK
        uuid userId FK
        string tokenHash UK
        datetime expiresAt
        datetime usedAt
        datetime createdAt
    }

    EmailVerificationToken {
        uuid id PK
        uuid userId FK
        string tokenHash UK
        datetime expiresAt
        datetime usedAt
        datetime createdAt
    }

    Client {
        uuid id PK
        uuid organizationId FK
        string name
        enum type
        string primaryContactName
        string email
        string phone
        enum status
        string notes
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    ClientAddress {
        uuid id PK
        uuid organizationId FK
        uuid clientId FK
        enum label
        string addressLine1
        string addressLine2
        string city
        string state
        string postalCode
        string country
        float lat
        float lng
        datetime createdAt
        datetime updatedAt
    }

    ServiceCategory {
        uuid id PK
        uuid organizationId FK
        string name
    }

    Service {
        uuid id PK
        uuid organizationId FK
        uuid categoryId FK "nullable"
        string name
        string description
        enum pricingType
        string unitLabel
        decimal basePrice
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    Job {
        uuid id PK
        uuid organizationId FK
        uuid clientId FK
        uuid serviceAddressId FK "nullable"
        enum status
        datetime scheduledStart
        datetime scheduledEnd
        datetime actualStart
        datetime actualEnd
        string recurrenceRule "RRULE, nullable"
        uuid parentJobId FK "nullable, self"
        string notes
        uuid createdByUserId FK
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    JobService {
        uuid id PK
        uuid organizationId FK
        uuid jobId FK
        uuid serviceId FK
        decimal quantity
        decimal unitPriceSnapshot
        string notes
    }

    JobAssignment {
        uuid id PK
        uuid organizationId FK
        uuid jobId FK
        uuid membershipId FK
        enum status
        datetime assignedAt
    }

    StaffProfile {
        uuid id PK
        uuid organizationId FK
        uuid membershipId FK UK
        string employeeCode
        decimal hourlyRate
        date hireDate
        enum status
        datetime createdAt
        datetime updatedAt
    }

    Invoice {
        uuid id PK
        uuid organizationId FK
        uuid clientId FK
        string invoiceNumber UK "per org"
        enum status
        date issueDate
        date dueDate
        decimal subtotal
        decimal taxAmount
        decimal total
        string currency
        datetime createdAt
        datetime updatedAt
    }

    InvoiceLineItem {
        uuid id PK
        uuid organizationId FK
        uuid invoiceId FK
        uuid jobId FK "nullable"
        uuid serviceId FK "nullable"
        string description
        decimal quantity
        decimal unitPrice
        decimal lineTotal
    }

    Payment {
        uuid id PK
        uuid organizationId FK
        uuid invoiceId FK
        decimal amount
        enum method
        enum status
        datetime paidAt
        string referenceNumber
        string notes
        datetime createdAt
    }

    AuditLog {
        uuid id PK
        uuid organizationId FK "nullable, system events"
        uuid actorUserId FK "nullable"
        string action
        string entityType
        uuid entityId
        json beforeState
        json afterState
        string ipAddress
        string userAgent
        datetime createdAt
    }
```

## Review checklist

Every field above traces to a requirement from the product brief's module
list (organización/autenticación, clientes, servicios, jobs/scheduling,
staff, facturación, pagos) or to a named architectural decision (see
`docs/adr/`). No speculative/unused fields were added. If a future phase
needs a field not listed here, it should land alongside a migration and,
if it changes an established pattern, an ADR — not as a silent addition.
