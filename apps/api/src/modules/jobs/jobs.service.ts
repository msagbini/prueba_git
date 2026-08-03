import { Injectable, NotImplementedException } from '@nestjs/common';
import { TenantContextService } from '../../prisma/tenant-context.service';
import type { CreateJobDto } from './dto/create-job.dto';
import type { UpdateJobDto } from './dto/update-job.dto';
import type { CreateJobAssignmentDto } from './dto/create-job-assignment.dto';
import type { CreateJobServiceDto } from './dto/create-job-service.dto';

/**
 * Scheduled jobs: creation, status/scheduling updates, staff assignment
 * and the services billed to a job. A Staff caller only ever sees jobs
 * they're assigned to — see the RBAC matrix in docs/architecture/auth.md
 * — enforced here at the service layer alongside RLS. Fase 2 scope note:
 * see `organizations.service.ts` for the pattern this follows.
 */
@Injectable()
export class JobsService {
  /**
   * Constructs the service around the tenant-scoped Prisma client.
   * @param tenantContext the current request's tenant-scoped Prisma client
   */
  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Lists records. Stubbed for Fase 3 — see the class-level scope note.
   */
  list(): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Creates a record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _dto the job to create
   */
  create(_dto: CreateJobDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Fetches a single record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _id the job to fetch
   */
  findOne(_id: string): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Updates a record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _id the job to update
   * @param _dto the fields to change
   */
  update(_id: string, _dto: UpdateJobDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Removes a record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _id the job to remove
   */
  remove(_id: string): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Creates an assignment. Stubbed for Fase 3 — see the class-level scope note.
   * @param _jobId the job to assign staff to
   * @param _dto the membership to assign
   */
  createAssignment(_jobId: string, _dto: CreateJobAssignmentDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Adds a service to a job. Stubbed for Fase 3 — see the class-level scope note.
   * @param _jobId the job to add a service to
   * @param _dto the service and quantity to add
   */
  createJobService(_jobId: string, _dto: CreateJobServiceDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }
}
