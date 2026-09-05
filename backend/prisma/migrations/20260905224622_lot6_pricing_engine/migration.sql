-- CreateTable
CREATE TABLE "PricingRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "segment" TEXT NOT NULL,
    "serviceLevel" TEXT NOT NULL,
    "originZoneId" INTEGER,
    "destinationZoneId" INTEGER,
    "basePrice" REAL NOT NULL,
    "pricePerKg" REAL NOT NULL DEFAULT 0,
    "pricePerKm" REAL NOT NULL DEFAULT 0,
    "pricePerPackage" REAL NOT NULL DEFAULT 0,
    "pricePerExtraOrigin" REAL NOT NULL DEFAULT 0,
    "pricePerExtraStop" REAL NOT NULL DEFAULT 0,
    "marginPct" REAL NOT NULL DEFAULT 0.20,
    "maxDeliveryFee" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PricingRule_originZoneId_fkey" FOREIGN KEY ("originZoneId") REFERENCES "Zone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PricingRule_destinationZoneId_fkey" FOREIGN KEY ("destinationZoneId") REFERENCES "Zone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_B2BTransaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contactId" INTEGER,
    "buyerUserId" INTEGER NOT NULL,
    "sellerUserId" INTEGER NOT NULL,
    "product" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "amount" REAL,
    "status" TEXT NOT NULL DEFAULT 'DECLARED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "needsLogistics" BOOLEAN NOT NULL DEFAULT false,
    "deliveryAddress" TEXT,
    "deliveryFee" REAL,
    "serviceLevel" TEXT NOT NULL DEFAULT 'STANDARD',
    "deliveryInternalCost" REAL,
    "deliveryMargin" REAL,
    CONSTRAINT "B2BTransaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ContactRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "B2BTransaction_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "B2BTransaction_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_B2BTransaction" ("amount", "buyerUserId", "contactId", "createdAt", "deliveryAddress", "deliveryFee", "id", "needsLogistics", "notes", "product", "quantity", "region", "sellerUserId", "status", "unit") SELECT "amount", "buyerUserId", "contactId", "createdAt", "deliveryAddress", "deliveryFee", "id", "needsLogistics", "notes", "product", "quantity", "region", "sellerUserId", "status", "unit" FROM "B2BTransaction";
DROP TABLE "B2BTransaction";
ALTER TABLE "new_B2BTransaction" RENAME TO "B2BTransaction";
CREATE UNIQUE INDEX "B2BTransaction_contactId_key" ON "B2BTransaction"("contactId");
CREATE INDEX "B2BTransaction_buyerUserId_idx" ON "B2BTransaction"("buyerUserId");
CREATE INDEX "B2BTransaction_sellerUserId_idx" ON "B2BTransaction"("sellerUserId");
CREATE INDEX "B2BTransaction_status_idx" ON "B2BTransaction"("status");
CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "buyerId" INTEGER NOT NULL,
    "shopId" INTEGER NOT NULL,
    "driverId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total" REAL NOT NULL,
    "deliveryFee" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "promoCode" TEXT,
    "address" TEXT NOT NULL,
    "note" TEXT,
    "serviceLevel" TEXT NOT NULL DEFAULT 'STANDARD',
    "deliveryInternalCost" REAL,
    "deliveryMargin" REAL,
    "groupId" TEXT,
    "idempotencyKey" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH_ON_DELIVERY',
    "driverRated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("address", "buyerId", "createdAt", "deliveryFee", "discount", "driverId", "driverRated", "groupId", "id", "idempotencyKey", "note", "paymentMethod", "promoCode", "shopId", "status", "total", "updatedAt") SELECT "address", "buyerId", "createdAt", "deliveryFee", "discount", "driverId", "driverRated", "groupId", "id", "idempotencyKey", "note", "paymentMethod", "promoCode", "shopId", "status", "total", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_buyerId_idx" ON "Order"("buyerId");
CREATE INDEX "Order_shopId_idx" ON "Order"("shopId");
CREATE INDEX "Order_driverId_idx" ON "Order"("driverId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_groupId_idx" ON "Order"("groupId");
CREATE UNIQUE INDEX "Order_buyerId_idempotencyKey_key" ON "Order"("buyerId", "idempotencyKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PricingRule_originZoneId_idx" ON "PricingRule"("originZoneId");

-- CreateIndex
CREATE INDEX "PricingRule_destinationZoneId_idx" ON "PricingRule"("destinationZoneId");

-- CreateIndex
CREATE UNIQUE INDEX "PricingRule_segment_serviceLevel_originZoneId_destinationZoneId_key" ON "PricingRule"("segment", "serviceLevel", "originZoneId", "destinationZoneId");
