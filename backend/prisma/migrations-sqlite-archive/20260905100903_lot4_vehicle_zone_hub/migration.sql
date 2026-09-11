-- CreateTable
CREATE TABLE "VehicleType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "capacityKg" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Hub" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "zoneId" INTEGER,
    "latitude" REAL,
    "longitude" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Hub_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Shop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "businessName" TEXT,
    "rccm" TEXT,
    "description" TEXT,
    "speciality" TEXT,
    "since" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "location" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "deliveryZones" TEXT,
    "coverImage" TEXT,
    "avatar" TEXT,
    "minOrder" REAL NOT NULL DEFAULT 0,
    "preparationTime" INTEGER NOT NULL DEFAULT 30,
    "openingHours" TEXT,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "pauseNote" TEXT,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyLowStock" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "paymentMethods" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT,
    "announcement" TEXT,
    "announcementActive" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "plan" TEXT NOT NULL DEFAULT 'BASIC',
    "certified" BOOLEAN NOT NULL DEFAULT false,
    "rating" REAL NOT NULL DEFAULT 5.0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractSigned" BOOLEAN NOT NULL DEFAULT false,
    "zoneId" INTEGER,
    CONSTRAINT "Shop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Shop_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Shop" ("active", "announcement", "announcementActive", "avatar", "businessName", "certified", "contractSigned", "coverImage", "createdAt", "deliveryZones", "description", "email", "facebook", "id", "instagram", "latitude", "location", "longitude", "minOrder", "name", "notifyEmail", "notifyLowStock", "openingHours", "pauseNote", "paused", "paymentMethods", "phone", "plan", "preparationTime", "rating", "rccm", "reviewCount", "since", "slug", "speciality", "status", "tags", "userId", "whatsapp") SELECT "active", "announcement", "announcementActive", "avatar", "businessName", "certified", "contractSigned", "coverImage", "createdAt", "deliveryZones", "description", "email", "facebook", "id", "instagram", "latitude", "location", "longitude", "minOrder", "name", "notifyEmail", "notifyLowStock", "openingHours", "pauseNote", "paused", "paymentMethods", "phone", "plan", "preparationTime", "rating", "rccm", "reviewCount", "since", "slug", "speciality", "status", "tags", "userId", "whatsapp" FROM "Shop";
DROP TABLE "Shop";
ALTER TABLE "new_Shop" RENAME TO "Shop";
CREATE UNIQUE INDEX "Shop_userId_key" ON "Shop"("userId");
CREATE UNIQUE INDEX "Shop_slug_key" ON "Shop"("slug");
CREATE INDEX "Shop_zoneId_idx" ON "Shop"("zoneId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "VehicleType_code_key" ON "VehicleType"("code");

-- CreateIndex
CREATE INDEX "Hub_zoneId_idx" ON "Hub"("zoneId");

