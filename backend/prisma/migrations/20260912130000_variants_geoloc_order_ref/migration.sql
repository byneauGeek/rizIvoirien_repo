-- AlterTable
ALTER TABLE "Producer" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Cooperative" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "reference" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "unitLabel" TEXT,
ADD COLUMN     "variantId" INTEGER;

-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "pricePerKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "wholesalePrice" DOUBLE PRECISION,
    "minWholesaleQty" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantStockMovement" (
    "id" SERIAL NOT NULL,
    "variantId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quantityBefore" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "sourceType" TEXT,
    "sourceId" INTEGER,
    "reason" TEXT,
    "actorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariantStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "ProductVariant_active_idx" ON "ProductVariant"("active");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_unit_key" ON "ProductVariant"("productId", "unit");

-- CreateIndex
CREATE INDEX "VariantStockMovement_variantId_idx" ON "VariantStockMovement"("variantId");

-- CreateIndex
CREATE INDEX "VariantStockMovement_type_idx" ON "VariantStockMovement"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Order_reference_key" ON "Order"("reference");

-- CreateIndex
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantStockMovement" ADD CONSTRAINT "VariantStockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

