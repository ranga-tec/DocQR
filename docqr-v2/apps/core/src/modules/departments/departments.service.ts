import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateDepartmentDto {
  name: string;
  code: string;
  description?: string;
  parentId?: string;
  headUserId?: string;
}

export interface UpdateDepartmentDto {
  name?: string;
  description?: string;
  parentId?: string;
  headUserId?: string;
  isActive?: boolean;
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException('Department code already exists');
    }

    return this.prisma.department.create({
      data: dto,
      include: {
        parent: true,
        headUser: { select: { id: true, email: true, username: true } },
      },
    });
  }

  async findAll() {
    return this.prisma.department.findMany({
      include: {
        parent: true,
        headUser: { select: { id: true, email: true, username: true } },
        _count: { select: { userDepartments: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        headUser: { select: { id: true, email: true, username: true } },
        userDepartments: {
          include: { user: { select: { id: true, email: true, username: true } } },
        },
      },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return department;
  }

  async getHierarchy() {
    const departments = await this.prisma.department.findMany({
      where: { isActive: true },
      include: {
        headUser: { select: { id: true, username: true } },
        _count: { select: { userDepartments: true } },
      },
    });

    // Build tree structure
    const buildTree = (parentId: string | null): any[] => {
      return departments
        .filter((d) => d.parentId === parentId)
        .map((d) => ({
          ...d,
          children: buildTree(d.id),
        }));
    };

    return buildTree(null);
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Prevent circular parent reference
    if (dto.parentId === id) {
      throw new ConflictException('Department cannot be its own parent');
    }

    return this.prisma.department.update({
      where: { id },
      data: dto,
      include: {
        parent: true,
        headUser: { select: { id: true, email: true, username: true } },
      },
    });
  }

  async remove(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { children: true },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    if (department.children.length > 0) {
      throw new ConflictException('Cannot delete department with sub-departments');
    }

    await this.prisma.department.delete({ where: { id } });
    return { message: 'Department deleted successfully' };
  }

  async getDepartmentUsers(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) {
      throw new NotFoundException('Department not found');
    }

    const users = await this.prisma.userDepartment.findMany({
      where: { departmentId: id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
      },
    });

    return users.map((ud) => ({
      ...ud.user,
      isPrimary: ud.isPrimary,
    }));
  }
}
