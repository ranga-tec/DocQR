import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QrCodeService } from './qrcode.service';
import { StorageService } from './storage.service';
import { WorkflowService, TransitionData } from './workflow.service';
import { DocketStatus, WorkflowAction, DocketFilterParams } from '@docqr/shared';

export interface CreateDocketDto {
  subject: string;
  description?: string;
  docketTypeId?: string;
  priority?: string;
  confidentiality?: string;
  assignToUserId?: string;
  assignToDepartmentId?: string;
  registerEntryId?: string;
  dueDate?: Date;
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface UpdateDocketDto {
  subject?: string;
  description?: string;
  docketTypeId?: string;
  priority?: string;
  confidentiality?: string;
  dueDate?: Date;
  tags?: string[];
  customFields?: Record<string, any>;
}

@Injectable()
export class DocketsService {
  private readonly logger = new Logger(DocketsService.name);
  private docketCounter = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly qrCodeService: QrCodeService,
    private readonly storageService: StorageService,
    private readonly workflowService: WorkflowService,
  ) {}

  /**
   * Generate a unique docket number
   */
  private async generateDocketNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.docket.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
    });

    const sequence = String(count + 1).padStart(6, '0');
    return `DOC/${year}/${sequence}`;
  }

  /**
   * Create a new docket
   */
  async create(dto: CreateDocketDto, userId: string) {
    const docketNumber = await this.generateDocketNumber();
    const qrToken = this.qrCodeService.generateSecureToken();

    // Generate QR code
    const qrResult = await this.qrCodeService.generateQrCode('temp', qrToken);

    // Create docket in transaction
    const docket = await this.prisma.$transaction(async (tx) => {
      // Create docket
      const newDocket = await tx.docket.create({
        data: {
          docketNumber,
          qrToken,
          subject: dto.subject,
          description: dto.description,
          docketTypeId: dto.docketTypeId,
          priority: dto.priority || 'normal',
          confidentiality: dto.confidentiality || 'internal',
          currentAssigneeId: dto.assignToUserId,
          currentDepartmentId: dto.assignToDepartmentId,
          registerEntryId: dto.registerEntryId,
          dueDate: dto.dueDate,
          tags: dto.tags || [],
          customFields: dto.customFields || {},
          createdBy: userId,
          updatedBy: userId,
          status: DocketStatus.OPEN,
        },
      });

      // Upload QR code to storage
      const qrKey = `${newDocket.id}.png`;
      await this.storageService.uploadFile(
        this.storageService.getQrCodesBucket(),
        qrKey,
        qrResult.buffer,
        'image/png',
      );

      // Update docket with QR code path
      await tx.docket.update({
        where: { id: newDocket.id },
        data: { qrCodePath: qrKey },
      });

      // Create initial assignment if assigned
      if (dto.assignToUserId || dto.assignToDepartmentId) {
        await tx.docketAssignment.create({
          data: {
            docketId: newDocket.id,
            assignedToUserId: dto.assignToUserId,
            assignedToDepartmentId: dto.assignToDepartmentId,
            assignedByUserId: userId,
            sequenceNumber: 1,
            assignmentType: 'initial',
            status: 'pending',
          },
        });
      }

      return newDocket;
    });

    this.logger.log(`Docket created: ${docketNumber}`);

    return this.findOne(docket.id);
  }

  /**
   * Find all dockets with filters
   */
  async findAll(params: DocketFilterParams, userId: string, userRoles: string[]) {
    const {
      search,
      status,
      priority,
      docketTypeId,
      assigneeId,
      departmentId,
      createdById,
      dateFrom,
      dateTo,
      slaStatus,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: any = { deletedAt: null };

    // Search
    if (search) {
      where.OR = [
        { docketNumber: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Status filter
    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }

    // Priority filter
    if (priority) {
      where.priority = Array.isArray(priority) ? { in: priority } : priority;
    }

    // Other filters
    if (docketTypeId) where.docketTypeId = docketTypeId;
    if (assigneeId) where.currentAssigneeId = assigneeId;
    if (departmentId) where.currentDepartmentId = departmentId;
    if (createdById) where.createdBy = createdById;
    if (slaStatus) where.slaStatus = slaStatus;

    // Date range
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    // Role-based filtering (non-admin users only see their dockets)
    if (!userRoles.includes('admin')) {
      where.OR = [
        { createdBy: userId },
        { currentAssigneeId: userId },
        { assignments: { some: { assignedToUserId: userId } } },
      ];
    }

    const [dockets, total] = await Promise.all([
      this.prisma.docket.findMany({
        where,
        include: {
          docketType: true,
          currentAssignee: { select: { id: true, username: true, email: true } },
          currentDepartment: { select: { id: true, name: true, code: true } },
          creator: { select: { id: true, username: true } },
          _count: { select: { attachments: true, comments: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.docket.count({ where }),
    ]);

    return {
      data: dockets,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find docket by ID
   */
  async findOne(id: string) {
    const docket = await this.prisma.docket.findUnique({
      where: { id },
      include: {
        docketType: true,
        currentAssignee: { select: { id: true, username: true, email: true, firstName: true, lastName: true } },
        currentDepartment: { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, username: true, email: true } },
        updater: { select: { id: true, username: true } },
        closer: { select: { id: true, username: true } },
        attachments: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: 'desc' },
        },
        comments: {
          include: {
            author: { select: { id: true, username: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        assignments: {
          include: {
            assignedToUser: { select: { id: true, username: true } },
            assignedToDepartment: { select: { id: true, name: true } },
            assignedByUser: { select: { id: true, username: true } },
          },
          orderBy: { sequenceNumber: 'asc' },
        },
        registerEntries: true,
      },
    });

    if (!docket || docket.deletedAt) {
      throw new NotFoundException('Docket not found');
    }

    return docket;
  }

  /**
   * Find docket by QR token
   */
  async findByQrToken(token: string) {
    const docket = await this.prisma.docket.findUnique({
      where: { qrToken: token },
      include: {
        docketType: true,
        currentAssignee: { select: { id: true, username: true } },
        currentDepartment: { select: { id: true, name: true } },
        attachments: {
          where: { deletedAt: null, isPrimary: true },
          take: 1,
        },
      },
    });

    if (!docket || docket.deletedAt) {
      throw new NotFoundException('Docket not found');
    }

    return docket;
  }

  /**
   * Update docket
   */
  async update(id: string, dto: UpdateDocketDto, userId: string) {
    const docket = await this.prisma.docket.findUnique({ where: { id } });
    if (!docket || docket.deletedAt) {
      throw new NotFoundException('Docket not found');
    }

    await this.prisma.docket.update({
      where: { id },
      data: {
        ...dto,
        updatedBy: userId,
      },
    });

    return this.findOne(id);
  }

  /**
   * Soft delete docket
   */
  async remove(id: string) {
    const docket = await this.prisma.docket.findUnique({ where: { id } });
    if (!docket) {
      throw new NotFoundException('Docket not found');
    }

    await this.prisma.docket.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Docket deleted successfully' };
  }

  /**
   * Execute workflow action
   */
  async executeAction(
    id: string,
    action: WorkflowAction,
    userId: string,
    userRoles: string[],
    data?: TransitionData,
  ) {
    return this.workflowService.executeTransition(id, action, userId, userRoles, data);
  }

  /**
   * Get workflow history
   */
  async getWorkflowHistory(id: string) {
    return this.workflowService.getWorkflowHistory(id);
  }

  /**
   * Get allowed actions for docket
   */
  async getAllowedActions(id: string, userRoles: string[]) {
    const docket = await this.prisma.docket.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!docket) {
      throw new NotFoundException('Docket not found');
    }

    return this.workflowService.getAllowedActions(
      docket.status as DocketStatus,
      userRoles,
    );
  }

  /**
   * Get QR code for docket
   */
  async getQrCode(id: string): Promise<Buffer> {
    const docket = await this.prisma.docket.findUnique({
      where: { id },
      select: { qrCodePath: true },
    });

    if (!docket || !docket.qrCodePath) {
      throw new NotFoundException('QR code not found');
    }

    return this.storageService.getFileBuffer(
      this.storageService.getQrCodesBucket(),
      docket.qrCodePath,
    );
  }

  /**
   * Regenerate QR code
   */
  async regenerateQrCode(id: string, userId: string) {
    const docket = await this.prisma.docket.findUnique({ where: { id } });
    if (!docket) {
      throw new NotFoundException('Docket not found');
    }

    // Generate new QR code
    const qrResult = await this.qrCodeService.regenerateQrCode(id);

    // Delete old QR code if exists
    if (docket.qrCodePath) {
      try {
        await this.storageService.deleteFile(
          this.storageService.getQrCodesBucket(),
          docket.qrCodePath,
        );
      } catch {
        // Ignore delete errors
      }
    }

    // Upload new QR code
    const qrKey = `${id}.png`;
    await this.storageService.uploadFile(
      this.storageService.getQrCodesBucket(),
      qrKey,
      qrResult.buffer,
      'image/png',
    );

    // Update docket
    await this.prisma.docket.update({
      where: { id },
      data: {
        qrToken: qrResult.token,
        qrCodePath: qrKey,
        updatedBy: userId,
      },
    });

    return { message: 'QR code regenerated successfully', token: qrResult.token };
  }
}
