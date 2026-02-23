import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

export interface SmsOptions {
  to: string;
  body: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly client: Twilio | null = null;
  private readonly fromNumber: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.configService.get<string>('TWILIO_FROM_NUMBER') || '';
    this.enabled = !!(accountSid && authToken && this.fromNumber);

    if (this.enabled) {
      this.client = new Twilio(accountSid, authToken);
      this.logger.log('Twilio SMS service initialized');
    } else {
      this.logger.warn('Twilio credentials not configured - SMS will be logged only');
    }
  }

  async send(options: SmsOptions): Promise<boolean> {
    // Normalize phone number
    const toNumber = this.normalizePhoneNumber(options.to);

    if (!this.enabled || !this.client) {
      this.logger.log(`[DEV MODE] SMS would be sent to: ${toNumber}`);
      this.logger.debug(`Message: ${options.body}`);
      return true;
    }

    try {
      const message = await this.client.messages.create({
        to: toNumber,
        from: this.fromNumber,
        body: options.body,
      });

      this.logger.log(`SMS sent successfully to ${toNumber}, SID: ${message.sid}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${toNumber}:`, error);
      throw error;
    }
  }

  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Add + if not present and starts with country code
    if (!cleaned.startsWith('+') && cleaned.length > 10) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  // Pre-built SMS templates
  async sendDocketNotification(
    to: string,
    data: {
      docketNumber: string;
      action: string;
      shortUrl?: string;
    },
  ): Promise<boolean> {
    const message = `DOCQR: Docket ${data.docketNumber} ${data.action}. ${data.shortUrl ? `View: ${data.shortUrl}` : ''}`.trim();
    return this.send({ to, body: message });
  }

  async sendDocketForwarded(
    to: string,
    data: {
      docketNumber: string;
      fromUser: string;
    },
  ): Promise<boolean> {
    return this.send({
      to,
      body: `DOCQR: Docket ${data.docketNumber} has been forwarded to you by ${data.fromUser}. Please log in to view.`,
    });
  }

  async sendDocketUrgent(
    to: string,
    data: {
      docketNumber: string;
      subject: string;
    },
  ): Promise<boolean> {
    return this.send({
      to,
      body: `URGENT - DOCQR: Docket ${data.docketNumber} requires immediate attention. Subject: ${data.subject}`,
    });
  }

  async sendSlaWarning(
    to: string,
    data: {
      docketNumber: string;
      hoursRemaining: number;
    },
  ): Promise<boolean> {
    return this.send({
      to,
      body: `DOCQR SLA Warning: Docket ${data.docketNumber} has ${data.hoursRemaining}h remaining before deadline. Please take action.`,
    });
  }
}
