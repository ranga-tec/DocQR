import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateDocketTypeDto {
  name: string;
  code: string;
  description?: string;
  slaDays?: number;
  requiresApproval?: boolean;
  isActive?: boolean;
}

export interface UpdateDocketTypeDto {
  name?: string;
  code?: string;
  description?: string;
  slaDays?: number;
  requiresApproval?: boolean;
  isActive?: boolean;
}

@Injectable()
export class DocketTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive = false) {
    return this.prisma.docketType.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const docketType = await this.prisma.docketType.findUnique({ where: { id } });
    if (!docketType) {
      throw new NotFoundException('Docket type not found');
    }
    return docketType;
  }

  async create(dto: CreateDocketTypeDto) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Name is required');
    }
    if (!dto.code?.trim()) {
      throw new BadRequestException('Code is required');
    }

    const normalizedCode = dto.code.trim().toUpperCase();
    const existing = await this.prisma.docketType.findUnique({
      where: { code: normalizedCode },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Docket type code already exists');
    }

    return this.prisma.docketType.create({
      data: {
        name: dto.name.trim(),
        code: normalizedCode,
        description: dto.description?.trim() || null,
        slaDays: dto.slaDays,
        requiresApproval: dto.requiresApproval ?? false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateDocketTypeDto) {
    await this.findOne(id);

    let normalizedCode: string | undefined;
    if (dto.code !== undefined) {
      normalizedCode = dto.code.trim().toUpperCase();
      if (!normalizedCode) {
        throw new BadRequestException('Code cannot be empty');
      }

      const existing = await this.prisma.docketType.findUnique({
        where: { code: normalizedCode },
        select: { id: true },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Docket type code already exists');
      }
    }

    return this.prisma.docketType.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code: normalizedCode,
        description: dto.description?.trim(),
        slaDays: dto.slaDays,
        requiresApproval: dto.requiresApproval,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const linkedCount = await this.prisma.docket.count({
      where: { docketTypeId: id, deletedAt: null },
    });
    if (linkedCount > 0) {
      throw new ConflictException('Cannot delete docket type that is already used by dockets');
    }

    await this.prisma.docketType.delete({ where: { id } });
    return { message: 'Docket type deleted successfully' };
  }
}
