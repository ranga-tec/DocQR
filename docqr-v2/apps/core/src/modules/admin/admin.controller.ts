import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequireRoles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireRoles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get audit logs with filtering' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'resourceType', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getAuditLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAuditLogs({
      userId,
      action,
      resourceType,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('reports/sla')
  @ApiOperation({ summary: 'Get SLA compliance report' })
  getSlaReport() {
    return this.adminService.getSlaReport();
  }

  @Get('reports/workload')
  @ApiOperation({ summary: 'Get workload report by user and department' })
  getWorkloadReport() {
    return this.adminService.getWorkloadReport();
  }

  @Get('reports/turnaround')
  @ApiOperation({ summary: 'Get turnaround time analytics report' })
  getTurnaroundReport() {
    return this.adminService.getTurnaroundReport();
  }
}
