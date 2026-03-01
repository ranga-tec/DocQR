import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  UseGuards,
  Request,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationPreferenceDto, NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  async getNotifications(
    @Request() req: { user: { id: string } },
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('unreadOnly') unreadOnly?: string | boolean,
  ) {
    const unreadOnlyBool =
      unreadOnly === true || unreadOnly === 'true' || unreadOnly === '1';

    return this.notificationsService.getUserNotifications(req.user.id, {
      limit: limit ? parseInt(String(limit)) : 20,
      offset: offset ? parseInt(String(offset)) : 0,
      unreadOnly: unreadOnlyBool,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@Request() req: { user: { id: string } }) {
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return { count };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    await this.notificationsService.markAsRead(id, req.user.id);
    return { success: true };
  }

  @Post('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Request() req: { user: { id: string } }) {
    await this.notificationsService.markAllAsRead(req.user.id);
    return { success: true };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get current user notification preferences' })
  getPreferences(@CurrentUser('id') userId: string) {
    return this.notificationsService.getPreferences(userId);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update current user notification preferences' })
  updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: NotificationPreferenceDto,
  ) {
    return this.notificationsService.updatePreferences(userId, dto);
  }

  @Post('digest/send')
  @ApiOperation({ summary: 'Send a digest email for current user notifications' })
  sendDigest(@CurrentUser('id') userId: string) {
    return this.notificationsService.sendDigestForUser(userId);
  }
}
