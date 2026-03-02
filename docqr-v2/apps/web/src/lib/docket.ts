export interface DocketActor {
  id?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
}

export interface NormalizedDocket {
  id: string;
  docketNumber: string;
  referenceNumber: string;
  subject: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt?: string;
  dueDate?: string;
  qrToken?: string;
  qrTokenExpiresAt?: string;
  docketType?: {
    id?: string;
    name: string;
    description?: string;
    prefix?: string;
  };
  creator?: DocketActor;
  createdBy?: DocketActor;
  currentAssignee?: DocketActor;
  currentAssignment?: {
    instructions?: string;
    assignedAt?: string;
    assignedBy?: DocketActor;
  };
  senderName?: string;
  senderOrganization?: string;
  senderEmail?: string;
  senderPhone?: string;
  senderAddress?: string;
  receivedDate?: string;
  attachmentCount?: number;
  commentCount?: number;
}

interface DocketListResult {
  items: NormalizedDocket[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function toUpperValue(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return value.trim().toUpperCase();
}

function toActor(input: unknown): DocketActor | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const actor = input as Record<string, unknown>;
  const fullName = typeof actor.fullName === 'string' ? actor.fullName : undefined;
  const firstName = typeof actor.firstName === 'string'
    ? actor.firstName
    : fullName || undefined;

  return {
    id: typeof actor.id === 'string' ? actor.id : undefined,
    username: typeof actor.username === 'string' ? actor.username : undefined,
    firstName,
    lastName: typeof actor.lastName === 'string' ? actor.lastName : undefined,
    fullName,
  };
}

export function normalizeDocket(input: unknown): NormalizedDocket {
  const docket = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

  const creator = toActor(docket.creator);
  const createdBy = toActor(docket.createdBy) || creator;

  const docketNumber = String(
    docket.docketNumber
      || docket.referenceNumber
      || docket.reference_number
      || '',
  );
  const subject = String(docket.subject || docket.title || '');

  const docketTypeRaw = docket.docketType as Record<string, unknown> | undefined;
  const docketType = docketTypeRaw
    ? {
        id: typeof docketTypeRaw.id === 'string' ? docketTypeRaw.id : undefined,
        name: String(docketTypeRaw.name || ''),
        description: typeof docketTypeRaw.description === 'string' ? docketTypeRaw.description : undefined,
        prefix: typeof docketTypeRaw.prefix === 'string'
          ? docketTypeRaw.prefix
          : (typeof docketTypeRaw.code === 'string' ? docketTypeRaw.code : undefined),
      }
    : undefined;

  const currentAssignmentRaw = docket.currentAssignment as Record<string, unknown> | undefined;

  return {
    id: String(docket.id || ''),
    docketNumber,
    referenceNumber: docketNumber,
    subject,
    title: subject,
    description: typeof docket.description === 'string' ? docket.description : undefined,
    status: toUpperValue(docket.status, 'OPEN'),
    priority: toUpperValue(docket.priority, 'NORMAL'),
    createdAt: String(docket.createdAt || docket.created_at || ''),
    updatedAt: typeof docket.updatedAt === 'string' ? docket.updatedAt : undefined,
    dueDate: typeof docket.dueDate === 'string' ? docket.dueDate : undefined,
    qrToken: typeof docket.qrToken === 'string' ? docket.qrToken : undefined,
    qrTokenExpiresAt: typeof docket.qrTokenExpiresAt === 'string' ? docket.qrTokenExpiresAt : undefined,
    docketType: docketType && docketType.name ? docketType : undefined,
    creator,
    createdBy,
    currentAssignee: toActor(docket.currentAssignee),
    currentAssignment: currentAssignmentRaw
      ? {
          instructions: typeof currentAssignmentRaw.instructions === 'string' ? currentAssignmentRaw.instructions : undefined,
          assignedAt: typeof currentAssignmentRaw.assignedAt === 'string' ? currentAssignmentRaw.assignedAt : undefined,
          assignedBy: toActor(currentAssignmentRaw.assignedBy),
        }
      : undefined,
    senderName: typeof docket.senderName === 'string' ? docket.senderName : undefined,
    senderOrganization: typeof docket.senderOrganization === 'string' ? docket.senderOrganization : undefined,
    senderEmail: typeof docket.senderEmail === 'string' ? docket.senderEmail : undefined,
    senderPhone: typeof docket.senderPhone === 'string' ? docket.senderPhone : undefined,
    senderAddress: typeof docket.senderAddress === 'string' ? docket.senderAddress : undefined,
    receivedDate: typeof docket.receivedDate === 'string' ? docket.receivedDate : undefined,
    attachmentCount: typeof docket.attachmentCount === 'number' ? docket.attachmentCount : undefined,
    commentCount: typeof docket.commentCount === 'number' ? docket.commentCount : undefined,
  };
}

function extractRawArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const root = payload as Record<string, unknown>;
  if (Array.isArray(root.data)) return root.data;

  if (root.data && typeof root.data === 'object') {
    const nested = root.data as Record<string, unknown>;
    if (Array.isArray(nested.data)) return nested.data;
    if (Array.isArray(nested.items)) return nested.items;
  }

  if (Array.isArray(root.items)) return root.items as unknown[];
  return [];
}

function extractNumber(payload: unknown, keys: string[], fallback: number): number {
  if (!payload || typeof payload !== 'object') return fallback;
  const root = payload as Record<string, unknown>;

  for (const key of keys) {
    const value = root[key];
    if (typeof value === 'number') return value;
  }

  const nested = root.data;
  if (nested && typeof nested === 'object') {
    const nestedObj = nested as Record<string, unknown>;
    for (const key of keys) {
      const value = nestedObj[key];
      if (typeof value === 'number') return value;
    }
    if (nestedObj.meta && typeof nestedObj.meta === 'object') {
      const meta = nestedObj.meta as Record<string, unknown>;
      for (const key of keys) {
        const value = meta[key];
        if (typeof value === 'number') return value;
      }
    }
  }

  if (root.meta && typeof root.meta === 'object') {
    const meta = root.meta as Record<string, unknown>;
    for (const key of keys) {
      const value = meta[key];
      if (typeof value === 'number') return value;
    }
  }

  return fallback;
}

export function extractDocketList(payload: unknown): DocketListResult {
  const rawItems = extractRawArray(payload);
  const items = rawItems.map((item) => normalizeDocket(item));

  const total = extractNumber(payload, ['total'], items.length);
  const page = extractNumber(payload, ['page'], 1);
  const pageSize = extractNumber(payload, ['pageSize', 'limit'], items.length || 10);
  const totalPages = extractNumber(
    payload,
    ['totalPages'],
    Math.max(1, Math.ceil(total / Math.max(pageSize, 1))),
  );

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
  };
}
