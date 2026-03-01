import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateRegisterDto {
  name: string;
  registerCode: string;
  description?: string;
  departmentId?: string;
  registerType: 'inward' | 'outward' | 'contract' | 'general';
  yearStart?: Date;
  yearEnd?: Date;
}

export interface UpdateRegisterDto {
  name?: string;
  description?: string;
  departmentId?: string;
  registerType?: string;
  yearStart?: Date;
  yearEnd?: Date;
  isActive?: boolean;
}

export interface CreateEntryDto {
  registerId: string;
  entryNumber: string;
  entryDate: Date;
  subject: string;
  fromParty?: string;
  toParty?: string;
  remarks?: string;
  docketId?: string;
}

export interface UpdateEntryDto {
  entryDate?: Date;
  subject?: string;
  fromParty?: string;
  toParty?: string;
  remarks?: string;
  docketId?: string;
}

export interface ListEntriesParams {
  registerId?: string;
  search?: string;
  page?: number;
  limit?: number;
  fromDate?: Date;
  toDate?: Date;
}

export interface ExportEntriesParams {
  registerId?: string;
  search?: string;
  fromDate?: Date;
  toDate?: Date;
}

@Injectable()
export class RegistersService {
  constructor(private readonly prisma: PrismaService) {}

  // =====================
  // Physical Register CRUD
  // =====================

