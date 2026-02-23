import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './providers/email.service';
import { SmsService } from './providers/sms.service';
import { ConfigService } from '@nestjs/config';

export enum NotificationType {
  DOCKET_CREATED = 'DOCKET_CREATED',
  DOCKET_FORWARDED = 'DOCKET_FORWARDED',
  DOCKET_APPROVED = 'DOCKET_APPROVED',
  DOCKET_REJECTED = 'DOCKET_REJECTED',
  DOCKET_CLOSED = 'DOCKET_CLOSED',
  DOCKET_COMMENT = 'DOCKET_COMMENT',
  DOCKET_ATTACHMENT = 'DOCKET_ATTACHMENT',
  SLA_WARNING = 'SLA_WARNING',
  SLA_BREACH = 'SLA_BREACH',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  IN_APP = 'IN_APP',
}

export interface NotificationPayload {
  type: NotificationType;
  userId: string;
  docketId?: string;
  channels: NotificationChannel[];
  data: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly configService: ConfigService,
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
  ) {
    this.baseUrl = this.configService.get<string>('APP_URL') || 'http://localhost:5173';
  }

  /**
   * Queue a notification for async processing
   */
  async queueNotification(payload: NotificationPayload): Promise<void> {
    await this.notificationQueue.add('send', payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    this.logger.log(`Notification queued: ${payload.type} for user ${payload.userId}`);
  }

  /**
   * Process and send notification immediately
   */
  async sendNotification(payload: NotificationPayload): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        phone: true,
      },
    });

    if (!user) {
      this.logger.warn(`User not found for notification: ${payload.userId}`);
      return;
    }

    const recipientName = user.firstName || user.username;

    // Create in-app notification record
    if (payload.channels.includes(NotificationChannel.IN_APP)) {
      await this.createInAppNotification(user.id, payload);
    }

    // Send email notification
    if (payload.channels.includes(NotificationChannel.EMAIL)) {
      await this.sendEmailNotification(user.email, recipientName, payload);
    }

    // Send SMS notification
    if (payload.channels.includes(NotificationChannel.SMS) && user.phone) {
      await this.sendSmsNotification(user.phone, payload);
    }
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(
    userId: string,
    payload: NotificationPayload,
  ): Promise<void> {
    const title = this.getNotificationTitle(payload.type);
    const message = this.getNotificationMessage(payload);
    const actionUrl = payload.docketId
      ? `${this.baseUrl}/dockets/${payload.docketId}`
      : this.baseUrl;

    await this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        resourceType: payload.docketId ? 'docket' : undefined,
        resourceId: payload.docketId,
        actionUrl,
        channels: JSON.stringify(payload.channels),
        isRead: false,
      },
    });

    this.logger.log(`In-app notification created for user ${userId}`);
  }

  /**
   * Send email notification based on type
   */
  private async sendEmailNotification(
    email: string,
    recipientName: string,
    payload: NotificationPayload,
  ): Promise<void> {
    const data = payload.data as Record<string, string>;
    const viewUrl = payload.docketId
      ? `${this.baseUrl}/dockets/${payload.docketId}`
      : this.baseUrl;

    try {
      switch (payload.type) {
        case NotificationType.DOCKET_CREATED:
          await this.emailService.sendDocketCreated(email, {
            recipientName,
            docketNumber: data.docketNumber,
            subject: data.subject,
            createdBy: data.createdBy,
            viewUrl,
          });
          break;

        case NotificationType.DOCKET_FORWARDED:
          await this.emailService.sendDocketForwarded(email, {
            recipientName,
            docketNumber: data.docketNumber,
            subject: data.subject,
            forwardedBy: data.forwardedBy,
            instructions: data.instructions,
            viewUrl,
          });
          break;

        case NotificationType.DOCKET_APPROVED:
          await this.emailService.sendDocketApproved(email, {
            recipientName,
            docketNumber: data.docketNumber,
            subject: data.subject,
            approvedBy: data.approvedBy,
            notes: data.notes,
            viewUrl,
          });
          break;

        case NotificationType.DOCKET_REJECTED:
          await this.emailService.sendDocketRejected(email, {
            recipientName,
            docketNumber: data.docketNumber,
            subject: data.subject,
            rejectedBy: data.rejectedBy,
            reason: data.reason,
            viewUrl,
          });
          break;

        default:
          this.logger.debug(`No email template for type: ${payload.type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send email notification:`, error);
    }
  }

  /**
   * Send SMS notification based on type
   */
  private async sendSmsNotification(
    phone: string,
    payload: NotificationPayload,
  ): Promise<void> {
    const data = payload.data as Record<string, string>;

    try {
      switch (payload.type) {
        case NotificationType.DOCKET_FORWARDED:
          await this.smsService.sendDocketForwarded(phone, {
            docketNumber: data.docketNumber,
            fromUser: data.forwardedBy,
          });
          break;

        case NotificationType.SLA_WARNING:
          await this.smsService.sendSlaWarning(phone, {
            docketNumber: data.docketNumber,
            hoursRemaining: parseInt(data.hoursRemaining) || 24,
          });
          break;

        default:
          await this.smsService.sendDocketNotification(phone, {
            docketNumber: data.docketNumber,
            action: this.getActionText(payload.type),
          });
      }
    } catch (error) {
      this.logger.error(`Failed to send SMS notification:`, error);
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {},
  ) {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    const where = {
      userId,
      ...(unreadOnly && { isRead: false }),
    };

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      total,
      unreadCount: await this.getUnreadCount(userId),
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Helper: Get notification title based on type
   */
  private getNotificationTitle(type: NotificationType): string {
    const titles: Record<NotificationType, string> = {
      [NotificationType.DOCKET_CREATED]: 'New Docket Created',
      [NotificationType.DOCKET_FORWARDED]: 'Docket Forwarded',
      [NotificationType.DOCKET_APPROVED]: 'Docket Approved',
      [NotificationType.DOCKET_REJECTED]: 'Docket Rejected',
      [NotificationType.DOCKET_CLOSED]: 'Docket Closed',
      [NotificationType.DOCKET_COMMENT]: 'New Comment',
      [NotificationType.DOCKET_ATTACHMENT]: 'New Attachment',
      [NotificationType.SLA_WARNING]: 'SLA Warning',
      [NotificationType.SLA_BREACH]: 'SLA Breach',
    };
    return titles[type] || 'Notification';
  }

  /**
   * Helper: Get notification message
   */
  private getNotificationMessage(payload: NotificationPayload): string {
    const data = payload.data as Record<string, string>;
    const docketRef = data.docketNumber ? `Docket ${data.docketNumber}` : 'A docket';

    const messages: Record<NotificationType, string> = {
      [NotificationType.DOCKET_CREATED]: `${docketRef} has been created and assigned to you.`,
      [NotificationType.DOCKET_FORWARDED]: `${docketRef} has been forwarded to you by ${data.forwardedBy || 'someone'}.`,
      [NotificationType.DOCKET_APPROVED]: `${docketRef} has been approved by ${data.approvedBy || 'someone'}.`,
      [NotificationType.DOCKET_REJECTED]: `${docketRef} has been rejected. Reason: ${data.reason || 'Not specified'}.`,
      [NotificationType.DOCKET_CLOSED]: `${docketRef} has been closed.`,
      [NotificationType.DOCKET_COMMENT]: `A new comment was added to ${docketRef}.`,
      [NotificationType.DOCKET_ATTACHMENT]: `A new attachment was added to ${docketRef}.`,
      [NotificationType.SLA_WARNING]: `${docketRef} is approaching its SLA deadline.`,
      [NotificationType.SLA_BREACH]: `${docketRef} has breached its SLA deadline.`,
    };

    return messages[payload.type] || 'You have a new notification.';
  }

  /**
   * Helper: Get action text for SMS
   */
  private getActionText(type: NotificationType): string {
    const actions: Record<NotificationType, string> = {
      [NotificationType.DOCKET_CREATED]: 'was created',
      [NotificationType.DOCKET_FORWARDED]: 'was forwarded to you',
      [NotificationType.DOCKET_APPROVED]: 'was approved',
      [NotificationType.DOCKET_REJECTED]: 'was rejected',
      [NotificationType.DOCKET_CLOSED]: 'was closed',
      [NotificationType.DOCKET_COMMENT]: 'has a new comment',
      [NotificationType.DOCKET_ATTACHMENT]: 'has a new attachment',
      [NotificationType.SLA_WARNING]: 'SLA warning',
      [NotificationType.SLA_BREACH]: 'SLA breached',
    };
    return actions[type] || 'updated';
  }
}
