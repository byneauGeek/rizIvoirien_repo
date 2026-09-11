-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CooperativeMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cooperativeId" INTEGER NOT NULL,
    "producerId" INTEGER NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    CONSTRAINT "CooperativeMember_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CooperativeMember_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CooperativeMember" ("cooperativeId", "id", "joinedAt", "producerId") SELECT "cooperativeId", "id", "joinedAt", "producerId" FROM "CooperativeMember";
DROP TABLE "CooperativeMember";
ALTER TABLE "new_CooperativeMember" RENAME TO "CooperativeMember";
CREATE INDEX "CooperativeMember_cooperativeId_active_idx" ON "CooperativeMember"("cooperativeId", "active");
CREATE UNIQUE INDEX "CooperativeMember_cooperativeId_producerId_key" ON "CooperativeMember"("cooperativeId", "producerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
