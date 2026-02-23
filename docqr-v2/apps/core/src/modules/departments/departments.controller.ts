import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DepartmentsService, CreateDepartmentDto, UpdateDepartmentDto } from './departments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequireRoles } from '../../common/decorators/roles.decorator';

@ApiTags('departments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @RequireRoles('admin')
  @ApiOperation({ summary: 'Create a new department (Admin only)' })
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all departments' })
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get('hierarchy')
  @ApiOperation({ summary: 'Get department hierarchy tree' })
  getHierarchy() {
    return this.departmentsService.getHierarchy();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get department by ID' })
  findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  @Get(':id/users')
  @ApiOperation({ summary: 'Get users in department' })
  getDepartmentUsers(@Param('id') id: string) {
    return this.departmentsService.getDepartmentUsers(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @RequireRoles('admin')
  @ApiOperation({ summary: 'Update department (Admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @RequireRoles('admin')
  @ApiOperation({ summary: 'Delete department (Admin only)' })
  remove(@Param('id') id: string) {
    return this.departmentsService.remove(id);
  }
}
