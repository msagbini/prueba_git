import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateClientAddressDto } from './dto/create-client-address.dto';

/** Client (customer) records. */
@ApiTags('clients')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('clients')
export class ClientsController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param clientsService implements this controller's routes
   */
  constructor(private readonly clientsService: ClientsService) {}

  /**
   * Lists records.
   * @param pagination the requested page/pageSize
   * @returns a page of clients in the caller's active organization
   */
  @RequirePermissions('clients.read')
  @Get()
  list(@Query() pagination: PaginationQueryDto) {
    return this.clientsService.list(pagination);
  }

  /**
   * Creates a record.
   * @param user the authenticated caller
   * @param dto the client to create
   * @returns the created record
   */
  @RequirePermissions('clients.manage')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClientDto) {
    return this.clientsService.create(user.org, user.sub, dto);
  }

  /**
   * Fetches a single record.
   * @param id the client to fetch
   * @returns the matching record
   */
  @RequirePermissions('clients.read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  /**
   * Updates a record.
   * @param user the authenticated caller
   * @param id the client to update
   * @param dto the fields to change
   * @returns the updated record
   */
  @RequirePermissions('clients.manage')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(user.org, user.sub, id, dto);
  }

  /**
   * Removes a record.
   * @param user the authenticated caller
   * @param id the client to remove
   * @returns the removal result
   */
  @RequirePermissions('clients.manage')
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clientsService.remove(user.org, user.sub, id);
  }

  /**
   * Lists addresses.
   * @param id the client to list addresses for
   * @returns the matching addresses
   */
  @RequirePermissions('clients.read')
  @Get(':id/addresses')
  listAddresses(@Param('id') id: string) {
    return this.clientsService.listAddresses(id);
  }

  /**
   * Adds an address.
   * @param user the authenticated caller
   * @param id the client to add an address to
   * @param dto the address to create
   * @returns the created address
   */
  @RequirePermissions('clients.manage')
  @Post(':id/addresses')
  createAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateClientAddressDto,
  ) {
    return this.clientsService.createAddress(user.org, user.sub, id, dto);
  }
}
