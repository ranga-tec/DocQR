import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { DocketsService, CreateDocketDto, UpdateDocketDto } from './dockets.service';
import { TransitionData } from './workflow.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { DocketFilterParams, WorkflowAction } from '@docqr/shared';

@ApiTags('dockets')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('dockets')
export class DocketsController {
  constructor(private readonly docketsService: DocketsService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('docket:create')
  @ApiOperation({ summary: 'Create a new docket' })
  @ApiResponse({ status: 201, description: 'Docket created successfully' })
  create(@Body() dto: CreateDocketDto, @CurrentUser() user: CurrentUserData) {
    return this.docketsService.create(dto, user.id);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('docket:view')
  @ApiOperation({ summary: 'List all dockets with filters' })
  findAll(@Query() params: DocketFilterParams, @CurrentUser() user: CurrentUserData) {
    return this.docketsService.findAll(params, user.id, user.roles);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('docket:view')
  @ApiOperation({ summary: 'Get docket by ID' })
  findOne(@Param('id') id: string) {
    return this.docketsService.findOne(id);
  }

  @Get('qr/:token')
  @ApiOperation({ summary: 'Get docket by QR token (public for scanning)' })
  findByQrToken(@Param('token') token: string) {
    return this.docketsService.findByQrToken(token);
  }

  @Put(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('docket:update')
  @ApiOperation({ summary: 'Update docket' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocketDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.docketsService.update(id, dto, userId);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('docket:delete')
  @ApiOperation({ summary: 'Delete docket (soft delete)' })
  remove(@Param('id') id: string) {
    return this.docketsService.remove(id);
  }

  // QR Code endpoints
  @Get(':id/qr')
  @ApiOperation({ summary: 'Download QR code image' })
  async getQrCode(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.docketsService.getQrCode(id);
    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="docket-${id}-qr.png"`,
    });
    res.send(buffer);
  }

  @Post(':id/regenerate-qr')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('docket:update')
  @ApiOperation({ summary: 'Regenerate QR code with new token' })
  regenerateQrCode(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.docketsService.regenerateQrCode(id, userId);
  }

  // Workflow endpoints
  @Post(':id/forward')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @RequirePermissions('docket:forward')
  @ApiOperation({ summary: 'Forward docket to user/department' })
  forward(
    @Param('id') id: string,
    @Body() data: TransitionData,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.docketsService.executeAction(
      id,
      WorkflowAction.FORWARD,
      user.id,
      user.roles,
      data,
    );
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @RequirePermissions('docket:approve')
  @ApiOperation({ summary: 'Approve docket' })
  approve(
    @Param('id') id: string,
    @Body() data: TransitionData,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.docketsService.executeAction(
      id,
      WorkflowAction.APPROVE,
      user.id,
      user.roles,
      data,
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @RequirePermissions('docket:reject')
  @ApiOperation({ summary: 'Reject docket' })
  reject(
    @Param('id') id: string,
    @Body() data: TransitionData,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.docketsService.executeAction(
      id,
      WorkflowAction.REJECT,
      user.id,
      user.roles,
      data,
    );
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @RequirePermissions('docket:close')
  @ApiOperation({ summary: 'Close docket' })
  close(
    @Param('id') id: string,
    @Body() data: TransitionData,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.docketsService.executeAction(
      id,
      WorkflowAction.CLOSE,
      user.id,
      user.roles,
      data,
    );
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reopen closed/rejected docket' })
  reopen(
    @Param('id') id: string,
    @Body() data: TransitionData,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.docketsService.executeAction(
      id,
      WorkflowAction.REOPEN,
      user.id,
      user.roles,
      data,
    );
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get workflow history' })
  getHistory(@Param('id') id: string) {
    return this.docketsService.getWorkflowHistory(id);
  }

  @Get(':id/actions')
  @ApiOperation({ summary: 'Get allowed actions for current user' })
  getAllowedActions(@Param('id') id: string, @CurrentUser('roles') roles: string[]) {
    return this.docketsService.getAllowedActions(id, roles);
  }
}
