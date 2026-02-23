import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
  attachments?: Array<{
    content: string;
    filename: string;
    type?: string;
    disposition?: string;
  }>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    this.fromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL') || 'noreply@docqr.local';
    this.fromName = this.configService.get<string>('SENDGRID_FROM_NAME') || 'DOCQR System';
    this.enabled = !!apiKey;

    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.logger.log('SendGrid email service initialized');
    } else {
      this.logger.warn('SendGrid API key not configured - emails will be logged only');
    }
  }

  async send(options: EmailOptions): Promise<boolean> {
    if (!this.enabled) {
      this.logger.log(`[DEV MODE] Email would be sent to: ${JSON.stringify(options.to)}`);
      this.logger.debug(`Subject: ${options.subject}`);
      this.logger.debug(`Content: ${options.text || options.html?.substring(0, 200)}`);
      return true;
    }

    try {
      if (options.templateId) {
        // SendGrid dynamic template
        await sgMail.send({
          to: options.to,
          from: { email: this.fromEmail, name: this.fromName },
          templateId: options.templateId,
          dynamicTemplateData: options.dynamicTemplateData,
        });
      } else if (options.html) {
        // HTML email
        await sgMail.send({
          to: options.to,
          from: { email: this.fromEmail, name: this.fromName },
          subject: options.subject,
          html: options.html,
          text: options.text,
        });
      } else {
        // Plain text email
        await sgMail.send({
          to: options.to,
          from: { email: this.fromEmail, name: this.fromName },
          subject: options.subject,
          text: options.text || '',
        });
      }
      this.logger.log(`Email sent successfully to: ${JSON.stringify(options.to)}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${JSON.stringify(options.to)}:`, error);
      throw error;
    }
  }

  async sendTemplate(
    to: string | string[],
    templateId: string,
    data: Record<string, unknown>,
  ): Promise<boolean> {
    return this.send({
      to,
      subject: '', // Subject comes from template
      templateId,
      dynamicTemplateData: data,
    });
  }

  // Pre-built notification templates
  async sendDocketCreated(
    to: string,
    data: {
      recipientName: string;
      docketNumber: string;
      subject: string;
      createdBy: string;
      viewUrl: string;
    },
  ): Promise<boolean> {
    return this.send({
      to,
      subject: `New Docket Created: ${data.docketNumber}`,
      html: `
        <h2>New Docket Notification</h2>
        <p>Hello ${data.recipientName},</p>
        <p>A new docket has been created that requires your attention:</p>
        <ul>
          <li><strong>Docket Number:</strong> ${data.docketNumber}</li>
          <li><strong>Subject:</strong> ${data.subject}</li>
          <li><strong>Created By:</strong> ${data.createdBy}</li>
        </ul>
        <p><a href="${data.viewUrl}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Docket</a></p>
        <p>Best regards,<br>DOCQR System</p>
      `,
      text: `
        New Docket Notification

        Hello ${data.recipientName},

        A new docket has been created that requires your attention:
        - Docket Number: ${data.docketNumber}
        - Subject: ${data.subject}
        - Created By: ${data.createdBy}

        View it here: ${data.viewUrl}

        Best regards,
        DOCQR System
      `,
    });
  }

  async sendDocketForwarded(
    to: string,
    data: {
      recipientName: string;
      docketNumber: string;
      subject: string;
      forwardedBy: string;
      instructions?: string;
      viewUrl: string;
    },
  ): Promise<boolean> {
    return this.send({
      to,
      subject: `Docket Forwarded to You: ${data.docketNumber}`,
      html: `
        <h2>Docket Forwarded</h2>
        <p>Hello ${data.recipientName},</p>
        <p>A docket has been forwarded to you for action:</p>
        <ul>
          <li><strong>Docket Number:</strong> ${data.docketNumber}</li>
          <li><strong>Subject:</strong> ${data.subject}</li>
          <li><strong>Forwarded By:</strong> ${data.forwardedBy}</li>
          ${data.instructions ? `<li><strong>Instructions:</strong> ${data.instructions}</li>` : ''}
        </ul>
        <p><a href="${data.viewUrl}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Docket</a></p>
        <p>Best regards,<br>DOCQR System</p>
      `,
      text: `
        Docket Forwarded

        Hello ${data.recipientName},

        A docket has been forwarded to you for action:
        - Docket Number: ${data.docketNumber}
        - Subject: ${data.subject}
        - Forwarded By: ${data.forwardedBy}
        ${data.instructions ? `- Instructions: ${data.instructions}` : ''}

        View it here: ${data.viewUrl}

        Best regards,
        DOCQR System
      `,
    });
  }

  async sendDocketApproved(
    to: string,
    data: {
      recipientName: string;
      docketNumber: string;
      subject: string;
      approvedBy: string;
      notes?: string;
      viewUrl: string;
    },
  ): Promise<boolean> {
    return this.send({
      to,
      subject: `Docket Approved: ${data.docketNumber}`,
      html: `
        <h2>Docket Approved</h2>
        <p>Hello ${data.recipientName},</p>
        <p>Your docket has been approved:</p>
        <ul>
          <li><strong>Docket Number:</strong> ${data.docketNumber}</li>
          <li><strong>Subject:</strong> ${data.subject}</li>
          <li><strong>Approved By:</strong> ${data.approvedBy}</li>
          ${data.notes ? `<li><strong>Notes:</strong> ${data.notes}</li>` : ''}
        </ul>
        <p><a href="${data.viewUrl}" style="background-color: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Docket</a></p>
        <p>Best regards,<br>DOCQR System</p>
      `,
      text: `
        Docket Approved

        Hello ${data.recipientName},

        Your docket has been approved:
        - Docket Number: ${data.docketNumber}
        - Subject: ${data.subject}
        - Approved By: ${data.approvedBy}
        ${data.notes ? `- Notes: ${data.notes}` : ''}

        View it here: ${data.viewUrl}

        Best regards,
        DOCQR System
      `,
    });
  }

  async sendDocketRejected(
    to: string,
    data: {
      recipientName: string;
      docketNumber: string;
      subject: string;
      rejectedBy: string;
      reason: string;
      viewUrl: string;
    },
  ): Promise<boolean> {
    return this.send({
      to,
      subject: `Docket Rejected: ${data.docketNumber}`,
      html: `
        <h2>Docket Rejected</h2>
        <p>Hello ${data.recipientName},</p>
        <p>Your docket has been rejected:</p>
        <ul>
          <li><strong>Docket Number:</strong> ${data.docketNumber}</li>
          <li><strong>Subject:</strong> ${data.subject}</li>
          <li><strong>Rejected By:</strong> ${data.rejectedBy}</li>
          <li><strong>Reason:</strong> ${data.reason}</li>
        </ul>
        <p><a href="${data.viewUrl}" style="background-color: #EF4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Docket</a></p>
        <p>Best regards,<br>DOCQR System</p>
      `,
      text: `
        Docket Rejected

        Hello ${data.recipientName},

        Your docket has been rejected:
        - Docket Number: ${data.docketNumber}
        - Subject: ${data.subject}
        - Rejected By: ${data.rejectedBy}
        - Reason: ${data.reason}

        View it here: ${data.viewUrl}

        Best regards,
        DOCQR System
      `,
    });
  }
}
