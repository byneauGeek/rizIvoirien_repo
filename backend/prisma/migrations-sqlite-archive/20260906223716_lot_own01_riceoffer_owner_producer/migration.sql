-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RiceOffer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "producerId" INTEGER,
    "cooperativeId" INTEGER,
    "product" TEXT NOT NULL,
    "variety" TEXT,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "availableFrom" DATETIME,
    "quality" TEXT,
    "price" REAL,
    "minOrderQty" REAL,
    "photos" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "ownerProducerId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RiceOffer_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RiceOffer_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RiceOffer_ownerProducerId_fkey" FOREIGN KEY ("ownerProducerId") REFERENCES "Producer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RiceOffer" ("availableFrom", "cooperativeId", "createdAt", "id", "minOrderQty", "photos", "price", "producerId", "product", "quality", "quantity", "region", "status", "unit", "updatedAt", "variety") SELECT "availableFrom", "cooperativeId", "createdAt", "id", "minOrderQty", "photos", "price", "producerId", "product", "quality", "quantity", "region", "status", "unit", "updatedAt", "variety" FROM "RiceOffer";
DROP TABLE "RiceOffer";
ALTER TABLE "new_RiceOffer" RENAME TO "RiceOffer";
CREATE INDEX "RiceOffer_status_idx" ON "RiceOffer"("status");
CREATE INDEX "RiceOffer_region_idx" ON "RiceOffer"("region");
CREATE INDEX "RiceOffer_product_idx" ON "RiceOffer"("product");
CREATE INDEX "RiceOffer_producerId_idx" ON "RiceOffer"("producerId");
CREATE INDEX "RiceOffer_cooperativeId_idx" ON "RiceOffer"("cooperativeId");
CREATE INDEX "RiceOffer_ownerProducerId_idx" ON "RiceOffer"("ownerProducerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
