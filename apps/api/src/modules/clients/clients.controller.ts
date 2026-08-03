import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateClientAddressDto } from './dto/create-client-address.dto';

/** Client (customer) records. See `clients.service.ts` for the Fase 2 stub scope note. */
@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param clientsService implements this controller's routes
   */
  constructor(private readonly clientsService: ClientsService) {}

  /**
   * Lists records.
   * @returns every client in the caller's active organization.
   */
  @Get()
  list() {
    return this.clientsService.list();
  }

  /**
   * Creates a record.
   * @param dto the client to create
   * @returns the created record
   */
  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  /**
   * Fetches a single record.
   * @param id the client to fetch
   * @returns the matching record
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  /**
   * Updates a record.
   * @param id the client to update
   * @param dto the fields to change
   * @returns the updated record
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  /**
   * Removes a record.
   * @param id the client to remove
   * @returns the removal result
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }

  /**
   * Lists addresses.
   * @param id the client to list addresses for
   * @returns the matching addresses
   */
  @Get(':id/addresses')
  listAddresses(@Param('id') id: string) {
    return this.clientsService.listAddresses(id);
  }

  /**
   * Adds an address.
   * @param id the client to add an address to
   * @param dto the address to create
   * @returns the created address
   */
  @Post(':id/addresses')
  createAddress(@Param('id') id: string, @Body() dto: CreateClientAddressDto) {
    return this.clientsService.createAddress(id, dto);
  }
}
