-- CreateTable
CREATE TABLE "UserCapability" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserCapability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    CONSTRAINT "B2BTransaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ContactRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "B2BTransaction_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "B2BTransaction_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_B2BTransaction" ("amount", "buyerUserId", "contactId", "createdAt", "id", "notes", "product", "quantity", "region", "sellerUserId", "status", "unit") SELECT "amount", "buyerUserId", "contactId", "createdAt", "id", "notes", "product", "quantity", "region", "sellerUserId", "status", "unit" FROM "B2BTransaction";
DROP TABLE "B2BTransaction";
ALTER TABLE "new_B2BTransaction" RENAME TO "B2BTransaction";
CREATE UNIQUE INDEX "B2BTransaction_contactId_key" ON "B2BTransaction"("contactId");
CREATE INDEX "B2BTransaction_buyerUserId_idx" ON "B2BTransaction"("buyerUserId");
CREATE INDEX "B2BTransaction_sellerUserId_idx" ON "B2BTransaction"("sellerUserId");
CREATE INDEX "B2BTransaction_status_idx" ON "B2BTransaction"("status");
CREATE TABLE "new_Shipment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER,
    "b2bTransactionId" INTEGER,
    "driverId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PICKUP',
    "pickupAddress" TEXT,
    "dropoffAddress" TEXT NOT NULL,
    "dropoffLat" REAL,
    "dropoffLng" REAL,
    "weightKg" REAL,
    "distanceKm" REAL,
    "pickedUpAt" DATETIME,
    "deliveredAt" DATETIME,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deliveryCode" TEXT,
    "deliveryCodeAttempts" INTEGER NOT NULL DEFAULT 0,
    "deliveryProofDistanceKm" REAL,
    CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Shipment_b2bTransactionId_fkey" FOREIGN KEY ("b2bTransactionId") REFERENCES "B2BTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Shipment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Shipment" ("createdAt", "deliveredAt", "deliveryCode", "deliveryCodeAttempts", "deliveryProofDistanceKm", "distanceKm", "driverId", "dropoffAddress", "dropoffLat", "dropoffLng", "failureReason", "id", "orderId", "pickedUpAt", "pickupAddress", "status", "updatedAt", "weightKg") SELECT "createdAt", "deliveredAt", "deliveryCode", "deliveryCodeAttempts", "deliveryProofDistanceKm", "distanceKm", "driverId", "dropoffAddress", "dropoffLat", "dropoffLng", "failureReason", "id", "orderId", "pickedUpAt", "pickupAddress", "status", "updatedAt", "weightKg" FROM "Shipment";
DROP TABLE "Shipment";
ALTER TABLE "new_Shipment" RENAME TO "Shipment";
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");
CREATE UNIQUE INDEX "Shipment_b2bTransactionId_key" ON "Shipment"("b2bTransactionId");
CREATE INDEX "Shipment_driverId_idx" ON "Shipment"("driverId");
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");
CREATE INDEX "Shipment_status_updatedAt_idx" ON "Shipment"("status", "updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "UserCapability_userId_idx" ON "UserCapability"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCapability_userId_role_key" ON "UserCapability"("userId", "role");

