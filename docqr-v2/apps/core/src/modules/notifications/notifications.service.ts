import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './providers/email.service';
import { SmsService } from './providers/sms.service';

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

export interface NotificationPreferenceDto {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  inAppEnabled?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  timeZone?: string;
  deliveryMode?: 'immediate' | 'digest';
  digestFrequency?: 'daily' | 'weekly';
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

    const preferences = await this.getOrCreatePreferences(user.id);
    const recipientName = user.firstName || user.username;
    const adjustedChannels = this.applyPreferencesToChannels(
      payload.channels,
      preferences,
    );

    // In-app is never blocked by quiet-hours; channel can still be disabled by preference.
    if (adjustedChannels.includes(NotificationChannel.IN_APP)) {
      await this.createInAppNotification(user.id, payload, adjustedChannels);
    }

    const externalChannels = adjustedChannels.filter((channel) => channel !== NotificationChannel.IN_APP);
    if (externalChannels.length === 0) {
      return;
    }

    if (preferences.deliveryMode === 'digest') {
      this.logger.log(`Digest mode active for user ${user.id}. External channels deferred.`);
      return;
    }

    if (externalChannels.includes(NotificationChannel.EMAIL)) {
      await this.sendEmailNotification(user.email, recipientName, payload);
    }

    if (externalChannels.includes(NotificationChannel.SMS) && user.phone) {
      await this.sendSmsNotification(user.phone, payload);
    }
  }

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

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async getPreferences(userId: string) {
    return this.getOrCreatePreferences(userId);
  }

  async updatePreferences(userId: string, dto: NotificationPreferenceDto) {
    await this.getOrCreatePreferences(userId);

    return this.prisma.userNotificationPreference.update({
      where: { userId },
      data: {
        emailEnabled: dto.emailEnabled,
        smsEnabled: dto.smsEnabled,
        inAppEnabled: dto.inAppEnabled,
        quietHoursEnabled: dto.quietHoursEnabled,
        quietHoursStart: dto.quietHoursStart,
        quietHoursEnd: dto.quietHoursEnd,
        timeZone: dto.timeZone,
        deliveryMode: dto.deliveryMode,
        digestFrequency: dto.digestFrequency,
      },
    });
  }

  async sendDigestForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const preferences = await this.getOrCreatePreferences(userId);
    if (!preferences.emailEnabled) {
      return { sent: false, reason: 'Email channel disabled in preferences' };
    }

    const recentNotifications = await this.prisma.notification.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (recentNotifications.length === 0) {
      return { sent: false, reason: 'No notifications to include in digest' };
    }

    const recipientName = user.firstName || user.username;
    const listHtml = recentNotifications
      .map(
        (item) =>
          `<li><strong>${item.title}</strong><br /><span>${item.message}</span><br /><small>${item.createdAt.toISOString()}</small></li>`,
      )
      .join('');

    await this.emailService.send({
      to: user.email,
      subject: `DOCQR Notification Digest (${recentNotifications.length} updates)`,
      html: `
        <h2>Notification Digest</h2>
        <p>Hello ${recipientName},</p>
        <p>Here is your latest digest from DOCQR.</p>
        <ul>${listHtml}</ul>
        <p><a href="${this.baseUrl}/settings">Manage your notification preferences</a></p>
      `,
      text: `Notification digest with ${recentNotifications.length} updates. Please log in to DOCQR to review details.`,
    });

    return {
      sent: true,
      count: recentNotifications.length,
    };
  }

  private async getOrCreatePreferences(userId: string) {
    let preference = await this.prisma.userNotificationPreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      preference = await this.prisma.userNotificationPreference.create({
        data: {
          userId,
          emailEnabled: true,
          smsEnabled: false,
          inAppEnabled: true,
          quietHoursEnabled: false,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          timeZone: 'UTC',
          deliveryMode: 'immediate',
          digestFrequency: 'daily',
        },
      });
    }

    return preference;
  }

  private applyPreferencesToChannels(
    channels: NotificationChannel[],
    preferences: {
      emailEnabled: boolean;
      smsEnabled: boolean;
      inAppEnabled: boolean;
      quietHoursEnabled: boolean;
      quietHoursStart: string | null;
      quietHoursEnd: string | null;
      timeZone: string;
    },
  ): NotificationChannel[] {
    const allowed = channels.filter((channel) => {
      if (channel === NotificationChannel.EMAIL && !preferences.emailEnabled) return false;
      if (channel === NotificationChannel.SMS && !preferences.smsEnabled) return false;
      if (channel === NotificationChannel.IN_APP && !preferences.inAppEnabled) return false;
      return true;
    });

    if (!preferences.quietHoursEnabled) {
      return allowed;
    }

    if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return allowed;
    }

    const inQuietHours = this.isWithinQuietHours(
      preferences.quietHoursStart,
      preferences.quietHoursEnd,
      preferences.timeZone || 'UTC',
    );

    if (!inQuietHours) {
      return allowed;
    }

    return allowed.filter((channel) => channel === NotificationChannel.IN_APP);
  }

  private isWithinQuietHours(start: string, end: string, timeZone: string): boolean {
    const currentMinutes = this.getCurrentMinutesInTimeZone(timeZone);
    const startMinutes = this.parseTimeToMinutes(start);
    const endMinutes = this.parseTimeToMinutes(end);

    if (startMinutes === null || endMinutes === null) {
      return false;
    }

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    // Quiet-hours window wraps midnight.
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  private getCurrentMinutesInTimeZone(timeZone: string): number {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone,
    });
    const parts = formatter.formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === 'hour')?.value || '0');
    const minute = Number(parts.find((part) => part.type === 'minute')?.value || '0');
    return (hour * 60) + minute;
  }

  private parseTimeToMinutes(value: string): number | null {
    const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) {
      return null;
    }
    return (Number(match[1]) * 60) + Number(match[2]);
  }

  private async createInAppNotification(
    userId: string,
    payload: NotificationPayload,
    channels: NotificationChannel[],
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
        channels: channels as unknown as Prisma.InputJsonValue,
        isRead: false,
      },
    });
  }

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
          await this.emailService.send({
            to: email,
            subject: this.getNotificationTitle(payload.type),
            text: this.getNotificationMessage(payload),
          });
      }
    } catch (error) {
      this.logger.error(`Failed to send email notification:`, error);
    }
  }

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
