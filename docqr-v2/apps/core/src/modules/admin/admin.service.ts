import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AuditLogFilter {
  userId?: string;
  action?: string;
  resourceType?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [totalDockets, openDockets, closedDockets, archivedDockets] = await Promise.all([
      this.prisma.docket.count({ where: { deletedAt: null } }),
      this.prisma.docket.count({
        where: {
          deletedAt: null,
          status: { in: ['open', 'in_review', 'forwarded', 'pending_approval'] },
        },
      }),
      this.prisma.docket.count({
        where: {
          deletedAt: null,
          status: 'closed',
        },
      }),
      this.prisma.docket.count({
        where: {
          deletedAt: null,
          status: 'archived',
        },
      }),
    ]);

    const [statusBreakdown, typeBreakdown, departmentBreakdown] = await Promise.all([
      this.prisma.docket.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: true,
      }),
      this.prisma.docket.groupBy({
        by: ['docketTypeId'],
        where: { deletedAt: null },
        _count: true,
      }),
      this.prisma.docket.groupBy({
        by: ['currentDepartmentId'],
        where: { deletedAt: null },
        _count: true,
      }),
    ]);

    const docketTypes = await this.prisma.docketType.findMany({
      select: { id: true, name: true },
    });
    const departments = await this.prisma.department.findMany({
      select: { id: true, name: true, code: true },
    });

    const typeMap = new Map(docketTypes.map((type) => [type.id, type.name]));
    const departmentMap = new Map(departments.map((dept) => [dept.id, `${dept.name} (${dept.code})`]));

    return {
      totals: {
        totalDockets,
        openDockets,
        closedDockets,
        archivedDockets,
      },
      byStatus: statusBreakdown.map((item) => ({
        status: item.status,
        count: item._count,
      })),
      byType: typeBreakdown.map((item) => ({
        docketTypeId: item.docketTypeId,
        typeName: item.docketTypeId ? typeMap.get(item.docketTypeId) || 'Unknown' : 'Uncategorized',
        count: item._count,
      })),
      byDepartment: departmentBreakdown.map((item) => ({
        departmentId: item.currentDepartmentId,
        departmentName: item.currentDepartmentId
          ? departmentMap.get(item.currentDepartmentId) || 'Unknown'
          : 'Unassigned',
        count: item._count,
      })),
    };
  }

  async getAuditLogs(filters: AuditLogFilter) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));

    const where: Record<string, unknown> = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.search) {
      where.OR = [
        { resourceId: { contains: filters.search, mode: 'insensitive' } },
        { requestPath: { contains: filters.search, mode: 'insensitive' } },
        { details: { path: ['message'], string_contains: filters.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSlaReport() {
    const [onTrack, atRisk, overdue] = await Promise.all([
      this.prisma.docket.count({ where: { deletedAt: null, slaStatus: 'on_track' } }),
      this.prisma.docket.count({ where: { deletedAt: null, slaStatus: 'at_risk' } }),
      this.prisma.docket.count({ where: { deletedAt: null, slaStatus: 'overdue' } }),
    ]);

    const overdueItems = await this.prisma.docket.findMany({
      where: {
        deletedAt: null,
        OR: [
          { slaStatus: 'overdue' },
          {
            dueDate: {
              lt: new Date(),
            },
            status: { notIn: ['closed', 'archived'] },
          },
        ],
      },
      select: {
        id: true,
        docketNumber: true,
        subject: true,
        dueDate: true,
        status: true,
        currentAssignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 50,
    });

    return {
      summary: {
        onTrack,
        atRisk,
        overdue,
      },
      overdueItems,
    };
  }

  async getWorkloadReport() {
    const byUser = await this.prisma.docket.groupBy({
      by: ['currentAssigneeId'],
      where: {
        deletedAt: null,
        status: { in: ['open', 'in_review', 'forwarded', 'pending_approval', 'approved', 'rejected'] },
        currentAssigneeId: { not: null },
      },
      _count: true,
    });

    const byDepartment = await this.prisma.docket.groupBy({
      by: ['currentDepartmentId'],
      where: {
        deletedAt: null,
        status: { in: ['open', 'in_review', 'forwarded', 'pending_approval', 'approved', 'rejected'] },
        currentDepartmentId: { not: null },
      },
      _count: true,
    });

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: byUser.map((item) => item.currentAssigneeId!).filter(Boolean) },
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
      },
    });

    const departments = await this.prisma.department.findMany({
      where: {
        id: { in: byDepartment.map((item) => item.currentDepartmentId!).filter(Boolean) },
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    const userMap = new Map(users.map((user) => [user.id, user]));
    const departmentMap = new Map(departments.map((dept) => [dept.id, dept]));

    return {
      byUser: byUser.map((item) => {
        const user = item.currentAssigneeId ? userMap.get(item.currentAssigneeId) : null;
        return {
          userId: item.currentAssigneeId,
          userName: user
            ? (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.username)
            : 'Unassigned',
          docketCount: item._count,
        };
      }),
      byDepartment: byDepartment.map((item) => {
        const dept = item.currentDepartmentId ? departmentMap.get(item.currentDepartmentId) : null;
        return {
          departmentId: item.currentDepartmentId,
          departmentName: dept ? `${dept.name} (${dept.code})` : 'Unassigned',
          docketCount: item._count,
        };
      }),
    };
  }

  async getTurnaroundReport() {
    const closed = await this.prisma.docket.findMany({
      where: {
        deletedAt: null,
        status: { in: ['closed', 'archived'] },
        closedAt: { not: null },
      },
      select: {
        id: true,
        docketNumber: true,
        subject: true,
        createdAt: true,
        closedAt: true,
        docketType: {
          select: { id: true, name: true },
        },
      },
      take: 1000,
      orderBy: { closedAt: 'desc' },
    });

    const durations = closed
      .filter((item) => item.closedAt)
      .map((item) => {
        const turnaroundHours = (item.closedAt!.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60);
        return {
          ...item,
          turnaroundHours,
        };
      });

    const averageTurnaroundHours = durations.length > 0
      ? durations.reduce((sum, item) => sum + item.turnaroundHours, 0) / durations.length
      : 0;

    return {
      summary: {
        sampleSize: durations.length,
        averageTurnaroundHours,
      },
      items: durations.slice(0, 100),
    };
  }
}
