-- AlterTable
ALTER TABLE "docket_comments"
ADD COLUMN "parent_comment_id" TEXT;

-- CreateTable
CREATE TABLE "user_notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours_enabled" BOOLEAN NOT NULL DEFAULT false,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,
    "time_zone" TEXT NOT NULL DEFAULT 'UTC',
    "delivery_mode" TEXT NOT NULL DEFAULT 'immediate',
    "digest_frequency" TEXT NOT NULL DEFAULT 'daily',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_preferences_user_id_key" ON "user_notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_notification_preferences_delivery_mode_idx" ON "user_notification_preferences"("delivery_mode");

-- CreateIndex
CREATE INDEX "user_notification_preferences_quiet_hours_enabled_idx" ON "user_notification_preferences"("quiet_hours_enabled");

-- CreateIndex
CREATE INDEX "docket_comments_parent_comment_id_idx" ON "docket_comments"("parent_comment_id");

-- AddForeignKey
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docket_comments" ADD CONSTRAINT "docket_comments_parent_comment_id_fkey"
FOREIGN KEY ("parent_comment_id") REFERENCES "docket_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
