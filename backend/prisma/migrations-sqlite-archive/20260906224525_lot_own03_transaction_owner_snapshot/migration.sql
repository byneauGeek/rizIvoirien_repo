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
    "ownerProducerId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "needsLogistics" BOOLEAN NOT NULL DEFAULT false,
    "deliveryAddress" TEXT,
    "deliveryFee" REAL,
    "serviceLevel" TEXT NOT NULL DEFAULT 'STANDARD',
    "deliveryInternalCost" REAL,
    "deliveryMargin" REAL,
    CONSTRAINT "B2BTransaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ContactRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "B2BTransaction_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "B2BTransaction_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "B2BTransaction_ownerProducerId_fkey" FOREIGN KEY ("ownerProducerId") REFERENCES "Producer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_B2BTransaction" ("amount", "buyerUserId", "contactId", "createdAt", "deliveryAddress", "deliveryFee", "deliveryInternalCost", "deliveryMargin", "id", "needsLogistics", "notes", "product", "quantity", "region", "sellerUserId", "serviceLevel", "status", "unit") SELECT "amount", "buyerUserId", "contactId", "createdAt", "deliveryAddress", "deliveryFee", "deliveryInternalCost", "deliveryMargin", "id", "needsLogistics", "notes", "product", "quantity", "region", "sellerUserId", "serviceLevel", "status", "unit" FROM "B2BTransaction";
DROP TABLE "B2BTransaction";
ALTER TABLE "new_B2BTransaction" RENAME TO "B2BTransaction";
CREATE UNIQUE INDEX "B2BTransaction_contactId_key" ON "B2BTransaction"("contactId");
CREATE INDEX "B2BTransaction_buyerUserId_idx" ON "B2BTransaction"("buyerUserId");
CREATE INDEX "B2BTransaction_sellerUserId_idx" ON "B2BTransaction"("sellerUserId");
CREATE INDEX "B2BTransaction_status_idx" ON "B2BTransaction"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
