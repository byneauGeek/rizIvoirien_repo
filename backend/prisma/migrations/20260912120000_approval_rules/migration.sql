-- AlterTable
ALTER TABLE "RiceOffer" ADD COLUMN     "moderationStatus" TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "moderationStatus" TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "rejectionReason" TEXT;

-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" SERIAL NOT NULL,
    "targetType" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'FLAG_FOR_REVIEW',
    "params" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalRule_targetType_idx" ON "ApprovalRule"("targetType");

-- CreateIndex
CREATE INDEX "ApprovalRule_active_idx" ON "ApprovalRule"("active");

-- CreateIndex
CREATE INDEX "RiceOffer_moderationStatus_idx" ON "RiceOffer"("moderationStatus");

-- CreateIndex
CREATE INDEX "Product_moderationStatus_idx" ON "Product"("moderationStatus");

