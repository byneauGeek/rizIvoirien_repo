-- DropIndex
DROP INDEX "Order_reference_key";

-- CreateIndex
CREATE UNIQUE INDEX "Order_shopId_reference_key" ON "Order"("shopId", "reference");

