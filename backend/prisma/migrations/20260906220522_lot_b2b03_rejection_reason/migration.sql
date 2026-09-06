-- AlterTable
ALTER TABLE "Cooperative" ADD COLUMN "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "Exporter" ADD COLUMN "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "Processor" ADD COLUMN "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "Producer" ADD COLUMN "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "Trader" ADD COLUMN "rejectionReason" TEXT;
