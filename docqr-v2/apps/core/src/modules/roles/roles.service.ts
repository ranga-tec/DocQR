import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateRoleDto {
  name: string;
  displayName: string;
  description?: string;
  permissions: string[];
}

export interface UpdateRoleDto {
  displayName?: string;
  description?: string;
  permissions?: string[];
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Role already exists');
    }

    return this.prisma.role.create({
      data: {
        name: dto.name,
        displayName: dto.displayName,
        description: dto.description,
        permissions: dto.permissions,
      },
    });
  }

  async findAll() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: { user: { select: { id: true, email: true, username: true } } },
        },
      },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role.isSystemRole && dto.permissions) {
      throw new ConflictException('Cannot modify permissions of system roles');
    }

    return this.prisma.role.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role.isSystemRole) {
      throw new ConflictException('Cannot delete system roles');
    }

    await this.prisma.role.delete({ where: { id } });
    return { message: 'Role deleted successfully' };
  }

  async getAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { resourceType: 'asc' },
    });
  }
}
