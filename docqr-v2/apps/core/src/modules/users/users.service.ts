import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateUserDto {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  roleIds?: string[];
  departmentIds?: string[];
}

export interface UpdateUserDto {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  isActive?: boolean;
  roleIds?: string[];
  departmentIds?: string[];
}

export interface UserFilterParams {
  search?: string;
  roleId?: string;
  departmentId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    // Check uniqueness
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        userRoles: dto.roleIds
          ? {
              create: dto.roleIds.map((roleId) => ({ roleId })),
            }
          : undefined,
        userDepartments: dto.departmentIds
          ? {
              create: dto.departmentIds.map((departmentId, index) => ({
                departmentId,
                isPrimary: index === 0,
              })),
            }
          : undefined,
      },
      include: {
        userRoles: { include: { role: true } },
        userDepartments: { include: { department: true } },
      },
    });

    this.logger.log(`User created: ${user.email}`);
    return this.formatUser(user);
  }

  async findAll(params: UserFilterParams) {
    const {
      search,
      roleId,
      departmentId,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (roleId) {
      where.userRoles = { some: { roleId } };
    }

    if (departmentId) {
      where.userDepartments = { some: { departmentId } };
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          userRoles: { include: { role: true } },
          userDepartments: { include: { department: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => this.formatUser(u)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: { include: { role: true } },
        userDepartments: { include: { department: true } },
      },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    return this.formatUser(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });
      if (existingEmail && existingEmail.id !== id) {
        throw new ConflictException('Email already exists');
      }
    }

    // Update basic info
    await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        avatar: dto.avatar,
        isActive: dto.isActive,
      },
    });

    // Update roles if provided
    if (dto.roleIds !== undefined) {
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      if (dto.roleIds.length > 0) {
        await this.prisma.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
        });
      }
    }

    // Update departments if provided
    if (dto.departmentIds !== undefined) {
      await this.prisma.userDepartment.deleteMany({ where: { userId: id } });
      if (dto.departmentIds.length > 0) {
        await this.prisma.userDepartment.createMany({
          data: dto.departmentIds.map((departmentId, index) => ({
            userId: id,
            departmentId,
            isPrimary: index === 0,
          })),
        });
      }
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`User soft deleted: ${user.email}`);
    return { message: 'User deleted successfully' };
  }

  private formatUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.userRoles?.map((ur: any) => ({
        id: ur.role.id,
        name: ur.role.name,
        displayName: ur.role.displayName,
      })) || [],
      departments: user.userDepartments?.map((ud: any) => ({
        id: ud.department.id,
        name: ud.department.name,
        code: ud.department.code,
        isPrimary: ud.isPrimary,
      })) || [],
    };
  }
}
