-- AlterTable
ALTER TABLE "docket_attachments"
ADD COLUMN "ingestion_source" TEXT NOT NULL DEFAULT 'upload',
ADD COLUMN "ingestion_metadata" JSONB;

-- CreateTable
CREATE TABLE "document_contents" (
    "id" TEXT NOT NULL,
    "attachment_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "extraction_method" TEXT,
    "language" TEXT,
    "confidence" DOUBLE PRECISION,
    "content" TEXT NOT NULL DEFAULT '',
    "page_count" INTEGER,
    "engine" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_contents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_contents_attachment_id_key" ON "document_contents"("attachment_id");

-- CreateIndex
CREATE INDEX "document_contents_status_idx" ON "document_contents"("status");

-- CreateIndex
CREATE INDEX "document_contents_processed_at_idx" ON "document_contents"("processed_at" DESC);

-- CreateIndex
CREATE INDEX "docket_attachments_ingestion_source_idx" ON "docket_attachments"("ingestion_source");

-- AddForeignKey
ALTER TABLE "document_contents" ADD CONSTRAINT "document_contents_attachment_id_fkey"
FOREIGN KEY ("attachment_id") REFERENCES "docket_attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
