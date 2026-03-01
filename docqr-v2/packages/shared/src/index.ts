// ============================================
// WORKFLOW STATES & ACTIONS
// ============================================

export enum DocketStatus {
  OPEN = 'open',
  IN_REVIEW = 'in_review',
  FORWARDED = 'forwarded',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}

export enum WorkflowAction {
  START_REVIEW = 'start_review',
  FORWARD = 'forward',
  ACCEPT = 'accept',
  RETURN = 'return',
  SUBMIT_FOR_APPROVAL = 'submit_for_approval',
  APPROVE = 'approve',
  REJECT = 'reject',
  CLOSE = 'close',
  REOPEN = 'reopen',
  ARCHIVE = 'archive',
}

export enum Priority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum Confidentiality {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  SECRET = 'secret',
}

export enum SlaStatus {
  ON_TRACK = 'on_track',
  AT_RISK = 'at_risk',
  OVERDUE = 'overdue',
}

// ============================================
// RBAC
// ============================================

export enum SystemRole {
  ADMIN = 'admin',
  CLERK = 'clerk',
  RECIPIENT = 'recipient',
  APPROVER = 'approver',
}

export enum Permission {
  // Docket permissions
  DOCKET_CREATE = 'docket:create',
  DOCKET_VIEW = 'docket:view',
  DOCKET_UPDATE = 'docket:update',
  DOCKET_DELETE = 'docket:delete',
  DOCKET_FORWARD = 'docket:forward',
  DOCKET_APPROVE = 'docket:approve',
  DOCKET_REJECT = 'docket:reject',
  DOCKET_CLOSE = 'docket:close',
  DOCKET_COMMENT = 'docket:comment',

  // Attachment permissions
  ATTACHMENT_UPLOAD = 'attachment:upload',
  ATTACHMENT_VIEW = 'attachment:view',
  ATTACHMENT_DOWNLOAD = 'attachment:download',
  ATTACHMENT_EDIT = 'attachment:edit',
  ATTACHMENT_SIGN = 'attachment:sign',

  // Register permissions
  REGISTER_MANAGE = 'register:manage',

  // User permissions
  USER_MANAGE = 'user:manage',

  // Admin permissions
  ADMIN_ACCESS = 'admin:access',

  // Wildcard
  ALL = '*',
}

// ============================================
// ATTACHMENT TYPES
// ============================================

export enum AttachmentType {
  DOCUMENT = 'document',
  IMAGE = 'image',
  SUPPORTING = 'supporting',
  COVER_LETTER = 'cover_letter',
  APPROVAL_NOTE = 'approval_note',
  OTHER = 'other',
}

export enum CommentType {
  NOTE = 'note',
  OBSERVATION = 'observation',
  INSTRUCTION = 'instruction',
  QUERY = 'query',
  RESPONSE = 'response',
  DECISION = 'decision',
  SYSTEM = 'system',
}

export enum AssignmentType {
  INITIAL = 'initial',
  FORWARD = 'forward',
  ESCALATE = 'escalate',
  DELEGATE = 'delegate',
  RETURN = 'return',
}

export enum AssignmentStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  RETURNED = 'returned',
  ESCALATED = 'escalated',
}

// ============================================
// NOTIFICATION TYPES
// ============================================

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  DELIVERED = 'delivered',
}

export enum NotificationCode {
  DOCKET_ASSIGNED = 'docket_assigned',
  DOCKET_FORWARDED = 'docket_forwarded',
  DOCKET_APPROVED = 'docket_approved',
  DOCKET_REJECTED = 'docket_rejected',
  DOCKET_CLOSED = 'docket_closed',
  COMMENT_ADDED = 'comment_added',
  SLA_WARNING = 'sla_warning',
  SLA_BREACHED = 'sla_breached',
}

// ============================================
// SIGNING (PHASE 2)
// ============================================

export enum SigningProvider {
  SIGNEX = 'signex',
  STELLASIGN = 'stellasign',
  INTERNAL = 'internal',
}

export enum SigningStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  PARTIALLY_SIGNED = 'partially_signed',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum SignatureStatus {
  PENDING = 'pending',
  SIGNED = 'signed',
  REJECTED = 'rejected',
  SKIPPED = 'skipped',
}

// ============================================
// REGISTER TYPES
// ============================================

export enum RegisterType {
  INWARD = 'inward',
  OUTWARD = 'outward',
  CONTRACT = 'contract',
  GENERAL = 'general',
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DocketFilterParams extends PaginationParams {
  search?: string;
  status?: DocketStatus | DocketStatus[];
  priority?: Priority | Priority[];
  docketTypeId?: string;
  assigneeId?: string;
  departmentId?: string;
  createdById?: string;
  dateFrom?: string;
  dateTo?: string;
  slaStatus?: SlaStatus;
  assignedToMe?: boolean | string; // Filter dockets assigned to current user
}

// ============================================
// WORKFLOW TRANSITION MAP
// ============================================

export const WORKFLOW_TRANSITIONS: Record<DocketStatus, WorkflowAction[]> = {
  [DocketStatus.OPEN]: [
    WorkflowAction.START_REVIEW,
    WorkflowAction.FORWARD,
    WorkflowAction.CLOSE,
  ],
  [DocketStatus.IN_REVIEW]: [
    WorkflowAction.FORWARD,
    WorkflowAction.SUBMIT_FOR_APPROVAL,
    WorkflowAction.APPROVE,
    WorkflowAction.REJECT,
    WorkflowAction.RETURN,
  ],
  [DocketStatus.FORWARDED]: [
    WorkflowAction.ACCEPT,
    WorkflowAction.FORWARD,
    WorkflowAction.RETURN,
  ],
  [DocketStatus.PENDING_APPROVAL]: [
    WorkflowAction.APPROVE,
    WorkflowAction.REJECT,
    WorkflowAction.RETURN,
  ],
  [DocketStatus.APPROVED]: [
    WorkflowAction.CLOSE,
    WorkflowAction.FORWARD,
  ],
  [DocketStatus.REJECTED]: [
    WorkflowAction.REOPEN,
    WorkflowAction.CLOSE,
  ],
  [DocketStatus.CLOSED]: [
    WorkflowAction.REOPEN,
    WorkflowAction.ARCHIVE,
  ],
  [DocketStatus.ARCHIVED]: [],
};

// ============================================
// ROLE PERMISSIONS MAP
// ============================================

export const ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  [SystemRole.ADMIN]: [Permission.ALL],
  [SystemRole.CLERK]: [
    Permission.DOCKET_CREATE,
    Permission.DOCKET_VIEW,
    Permission.ATTACHMENT_UPLOAD,
    Permission.REGISTER_MANAGE,
  ],
  [SystemRole.RECIPIENT]: [
    Permission.DOCKET_VIEW,
    Permission.DOCKET_COMMENT,
    Permission.ATTACHMENT_VIEW,
  ],
  [SystemRole.APPROVER]: [
    Permission.DOCKET_VIEW,
    Permission.DOCKET_APPROVE,
    Permission.DOCKET_REJECT,
    Permission.DOCKET_FORWARD,
    Permission.DOCKET_COMMENT,
  ],
};
