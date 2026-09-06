-- CreateTable
CREATE TABLE "CooperativeLedgerEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cooperativeId" INTEGER NOT NULL,
    "producerId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "sourceType" TEXT,
    "sourceId" INTEGER,
    "reference" TEXT,
    "description" TEXT,
    "authorUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CooperativeLedgerEntry_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CooperativeLedgerEntry_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cooperative" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "responsable" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "zone" TEXT,
    "description" TEXT,
    "documentUrl" TEXT,
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "rejectionReason" TEXT,
    "commissionRate" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cooperative_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Cooperative" ("createdAt", "description", "documentUrl", "id", "name", "region", "rejectionReason", "responsable", "updatedAt", "userId", "verification", "zone") SELECT "createdAt", "description", "documentUrl", "id", "name", "region", "rejectionReason", "responsable", "updatedAt", "userId", "verification", "zone" FROM "Cooperative";
DROP TABLE "Cooperative";
ALTER TABLE "new_Cooperative" RENAME TO "Cooperative";
CREATE UNIQUE INDEX "Cooperative_userId_key" ON "Cooperative"("userId");
CREATE INDEX "Cooperative_region_idx" ON "Cooperative"("region");
CREATE INDEX "Cooperative_verification_idx" ON "Cooperative"("verification");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CooperativeLedgerEntry_cooperativeId_producerId_idx" ON "CooperativeLedgerEntry"("cooperativeId", "producerId");

-- CreateIndex
CREATE INDEX "CooperativeLedgerEntry_sourceType_sourceId_idx" ON "CooperativeLedgerEntry"("sourceType", "sourceId");
