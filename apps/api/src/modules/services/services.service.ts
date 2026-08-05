import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PricingType, type Service, type ServiceCategory } from '@prisma/client';
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginate, type PaginatedResult } from '../../common/pagination';
import { TenantContextService } from '../../prisma/tenant-context.service';
import { AuditLogWriterService } from '../audit-logs/audit-log-writer.service';
import type { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import type { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';

/**
 * The service catalog: categories and priced, sellable services. `remove`
 * deactivates (`isActive: false`) rather than deleting — `Service` has no
 * `deletedAt`, and historical `JobService`/`InvoiceLineItem` rows
 * reference a service by id, so a hard delete would either fail on the
 * foreign key or silently orphan billing history.
 */
@Injectable()
export class ServicesService {
  /**
   * Constructs the service around the tenant-scoped Prisma client.
   * @param tenantContext the current request's tenant-scoped Prisma client
   * @param auditLog records changes made through this service
   */
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly auditLog: AuditLogWriterService,
  ) {}

  /**
   * Lists categories. Not paginated — a service catalog's category list is
   * organizational taxonomy (a handful of entries), not a growing
   * transactional record like clients/jobs/invoices, so an unbounded list
   * here doesn't carry the same risk.
   * @returns every service category in the caller's active organization
   */
  listCategories(): Promise<ServiceCategory[]> {
    return this.tenantContext.client.serviceCategory.findMany({ orderBy: { name: 'asc' } });
  }

  /**
   * Creates a category.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param dto the category to create
   * @returns the created category
   */
  async createCategory(
    organizationId: string,
    actorUserId: string,
    dto: CreateServiceCategoryDto,
  ): Promise<ServiceCategory> {
    const category = await this.tenantContext.client.serviceCategory.create({
      data: { organizationId, name: dto.name },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'service_category.created',
      entityType: 'ServiceCategory',
      entityId: category.id,
      after: category,
    });

    return category;
  }

  /**
   * Lists records.
   * @param pagination the requested page/pageSize
   * @returns a page of services in the caller's active organization
   */
  async list(pagination: PaginationQueryDto): Promise<PaginatedResult<Service>> {
    const { page, pageSize } = pagination;
    const [items, total] = await Promise.all([
      this.tenantContext.client.service.findMany({
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.tenantContext.client.service.count(),
    ]);
    return paginate(items, total, page, pageSize);
  }

  /**
   * Creates a record.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param dto the service to create
   * @returns the created record
   */
  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateServiceDto,
  ): Promise<Service> {
    this.assertUnitLabelPresentForPerUnit(dto.pricingType, dto.unitLabel);

    const service = await this.tenantContext.client.service.create({
      data: {
        organizationId,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        pricingType: dto.pricingType,
        unitLabel: dto.unitLabel,
        basePrice: dto.basePrice,
        isActive: dto.isActive,
      },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'service.created',
      entityType: 'Service',
      entityId: service.id,
      after: service,
    });

    return service;
  }

  /**
   * Fetches a single record.
   * @param id the service to fetch
   * @returns the matching record
   */
  async findOne(id: string): Promise<Service> {
    return this.findOrThrow(id);
  }

  /**
   * Updates a record.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param id the service to update
   * @param dto the fields to change
   * @returns the updated record
   */
  async update(
    organizationId: string,
    actorUserId: string,
    id: string,
    dto: UpdateServiceDto,
  ): Promise<Service> {
    const before = await this.findOrThrow(id);

    const resultingPricingType = dto.pricingType ?? before.pricingType;
    const resultingUnitLabel = dto.unitLabel ?? before.unitLabel ?? undefined;
    this.assertUnitLabelPresentForPerUnit(resultingPricingType, resultingUnitLabel);

    const after = await this.tenantContext.client.service.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        pricingType: dto.pricingType,
        unitLabel: dto.unitLabel,
        basePrice: dto.basePrice,
        isActive: dto.isActive,
      },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'service.updated',
      entityType: 'Service',
      entityId: id,
      before,
      after,
    });

    return after;
  }

  /**
   * Deactivates a record (see the class-level scope note on why this
   * doesn't delete the row).
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param id the service to remove
   */
  async remove(organizationId: string, actorUserId: string, id: string): Promise<void> {
    const before = await this.findOrThrow(id);

    const after = await this.tenantContext.client.service.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'service.deactivated',
      entityType: 'Service',
      entityId: id,
      before,
      after,
    });
  }

  /**
   * Fetches a service or throws if it can't be found.
   * @param id the service to fetch
   * @returns the matching record
   * @throws NotFoundException if no service matches in the caller's active organization
   */
  private async findOrThrow(id: string): Promise<Service> {
    const service = await this.tenantContext.client.service.findFirst({ where: { id } });
    if (!service) {
      throw new NotFoundException('Service not found.');
    }
    return service;
  }

  /**
   * Enforces the DTOs' documented rule that per-unit pricing needs a unit label.
   * @param pricingType the service's (resulting) pricing type
   * @param unitLabel the service's (resulting) unit label, if any
   * @throws BadRequestException if `pricingType` is `PER_UNIT` and `unitLabel` is empty
   */
  private assertUnitLabelPresentForPerUnit(
    pricingType: PricingType,
    unitLabel: string | undefined,
  ): void {
    if (pricingType === PricingType.PER_UNIT && !unitLabel) {
      throw new BadRequestException('unitLabel is required when pricingType is PER_UNIT.');
    }
  }
}
