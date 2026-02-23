import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService, NotificationPayload } from './notifications.service';

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<NotificationPayload>): Promise<void> {
    this.logger.log(`Processing notification job ${job.id}: ${job.data.type}`);

    try {
      await this.notificationsService.sendNotification(job.data);
      this.logger.log(`Notification job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Notification job ${job.id} failed:`, error);
      throw error; // BullMQ will retry based on job options
    }
  }
}
