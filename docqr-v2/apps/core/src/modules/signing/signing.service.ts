import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NoopSigningProvider } from './providers/noop-signing.provider';
import { SigningProvider } from './providers/signing-provider.interface';

export interface CreateSigningRequestDto {
  docketId: string;
  attachmentId: string;
  provider?: 'signex' | 'stellasign' | 'placeholder';
  signers: Array<{
    userId: string;
    order: number;
    role?: string;
  }>;
  expiresAt?: string;
}

@Injectable()
export class SigningService {
  private readonly logger = new Logger(SigningService.name);
  private readonly providers: SigningProvider[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly noopProvider: NoopSigningProvider,
  ) {
    this.providers = [this.noopProvider];
  }

  getProviders() {
    return this.providers.map((provider) => ({
      code: provider.code,
      name: provider.name,
      configured: provider.isConfigured(),
    }));
  }

  async createRequest(dto: CreateSigningRequestDto, userId: string) {
    if (!dto.signers || dto.signers.length === 0) {
      throw new BadRequestException('At least one signer is required');
    }

    const docket = await this.prisma.docket.findUnique({
      where: { id: dto.docketId },
      select: { id: true, docketNumber: true },
    });
    if (!docket) {
      throw new NotFoundException('Docket not found');
    }

    const attachment = await this.prisma.docketAttachment.findFirst({
      where: {
        id: dto.attachmentId,
        docketId: dto.docketId,
        deletedAt: null,
      },
      select: {
        id: true,
        originalFileName: true,
      },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found for the specified docket');
    }

    const providerCode = dto.provider || 'placeholder';

    const request = await this.prisma.signingRequest.create({
      data: {
        docketId: dto.docketId,
        attachmentId: dto.attachmentId,
        signingProvider: providerCode,
        signers: dto.signers,
        status: 'pending',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdBy: userId,
      },
    });

    return {
      ...request,
      message: 'Signing request created in placeholder mode. Configure a third-party provider to dispatch.',
    };
  }

  async getRequest(id: string) {
    const request = await this.prisma.signingRequest.findUnique({
      where: { id },
      include: {
        docket: {
          select: {
            id: true,
            docketNumber: true,
            subject: true,
            status: true,
          },
        },
        attachment: {
          select: {
            id: true,
            originalFileName: true,
            mimeType: true,
          },
        },
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        signatures: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Signing request not found');
    }

    return request;
  }

  async dispatchRequest(id: string) {
    const request = await this.prisma.signingRequest.findUnique({
      where: { id },
      include: {
        docket: {
          select: { docketNumber: true },
        },
        attachment: {
          select: { originalFileName: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Signing request not found');
    }

    const provider = this.providers.find((p) => p.code === request.signingProvider) || this.noopProvider;

    const result = await provider.dispatchRequest({
      docketNumber: request.docket.docketNumber,
      attachmentName: request.attachment.originalFileName,
      signers: request.signers as Array<{ userId: string; order: number; role?: string }>,
      expiresAt: request.expiresAt || undefined,
    });

    if (result.accepted) {
      await this.prisma.signingRequest.update({
        where: { id },
        data: {
          status: 'in_progress',
          externalRequestId: result.externalRequestId || null,
        },
      });
    }

    this.logger.log(`Signing dispatch attempt for request ${id}: ${result.message}`);

    return {
      requestId: id,
      provider: provider.code,
      ...result,
    };
  }
}