  async createRegister(dto: CreateRegisterDto, userId: string) {
    const existing = await this.prisma.physicalRegister.findUnique({
      where: { registerCode: dto.registerCode },
    });
    if (existing) {
      throw new ConflictException('Register code already exists');
    }

    return this.prisma.physicalRegister.create({
      data: {
        ...dto,
        createdBy: userId,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, username: true, firstName: true, lastName: true } },
        _count: { select: { entries: true } },
      },
    });
  }

  async findAllRegisters(params?: { departmentId?: string; registerType?: string; isActive?: boolean }) {
    const where: Record<string, unknown> = {};

    if (params?.departmentId) {
      where.departmentId = params.departmentId;
    }
    if (params?.registerType) {
      where.registerType = params.registerType;
    }
    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    return this.prisma.physicalRegister.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, username: true, firstName: true, lastName: true } },
        _count: { select: { entries: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneRegister(id: string) {
    const register = await this.prisma.physicalRegister.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, username: true, firstName: true, lastName: true } },
        _count: { select: { entries: true } },
      },
    });
    if (!register) {
      throw new NotFoundException('Register not found');
    }
    return register;
  }

  async updateRegister(id: string, dto: UpdateRegisterDto) {
    const register = await this.prisma.physicalRegister.findUnique({ where: { id } });
    if (!register) {
      throw new NotFoundException('Register not found');
    }

    return this.prisma.physicalRegister.update({
      where: { id },
      data: dto,
      include: {
        department: { select: { id: true, name: true, code: true } },
        _count: { select: { entries: true } },
      },
    });
  }

  async deleteRegister(id: string) {
    const register = await this.prisma.physicalRegister.findUnique({
      where: { id },
      include: { _count: { select: { entries: true } } },
    });
    if (!register) {
      throw new NotFoundException('Register not found');
    }
    if (register._count.entries > 0) {
      throw new ConflictException('Cannot delete register with existing entries');
    }

    await this.prisma.physicalRegister.delete({ where: { id } });
    return { message: 'Register deleted successfully' };
  }

  // =====================
  // Register Entry CRUD
  // =====================

  async createEntry(dto: CreateEntryDto, userId: string) {
    const register = await this.prisma.physicalRegister.findUnique({
      where: { id: dto.registerId },
    });
    if (!register) {
      throw new NotFoundException('Register not found');
    }

    // Check for duplicate entry number in same register
    const existing = await this.prisma.registerEntry.findUnique({
      where: {
        registerId_entryNumber: {
          registerId: dto.registerId,
          entryNumber: dto.entryNumber,
        },
      },
    });
    if (existing) {
      throw new ConflictException('Entry number already exists in this register');
    }

    // Validate docket exists if provided
    if (dto.docketId) {
      const docket = await this.prisma.docket.findUnique({ where: { id: dto.docketId } });
      if (!docket) {
        throw new NotFoundException('Docket not found');
      }
    }

    return this.prisma.registerEntry.create({
      data: {
        ...dto,
        createdBy: userId,
      },
      include: {
        register: { select: { id: true, name: true, registerCode: true } },
        docket: { select: { id: true, docketNumber: true, subject: true, status: true } },
        creator: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
    });
  }

  async findAllEntries(params: ListEntriesParams) {
    const { registerId, search, page = 1, limit = 20, fromDate, toDate } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (registerId) {
      where.registerId = registerId;
    }

    if (search) {
      where.OR = [
        { entryNumber: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { fromParty: { contains: search, mode: 'insensitive' } },
        { toParty: { contains: search, mode: 'insensitive' } },
        { remarks: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (fromDate || toDate) {
      where.entryDate = {};
      if (fromDate) {
        (where.entryDate as Record<string, unknown>).gte = fromDate;
      }
      if (toDate) {
        (where.entryDate as Record<string, unknown>).lte = toDate;
      }
    }

    const [entries, total] = await Promise.all([
      this.prisma.registerEntry.findMany({
        where,
        include: {
          register: { select: { id: true, name: true, registerCode: true } },
          docket: { select: { id: true, docketNumber: true, subject: true, status: true } },
          creator: { select: { id: true, username: true } },
        },
        orderBy: [{ entryDate: 'desc' }, { entryNumber: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.registerEntry.count({ where }),
    ]);

    return {
      data: entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getEntriesForExport(params: ExportEntriesParams) {
    const result = await this.findAllEntries({
      registerId: params.registerId,
      search: params.search,
      fromDate: params.fromDate,
      toDate: params.toDate,
      page: 1,
      limit: 5000,
    });

    return result.data;
  }

  async findOneEntry(id: string) {
    const entry = await this.prisma.registerEntry.findUnique({
      where: { id },
      include: {
        register: { select: { id: true, name: true, registerCode: true, registerType: true } },
        docket: {
          select: {
            id: true,
            docketNumber: true,
            subject: true,
            status: true,
            priority: true,
            createdAt: true,
          },
        },
        creator: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
    });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }
    return entry;
  }

  async updateEntry(id: string, dto: UpdateEntryDto) {
    const entry = await this.prisma.registerEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    // Validate docket exists if provided
    if (dto.docketId) {
      const docket = await this.prisma.docket.findUnique({ where: { id: dto.docketId } });
      if (!docket) {
        throw new NotFoundException('Docket not found');
      }
    }

    return this.prisma.registerEntry.update({
      where: { id },
      data: dto,
      include: {
        register: { select: { id: true, name: true, registerCode: true } },
        docket: { select: { id: true, docketNumber: true, subject: true, status: true } },
      },
    });
  }

  async deleteEntry(id: string) {
    const entry = await this.prisma.registerEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    await this.prisma.registerEntry.delete({ where: { id } });
    return { message: 'Entry deleted successfully' };
  }

  // =====================
  // Linking
  // =====================

  async linkDocket(entryId: string, docketId: string) {
    const entry = await this.prisma.registerEntry.findUnique({ where: { id: entryId } });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    const docket = await this.prisma.docket.findUnique({ where: { id: docketId } });
    if (!docket) {
      throw new NotFoundException('Docket not found');
    }

    return this.prisma.registerEntry.update({
      where: { id: entryId },
      data: { docketId },
      include: {
        docket: { select: { id: true, docketNumber: true, subject: true, status: true } },
      },
    });
  }

  async unlinkDocket(entryId: string) {
    const entry = await this.prisma.registerEntry.findUnique({ where: { id: entryId } });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    return this.prisma.registerEntry.update({
      where: { id: entryId },
      data: { docketId: null },
    });
  }

  // =====================
  // Stats
  // =====================

  async getStats() {
    const [totalRegisters, activeRegisters, totalEntries, recentEntries] = await Promise.all([
      this.prisma.physicalRegister.count(),
      this.prisma.physicalRegister.count({ where: { isActive: true } }),
      this.prisma.registerEntry.count(),
      this.prisma.registerEntry.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const byType = await this.prisma.physicalRegister.groupBy({
      by: ['registerType'],
      _count: true,
    });

    return {
      totalRegisters,
      activeRegisters,
      totalEntries,
      recentEntries,
      byType: byType.reduce((acc, item) => {
        acc[item.registerType] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  // Auto-generate next entry number
  async getNextEntryNumber(registerId: string): Promise<string> {
    const register = await this.prisma.physicalRegister.findUnique({
      where: { id: registerId },
    });
    if (!register) {
      throw new NotFoundException('Register not found');
    }

    const lastEntry = await this.prisma.registerEntry.findFirst({
      where: { registerId },
      orderBy: { entryNumber: 'desc' },
    });

    if (!lastEntry) {
      return '1';
    }

    // Try to parse as number and increment
    const lastNum = parseInt(lastEntry.entryNumber, 10);
    if (!isNaN(lastNum)) {
      return String(lastNum + 1);
    }

    // If not a simple number, just append a counter
    return `${lastEntry.entryNumber}-1`;
  }
}
