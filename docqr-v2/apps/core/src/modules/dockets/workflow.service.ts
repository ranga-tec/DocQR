import { Injectable, BadRequestException, ForbiddenException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DocketStatus,
  WorkflowAction,
  WORKFLOW_TRANSITIONS,
} from '@docqr/shared';
import { NotificationsService, NotificationType, NotificationChannel } from '../notifications/notifications.service';

export interface TransitionData {
  toUserId?: string;
  toDepartmentId?: string;
  instructions?: string;
  reason?: string;
  notes?: string;
}

export interface TransitionResult {
  success: boolean;
  newStatus: DocketStatus;
  message: string;
}

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Check if an action is valid for the current status
   */
  isActionValid(currentStatus: DocketStatus, action: WorkflowAction): boolean {
    const allowedActions = WORKFLOW_TRANSITIONS[currentStatus];
    return allowedActions?.includes(action) || false;
  }

  /**
   * Get the next status after an action
   */
  getNextStatus(currentStatus: DocketStatus, action: WorkflowAction): DocketStatus | null {
    const statusTransitions: Record<string, Partial<Record<WorkflowAction, DocketStatus>>> = {
      [DocketStatus.OPEN]: {
        [WorkflowAction.START_REVIEW]: DocketStatus.IN_REVIEW,
        [WorkflowAction.FORWARD]: DocketStatus.FORWARDED,
        [WorkflowAction.CLOSE]: DocketStatus.CLOSED,
      },
      [DocketStatus.IN_REVIEW]: {
        [WorkflowAction.FORWARD]: DocketStatus.FORWARDED,
        [WorkflowAction.SUBMIT_FOR_APPROVAL]: DocketStatus.PENDING_APPROVAL,
        [WorkflowAction.APPROVE]: DocketStatus.APPROVED,
        [WorkflowAction.REJECT]: DocketStatus.REJECTED,
        [WorkflowAction.RETURN]: DocketStatus.OPEN,
      },
      [DocketStatus.FORWARDED]: {
        [WorkflowAction.ACCEPT]: DocketStatus.IN_REVIEW,
        [WorkflowAction.FORWARD]: DocketStatus.FORWARDED,
        [WorkflowAction.RETURN]: DocketStatus.OPEN,
      },
      [DocketStatus.PENDING_APPROVAL]: {
        [WorkflowAction.APPROVE]: DocketStatus.APPROVED,
        [WorkflowAction.REJECT]: DocketStatus.REJECTED,
        [WorkflowAction.RETURN]: DocketStatus.IN_REVIEW,
      },
      [DocketStatus.APPROVED]: {
        [WorkflowAction.CLOSE]: DocketStatus.CLOSED,
        [WorkflowAction.FORWARD]: DocketStatus.FORWARDED,
      },
      [DocketStatus.REJECTED]: {
        [WorkflowAction.REOPEN]: DocketStatus.OPEN,
        [WorkflowAction.CLOSE]: DocketStatus.CLOSED,
      },
      [DocketStatus.CLOSED]: {
        [WorkflowAction.REOPEN]: DocketStatus.OPEN,
        [WorkflowAction.ARCHIVE]: DocketStatus.ARCHIVED,
      },
    };

    return statusTransitions[currentStatus]?.[action] || null;
  }

  /**
   * Execute a workflow transition
   */
  async executeTransition(
    docketId: string,
    action: WorkflowAction,
    userId: string,
    userRoles: string[],
    data?: TransitionData,
  ): Promise<TransitionResult> {
    // Get docket with current workflow
    const docket = await this.prisma.docket.findUnique({
      where: { id: docketId },
      include: {
        workflowInstance: true,
      },
    });

    if (!docket) {
      throw new BadRequestException('Docket not found');
    }

    const currentStatus = docket.status as DocketStatus;

    // Check if action is valid
    if (!this.isActionValid(currentStatus, action)) {
      throw new BadRequestException(
        `Action '${action}' is not valid for status '${currentStatus}'`,
      );
    }

    // Check role-based permissions for certain actions
    this.checkActionPermission(action, userRoles);

    // Validate forward data
    if (action === WorkflowAction.FORWARD && !data?.toUserId && !data?.toDepartmentId) {
      throw new BadRequestException('Forward action requires a recipient user or department');
    }

    // Get next status
    const newStatus = this.getNextStatus(currentStatus, action);
    if (!newStatus) {
      throw new BadRequestException('Unable to determine next status');
    }

    // Execute transition in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Update docket status
      const updateData: any = {
        status: newStatus,
        updatedBy: userId,
      };

      // Handle specific actions
      if (action === WorkflowAction.FORWARD && data?.toUserId) {
        updateData.currentAssigneeId = data.toUserId;
      }
      if (action === WorkflowAction.FORWARD && data?.toDepartmentId) {
        updateData.currentDepartmentId = data.toDepartmentId;
      }
      if (action === WorkflowAction.CLOSE) {
        updateData.closedAt = new Date();
        updateData.closedBy = userId;
      }

      await tx.docket.update({
        where: { id: docketId },
        data: updateData,
      });

      // Create or update workflow instance
      let workflowInstanceId = docket.workflowInstanceId;

      if (!workflowInstanceId) {
        // Create workflow instance
        const defaultWorkflow = await tx.workflowDefinition.findFirst({
          where: { isActive: true },
        });

        if (defaultWorkflow) {
          const instance = await tx.workflowInstance.create({
            data: {
              workflowDefinitionId: defaultWorkflow.id,
              currentState: newStatus,
            },
          });
          workflowInstanceId = instance.id;

          await tx.docket.update({
            where: { id: docketId },
            data: { workflowInstanceId: instance.id },
          });
        }
      } else {
        // Update existing workflow instance
        await tx.workflowInstance.update({
          where: { id: workflowInstanceId },
          data: {
            currentState: newStatus,
            completedAt: newStatus === DocketStatus.ARCHIVED ? new Date() : null,
          },
        });
      }

      // Record transition
      if (workflowInstanceId) {
        await tx.workflowTransition.create({
          data: {
            workflowInstanceId,
            fromState: currentStatus,
            toState: newStatus,
            action,
            performedBy: userId,
            fromUserId: docket.currentAssigneeId,
            toUserId: data?.toUserId,
            fromDepartmentId: docket.currentDepartmentId,
            toDepartmentId: data?.toDepartmentId,
            reason: data?.reason,
            notes: data?.notes,
          },
        });
      }

      // Create assignment record for forwards
      if (action === WorkflowAction.FORWARD) {
        const lastAssignment = await tx.docketAssignment.findFirst({
          where: { docketId },
          orderBy: { sequenceNumber: 'desc' },
        });

        await tx.docketAssignment.create({
          data: {
            docketId,
            assignedToUserId: data?.toUserId,
            assignedToDepartmentId: data?.toDepartmentId,
            assignedByUserId: userId,
            sequenceNumber: (lastAssignment?.sequenceNumber || 0) + 1,
            assignmentType: 'forward',
            instructions: data?.instructions,
            status: 'pending',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: action.toUpperCase(),
          resourceType: 'docket',
          resourceId: docketId,
          docketId,
          workflowInstanceId: workflowInstanceId || null,
          details: {
            fromStatus: currentStatus,
            toStatus: newStatus,
            toUserId: data?.toUserId || null,
            toDepartmentId: data?.toDepartmentId || null,
            reason: data?.reason || null,
          },
        },
      });
    });

    this.logger.log(`Docket ${docketId}: ${currentStatus} -> ${newStatus} via ${action}`);

    // Send notifications based on action
    await this.sendWorkflowNotifications(docket, action, userId, data);

    return {
      success: true,
      newStatus,
      message: `Docket transitioned to ${newStatus}`,
    };
  }

  /**
   * Send notifications based on workflow action
   */
  private async sendWorkflowNotifications(
    docket: { id: string; docketNumber: string; subject: string; createdBy: string | null },
    action: WorkflowAction,
    performedByUserId: string,
    data?: TransitionData,
  ): Promise<void> {
    try {
      // Get the performer's name
      const performer = await this.prisma.user.findUnique({
        where: { id: performedByUserId },
        select: { firstName: true, username: true },
      });
      const performerName = performer?.firstName || performer?.username || 'Someone';

      // Determine who to notify based on action
      if (action === WorkflowAction.FORWARD && data?.toUserId) {
        await this.notificationsService.queueNotification({
          type: NotificationType.DOCKET_FORWARDED,
          userId: data.toUserId,
          docketId: docket.id,
          channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
          data: {
            docketNumber: docket.docketNumber,
            subject: docket.subject,
            forwardedBy: performerName,
            instructions: data.instructions || '',
          },
        });
      }

      if (action === WorkflowAction.APPROVE && docket.createdBy) {
        await this.notificationsService.queueNotification({
          type: NotificationType.DOCKET_APPROVED,
          userId: docket.createdBy,
          docketId: docket.id,
          channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
          data: {
            docketNumber: docket.docketNumber,
            subject: docket.subject,
            approvedBy: performerName,
            notes: data?.notes || '',
          },
        });
      }

      if (action === WorkflowAction.REJECT && docket.createdBy) {
        await this.notificationsService.queueNotification({
          type: NotificationType.DOCKET_REJECTED,
          userId: docket.createdBy,
          docketId: docket.id,
          channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
          data: {
            docketNumber: docket.docketNumber,
            subject: docket.subject,
            rejectedBy: performerName,
            reason: data?.reason || 'No reason provided',
          },
        });
      }

      if (action === WorkflowAction.CLOSE && docket.createdBy) {
        await this.notificationsService.queueNotification({
          type: NotificationType.DOCKET_CLOSED,
          userId: docket.createdBy,
          docketId: docket.id,
          channels: [NotificationChannel.SMS, NotificationChannel.IN_APP],
          data: {
            docketNumber: docket.docketNumber,
            subject: docket.subject,
          },
        });
      }
    } catch (error) {
      // Don't fail the transaction if notification fails
      this.logger.error(`Failed to send workflow notification: ${error}`);
    }
  }

  /**
   * Check if user has permission for the action
   */
  private checkActionPermission(action: WorkflowAction, userRoles: string[]): void {
    // Admin can do everything
    if (userRoles.includes('admin')) {
      return;
    }

    const roleRequirements: Partial<Record<WorkflowAction, string[]>> = {
      [WorkflowAction.APPROVE]: ['approver', 'admin'],
      [WorkflowAction.REJECT]: ['approver', 'admin'],
      [WorkflowAction.ARCHIVE]: ['admin'],
    };

    const required = roleRequirements[action];
    if (required && !required.some((r) => userRoles.includes(r))) {
      throw new ForbiddenException(
        `Action '${action}' requires one of these roles: ${required.join(', ')}`,
      );
    }
  }

  /**
   * Get workflow history for a docket
   */
  async getWorkflowHistory(docketId: string) {
    const docket = await this.prisma.docket.findUnique({
      where: { id: docketId },
      include: {
        workflowInstance: {
          include: {
            transitions: {
              include: {
                performer: { select: { id: true, username: true, email: true } },
                fromUser: { select: { id: true, username: true } },
                toUser: { select: { id: true, username: true } },
                fromDepartment: { select: { id: true, name: true, code: true } },
                toDepartment: { select: { id: true, name: true, code: true } },
              },
              orderBy: { performedAt: 'desc' },
            },
          },
        },
      },
    });

    return docket?.workflowInstance?.transitions || [];
  }

  /**
   * Get allowed actions for current status
   */
  getAllowedActions(status: DocketStatus, userRoles: string[]): WorkflowAction[] {
    const allActions = WORKFLOW_TRANSITIONS[status] || [];

    // Filter by role permissions
    return allActions.filter((action) => {
      try {
        this.checkActionPermission(action, userRoles);
        return true;
      } catch {
        return false;
      }
    });
  }
}
