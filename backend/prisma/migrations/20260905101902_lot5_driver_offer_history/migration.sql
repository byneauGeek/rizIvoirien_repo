-- CreateTable
CREATE TABLE "DriverOfferHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "DriverOfferHistory_orderId_idx" ON "DriverOfferHistory"("orderId");

