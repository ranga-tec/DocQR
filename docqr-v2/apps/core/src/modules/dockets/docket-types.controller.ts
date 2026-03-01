import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequireRoles } from '../../common/decorators/roles.decorator';
import {
  CreateDocketTypeDto,
  DocketTypesService,
  UpdateDocketTypeDto,
} from './docket-types.service';

@ApiTags('docket-types')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('docket-types')
export class DocketTypesController {
  constructor(private readonly docketTypesService: DocketTypesService) {}

  @Get()
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiOperation({ summary: 'List all docket types' })
  async findAll(@Query('includeInactive') includeInactive?: string | boolean) {
    const includeInactiveFlag =
      includeInactive === true || includeInactive === 'true' || includeInactive === '1';
    const types = await this.docketTypesService.findAll(includeInactiveFlag);
    return { data: types };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get docket type by ID' })
  findOne(@Param('id') id: string) {
    return this.docketTypesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @RequireRoles('admin')
  @ApiOperation({ summary: 'Create docket type (Admin only)' })
  create(@Body() dto: CreateDocketTypeDto) {
    return this.docketTypesService.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @RequireRoles('admin')
  @ApiOperation({ summary: 'Update docket type (Admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateDocketTypeDto) {
    return this.docketTypesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @RequireRoles('admin')
  @ApiOperation({ summary: 'Delete docket type (Admin only)' })
  remove(@Param('id') id: string) {
    return this.docketTypesService.remove(id);
  }
}
