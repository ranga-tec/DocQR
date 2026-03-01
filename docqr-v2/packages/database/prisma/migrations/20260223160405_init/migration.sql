-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "avatar" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "assigned_by" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "resource_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parent_id" TEXT,
    "head_user_id" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_departments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "physical_registers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "register_code" TEXT NOT NULL,
    "description" TEXT,
    "department_id" TEXT,
    "register_type" TEXT NOT NULL,
    "year_start" TIMESTAMP(3),
    "year_end" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "physical_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "register_entries" (
    "id" TEXT NOT NULL,
    "register_id" TEXT NOT NULL,
    "entry_number" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "from_party" TEXT,
    "to_party" TEXT,
    "remarks" TEXT,
    "docket_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "register_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docket_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "default_workflow_id" TEXT,
    "sla_days" INTEGER,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "docket_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dockets" (
    "id" TEXT NOT NULL,
    "docket_number" TEXT NOT NULL,
    "qr_token" TEXT NOT NULL,
    "qr_code_path" TEXT,
    "docket_type_id" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "confidentiality" TEXT NOT NULL DEFAULT 'internal',
    "status" TEXT NOT NULL DEFAULT 'open',
    "workflow_instance_id" TEXT,
    "current_assignee_id" TEXT,
    "current_department_id" TEXT,
    "register_entry_id" TEXT,
    "due_date" TIMESTAMP(3),
    "sla_status" TEXT NOT NULL DEFAULT 'on_track',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dockets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docket_attachments" (
    "id" TEXT NOT NULL,
    "docket_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_bucket" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "attachment_type" TEXT NOT NULL DEFAULT 'document',
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "onlyoffice_key" TEXT,
    "last_edited_at" TIMESTAMP(3),
    "last_edited_by" TEXT,
    "is_signed" BOOLEAN NOT NULL DEFAULT false,
    "signing_status" TEXT,
    "signed_at" TIMESTAMP(3),
    "signed_by" TEXT,
    "signature_data" JSONB,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "docket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docket_comments" (
    "id" TEXT NOT NULL,
    "docket_id" TEXT NOT NULL,
    "comment_type" TEXT NOT NULL DEFAULT 'note',
    "content" TEXT NOT NULL,
    "attachment_id" TEXT,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "docket_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docket_assignments" (
    "id" TEXT NOT NULL,
    "docket_id" TEXT NOT NULL,
    "assigned_to_user_id" TEXT,
    "assigned_to_department_id" TEXT,
    "assigned_by_user_id" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "assignment_type" TEXT NOT NULL DEFAULT 'forward',
    "instructions" TEXT,
    "expected_action" TEXT,
    "due_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "response_notes" TEXT,
    "action_taken" TEXT,

    CONSTRAINT "docket_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "states" JSONB NOT NULL,
    "transitions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_instances" (
    "id" TEXT NOT NULL,
    "workflow_definition_id" TEXT NOT NULL,
    "current_state" TEXT NOT NULL,
    "state_data" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_transitions" (
    "id" TEXT NOT NULL,
    "workflow_instance_id" TEXT NOT NULL,
    "from_state" TEXT,
    "to_state" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performed_by" TEXT NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "from_user_id" TEXT,
    "to_user_id" TEXT,
    "from_department_id" TEXT,
    "to_department_id" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject_template" TEXT NOT NULL,
    "body_template" TEXT NOT NULL,
    "sms_template" TEXT,
    "channels" JSONB NOT NULL DEFAULT '["email"]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "template_id" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "action_url" TEXT,
    "channels" JSONB NOT NULL DEFAULT '["email"]',
    "email_status" TEXT NOT NULL DEFAULT 'pending',
    "email_sent_at" TIMESTAMP(3),
    "sms_status" TEXT NOT NULL DEFAULT 'pending',
    "sms_sent_at" TIMESTAMP(3),
    "push_status" TEXT NOT NULL DEFAULT 'pending',
    "push_sent_at" TIMESTAMP(3),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signing_requests" (
    "id" TEXT NOT NULL,
    "docket_id" TEXT NOT NULL,
    "attachment_id" TEXT NOT NULL,
    "signing_provider" TEXT NOT NULL,
    "external_request_id" TEXT,
    "signers" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "signing_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" TEXT NOT NULL,
    "signing_request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "signer_order" INTEGER NOT NULL,
    "signature_type" TEXT,
    "signature_data" JSONB,
    "certificate_info" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "signed_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "geolocation" JSONB,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "docket_id" TEXT,
    "attachment_id" TEXT,
    "workflow_instance_id" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_path" TEXT,
    "request_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_code_idx" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");

-- CreateIndex
CREATE INDEX "user_departments_user_id_idx" ON "user_departments"("user_id");

-- CreateIndex
CREATE INDEX "user_departments_department_id_idx" ON "user_departments"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_departments_user_id_department_id_key" ON "user_departments"("user_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "physical_registers_register_code_key" ON "physical_registers"("register_code");

-- CreateIndex
CREATE INDEX "physical_registers_register_code_idx" ON "physical_registers"("register_code");

-- CreateIndex
CREATE INDEX "physical_registers_department_id_idx" ON "physical_registers"("department_id");

-- CreateIndex
CREATE INDEX "register_entries_register_id_idx" ON "register_entries"("register_id");

-- CreateIndex
CREATE INDEX "register_entries_docket_id_idx" ON "register_entries"("docket_id");

-- CreateIndex
CREATE UNIQUE INDEX "register_entries_register_id_entry_number_key" ON "register_entries"("register_id", "entry_number");

-- CreateIndex
CREATE UNIQUE INDEX "docket_types_code_key" ON "docket_types"("code");

-- CreateIndex
CREATE INDEX "docket_types_code_idx" ON "docket_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "dockets_docket_number_key" ON "dockets"("docket_number");

-- CreateIndex
CREATE UNIQUE INDEX "dockets_qr_token_key" ON "dockets"("qr_token");

-- CreateIndex
CREATE INDEX "dockets_docket_number_idx" ON "dockets"("docket_number");

-- CreateIndex
CREATE INDEX "dockets_qr_token_idx" ON "dockets"("qr_token");

-- CreateIndex
CREATE INDEX "dockets_status_idx" ON "dockets"("status");

-- CreateIndex
CREATE INDEX "dockets_current_assignee_id_idx" ON "dockets"("current_assignee_id");

-- CreateIndex
CREATE INDEX "dockets_current_department_id_idx" ON "dockets"("current_department_id");

-- CreateIndex
CREATE INDEX "dockets_docket_type_id_idx" ON "dockets"("docket_type_id");

-- CreateIndex
CREATE INDEX "dockets_created_at_idx" ON "dockets"("created_at" DESC);

-- CreateIndex
CREATE INDEX "dockets_due_date_idx" ON "dockets"("due_date");

-- CreateIndex
CREATE INDEX "dockets_sla_status_idx" ON "dockets"("sla_status");

-- CreateIndex
CREATE INDEX "docket_attachments_docket_id_idx" ON "docket_attachments"("docket_id");

-- CreateIndex
CREATE INDEX "docket_attachments_is_primary_idx" ON "docket_attachments"("is_primary");

-- CreateIndex
CREATE INDEX "docket_comments_docket_id_idx" ON "docket_comments"("docket_id");

-- CreateIndex
CREATE INDEX "docket_comments_created_at_idx" ON "docket_comments"("created_at" DESC);

-- CreateIndex
CREATE INDEX "docket_assignments_docket_id_idx" ON "docket_assignments"("docket_id");

-- CreateIndex
CREATE INDEX "docket_assignments_assigned_to_user_id_idx" ON "docket_assignments"("assigned_to_user_id");

-- CreateIndex
CREATE INDEX "docket_assignments_assigned_to_department_id_idx" ON "docket_assignments"("assigned_to_department_id");

-- CreateIndex
CREATE INDEX "docket_assignments_docket_id_sequence_number_idx" ON "docket_assignments"("docket_id", "sequence_number");

-- CreateIndex
CREATE INDEX "workflow_transitions_workflow_instance_id_idx" ON "workflow_transitions"("workflow_instance_id");

-- CreateIndex
CREATE INDEX "workflow_transitions_performed_at_idx" ON "workflow_transitions"("performed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_code_key" ON "notification_templates"("code");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_outbox_status_created_at_idx" ON "notification_outbox"("status", "created_at");

-- CreateIndex
CREATE INDEX "signing_requests_docket_id_idx" ON "signing_requests"("docket_id");

-- CreateIndex
CREATE INDEX "signing_requests_attachment_id_idx" ON "signing_requests"("attachment_id");

-- CreateIndex
CREATE INDEX "signing_requests_status_idx" ON "signing_requests"("status");

-- CreateIndex
CREATE INDEX "signatures_signing_request_id_idx" ON "signatures"("signing_request_id");

-- CreateIndex
CREATE INDEX "signatures_user_id_idx" ON "signatures"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_docket_id_idx" ON "audit_logs"("docket_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_user_id_fkey" FOREIGN KEY ("head_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_registers" ADD CONSTRAINT "physical_registers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_registers" ADD CONSTRAINT "physical_registers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_entries" ADD CONSTRAINT "register_entries_register_id_fkey" FOREIGN KEY ("register_id") REFERENCES "physical_registers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_entries" ADD CONSTRAINT "register_entries_docket_id_fkey" FOREIGN KEY ("docket_id") REFERENCES "dockets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_entries" ADD CONSTRAINT "register_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_types" ADD CONSTRAINT "docket_types_default_workflow_id_fkey" FOREIGN KEY ("default_workflow_id") REFERENCES "workflow_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dockets" ADD CONSTRAINT "dockets_docket_type_id_fkey" FOREIGN KEY ("docket_type_id") REFERENCES "docket_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dockets" ADD CONSTRAINT "dockets_current_assignee_id_fkey" FOREIGN KEY ("current_assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dockets" ADD CONSTRAINT "dockets_current_department_id_fkey" FOREIGN KEY ("current_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dockets" ADD CONSTRAINT "dockets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dockets" ADD CONSTRAINT "dockets_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dockets" ADD CONSTRAINT "dockets_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dockets" ADD CONSTRAINT "dockets_workflow_instance_id_fkey" FOREIGN KEY ("workflow_instance_id") REFERENCES "workflow_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_attachments" ADD CONSTRAINT "docket_attachments_docket_id_fkey" FOREIGN KEY ("docket_id") REFERENCES "dockets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_attachments" ADD CONSTRAINT "docket_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_attachments" ADD CONSTRAINT "docket_attachments_last_edited_by_fkey" FOREIGN KEY ("last_edited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_attachments" ADD CONSTRAINT "docket_attachments_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_comments" ADD CONSTRAINT "docket_comments_docket_id_fkey" FOREIGN KEY ("docket_id") REFERENCES "dockets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_comments" ADD CONSTRAINT "docket_comments_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "docket_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_comments" ADD CONSTRAINT "docket_comments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_assignments" ADD CONSTRAINT "docket_assignments_docket_id_fkey" FOREIGN KEY ("docket_id") REFERENCES "dockets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_assignments" ADD CONSTRAINT "docket_assignments_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_assignments" ADD CONSTRAINT "docket_assignments_assigned_to_department_id_fkey" FOREIGN KEY ("assigned_to_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_assignments" ADD CONSTRAINT "docket_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_workflow_definition_id_fkey" FOREIGN KEY ("workflow_definition_id") REFERENCES "workflow_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_workflow_instance_id_fkey" FOREIGN KEY ("workflow_instance_id") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_from_department_id_fkey" FOREIGN KEY ("from_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_to_department_id_fkey" FOREIGN KEY ("to_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_requests" ADD CONSTRAINT "signing_requests_docket_id_fkey" FOREIGN KEY ("docket_id") REFERENCES "dockets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_requests" ADD CONSTRAINT "signing_requests_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "docket_attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_requests" ADD CONSTRAINT "signing_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_signing_request_id_fkey" FOREIGN KEY ("signing_request_id") REFERENCES "signing_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_docket_id_fkey" FOREIGN KEY ("docket_id") REFERENCES "dockets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workflow_instance_id_fkey" FOREIGN KEY ("workflow_instance_id") REFERENCES "workflow_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
