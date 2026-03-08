import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ============================================
  // SEED PERMISSIONS
  // ============================================
  const permissions = [
    // Docket permissions
    { code: 'docket:create', name: 'Create Dockets', resourceType: 'docket' },
    { code: 'docket:view', name: 'View Dockets', resourceType: 'docket' },
    { code: 'docket:update', name: 'Update Dockets', resourceType: 'docket' },
    { code: 'docket:delete', name: 'Delete Dockets', resourceType: 'docket' },
    { code: 'docket:forward', name: 'Forward Dockets', resourceType: 'docket' },
    { code: 'docket:approve', name: 'Approve Dockets', resourceType: 'docket' },
    { code: 'docket:reject', name: 'Reject Dockets', resourceType: 'docket' },
    { code: 'docket:close', name: 'Close Dockets', resourceType: 'docket' },
    { code: 'docket:comment', name: 'Comment on Dockets', resourceType: 'docket' },
    // Attachment permissions
    { code: 'attachment:upload', name: 'Upload Attachments', resourceType: 'attachment' },
    { code: 'attachment:view', name: 'View Attachments', resourceType: 'attachment' },
    { code: 'attachment:download', name: 'Download Attachments', resourceType: 'attachment' },
    { code: 'attachment:edit', name: 'Edit Attachments', resourceType: 'attachment' },
    { code: 'attachment:sign', name: 'Sign Attachments', resourceType: 'attachment' },
    // Register permissions
    { code: 'register:manage', name: 'Manage Physical Registers', resourceType: 'register' },
    // User permissions
    { code: 'user:manage', name: 'Manage Users', resourceType: 'user' },
    // Admin permissions
    { code: 'admin:access', name: 'Admin Panel Access', resourceType: 'system' },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: {},
      create: permission,
    });
  }
  console.log('Permissions seeded');

  // ============================================
  // SEED ROLES
  // ============================================
  const roles = [
    {
      name: 'admin',
      displayName: 'Administrator',
      description: 'Full system access',
      isSystemRole: true,
      permissions: ['*'],
    },
    {
      name: 'clerk',
      displayName: 'Clerk',
      description: 'Intake and scanning',
      isSystemRole: true,
      permissions: ['docket:create', 'docket:view', 'attachment:upload', 'register:manage'],
    },
    {
      name: 'recipient',
      displayName: 'Recipient',
      description: 'View assigned dockets and attachments',
      isSystemRole: true,
      permissions: ['docket:view', 'attachment:view'],
    },
    {
      name: 'approver',
      displayName: 'Approver',
      description: 'Approval decisions',
      isSystemRole: true,
      permissions: ['docket:view', 'docket:approve', 'docket:reject', 'docket:forward', 'docket:comment'],
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        displayName: role.displayName,
        description: role.description,
        permissions: role.permissions,
      },
      create: role,
    });
  }
  console.log('Roles seeded');

  // ============================================
  // SEED DOCKET TYPES
  // ============================================
  const docketTypes = [
    { name: 'General Correspondence', code: 'GEN', description: 'General letters and correspondence', slaDays: 7, requiresApproval: false },
    { name: 'Legal Matter', code: 'LEGAL', description: 'Legal documents requiring review', slaDays: 14, requiresApproval: true },
    { name: 'Contract', code: 'CONTRACT', description: 'Contracts and agreements', slaDays: 30, requiresApproval: true },
    { name: 'Invoice', code: 'INVOICE', description: 'Financial invoices for processing', slaDays: 5, requiresApproval: true },
    { name: 'Complaint', code: 'COMPLAINT', description: 'Customer or stakeholder complaints', slaDays: 3, requiresApproval: false },
    { name: 'Internal Memo', code: 'MEMO', description: 'Internal communications', slaDays: 2, requiresApproval: false },
  ];

  for (const docketType of docketTypes) {
    await prisma.docketType.upsert({
      where: { code: docketType.code },
      update: docketType,
      create: docketType,
    });
  }
  console.log('Docket types seeded');

  // ============================================
  // SEED NOTIFICATION TEMPLATES
  // ============================================
  const notificationTemplates = [
    {
      code: 'docket_assigned',
      name: 'Docket Assigned',
      subjectTemplate: 'New Docket Assigned: {{docket_number}}',
      bodyTemplate: 'You have been assigned docket {{docket_number}} - {{subject}}. Please review at {{action_url}}',
      smsTemplate: 'New docket {{docket_number}} assigned. Check your portal.',
      channels: ['email', 'sms', 'push'],
    },
    {
      code: 'docket_forwarded',
      name: 'Docket Forwarded',
      subjectTemplate: 'Docket Forwarded: {{docket_number}}',
      bodyTemplate: 'Docket {{docket_number}} has been forwarded to you by {{from_user}}. Instructions: {{instructions}}',
      smsTemplate: 'Docket {{docket_number}} forwarded to you.',
      channels: ['email', 'push'],
    },
    {
      code: 'docket_approved',
      name: 'Docket Approved',
      subjectTemplate: 'Docket Approved: {{docket_number}}',
      bodyTemplate: 'Docket {{docket_number}} has been approved by {{approver}}.',
      smsTemplate: null,
      channels: ['email'],
    },
    {
      code: 'docket_rejected',
      name: 'Docket Rejected',
      subjectTemplate: 'Docket Rejected: {{docket_number}}',
      bodyTemplate: 'Docket {{docket_number}} has been rejected by {{approver}}. Reason: {{reason}}',
      smsTemplate: null,
      channels: ['email'],
    },
    {
      code: 'sla_warning',
      name: 'SLA Warning',
      subjectTemplate: 'SLA Warning: Docket {{docket_number}}',
      bodyTemplate: 'Docket {{docket_number}} is approaching its due date ({{due_date}}). Please take action.',
      smsTemplate: 'SLA warning for docket {{docket_number}}',
      channels: ['email', 'sms'],
    },
    {
      code: 'sla_breached',
      name: 'SLA Breached',
      subjectTemplate: 'URGENT: SLA Breached - Docket {{docket_number}}',
      bodyTemplate: 'Docket {{docket_number}} has exceeded its due date. Immediate action required.',
      smsTemplate: 'URGENT: Docket {{docket_number}} SLA breached!',
      channels: ['email', 'sms'],
    },
  ];

  for (const template of notificationTemplates) {
    await prisma.notificationTemplate.upsert({
      where: { code: template.code },
      update: template,
      create: template,
    });
  }
  console.log('Notification templates seeded');

  // ============================================
  // SEED DEFAULT WORKFLOW DEFINITION
  // ============================================
  const defaultWorkflow = {
    name: 'Default Docket Workflow',
    description: 'Standard workflow for document dockets',
    version: 1,
    isActive: true,
    states: [
      { name: 'open', displayName: 'Open', type: 'initial', allowedActions: ['start_review', 'forward', 'close'] },
      { name: 'in_review', displayName: 'In Review', type: 'intermediate', allowedActions: ['forward', 'submit_for_approval', 'approve', 'reject', 'return'] },
      { name: 'forwarded', displayName: 'Forwarded', type: 'intermediate', allowedActions: ['accept', 'forward', 'return'] },
      { name: 'pending_approval', displayName: 'Pending Approval', type: 'intermediate', allowedActions: ['approve', 'reject', 'return'] },
      { name: 'approved', displayName: 'Approved', type: 'intermediate', allowedActions: ['close', 'forward'] },
      { name: 'rejected', displayName: 'Rejected', type: 'intermediate', allowedActions: ['reopen', 'close'] },
      { name: 'closed', displayName: 'Closed', type: 'terminal', allowedActions: ['reopen', 'archive'] },
      { name: 'archived', displayName: 'Archived', type: 'terminal', allowedActions: [] },
    ],
    transitions: [
      { from: 'open', to: 'in_review', action: 'start_review' },
      { from: 'open', to: 'forwarded', action: 'forward' },
      { from: 'open', to: 'closed', action: 'close' },
      { from: 'in_review', to: 'forwarded', action: 'forward' },
      { from: 'in_review', to: 'pending_approval', action: 'submit_for_approval' },
      { from: 'in_review', to: 'approved', action: 'approve', requiredRoles: ['approver', 'admin'] },
      { from: 'in_review', to: 'rejected', action: 'reject', requiredRoles: ['approver', 'admin'] },
      { from: 'in_review', to: 'open', action: 'return' },
      { from: 'forwarded', to: 'in_review', action: 'accept' },
      { from: 'forwarded', to: 'forwarded', action: 'forward' },
      { from: 'forwarded', to: 'open', action: 'return' },
      { from: 'pending_approval', to: 'approved', action: 'approve', requiredRoles: ['approver', 'admin'] },
      { from: 'pending_approval', to: 'rejected', action: 'reject', requiredRoles: ['approver', 'admin'] },
      { from: 'pending_approval', to: 'in_review', action: 'return' },
      { from: 'approved', to: 'closed', action: 'close' },
      { from: 'approved', to: 'forwarded', action: 'forward' },
      { from: 'rejected', to: 'open', action: 'reopen' },
      { from: 'rejected', to: 'closed', action: 'close' },
      { from: 'closed', to: 'open', action: 'reopen', requiredRoles: ['admin'] },
      { from: 'closed', to: 'archived', action: 'archive', requiredRoles: ['admin'] },
    ],
  };

  await prisma.workflowDefinition.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: defaultWorkflow,
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      ...defaultWorkflow,
    },
  });
  console.log('Default workflow definition seeded');

  // ============================================
  // SEED ADMIN USER
  // ============================================
  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });

  if (adminRole) {
    const passwordHash = await bcrypt.hash('admin123', 10);

    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@docqr.local' },
      update: {},
      create: {
        email: 'admin@docqr.local',
        username: 'admin',
        passwordHash,
        firstName: 'System',
        lastName: 'Administrator',
        isActive: true,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: adminUser.id,
          roleId: adminRole.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    });

    console.log('Admin user seeded (admin@docqr.local / admin123)');
  }

  // ============================================
  // SEED SAMPLE DEPARTMENT
  // ============================================
  await prisma.department.upsert({
    where: { code: 'ADMIN' },
    update: {},
    create: {
      name: 'Administration',
      code: 'ADMIN',
      description: 'Administrative department',
      isActive: true,
    },
  });

  await prisma.department.upsert({
    where: { code: 'LEGAL' },
    update: {},
    create: {
      name: 'Legal',
      code: 'LEGAL',
      description: 'Legal department',
      isActive: true,
    },
  });

  await prisma.department.upsert({
    where: { code: 'FINANCE' },
    update: {},
    create: {
      name: 'Finance',
      code: 'FINANCE',
      description: 'Finance department',
      isActive: true,
    },
  });

  console.log('Sample departments seeded');

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
