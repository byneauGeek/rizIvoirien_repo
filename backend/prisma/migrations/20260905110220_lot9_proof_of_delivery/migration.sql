-- CreateTable
CREATE TABLE "DriverLocationHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "driverId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "accuracy" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DriverLocationHistory_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlatformSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "commissionRate" REAL NOT NULL DEFAULT 0.05,
    "driverCommission" REAL NOT NULL DEFAULT 0.15,
    "deliveryBasePrice" REAL NOT NULL DEFAULT 500,
    "deliveryPricePerKg" REAL NOT NULL DEFAULT 25,
    "deliveryPricePerKm" REAL NOT NULL DEFAULT 100,
    "deliveryMaxPrice" REAL NOT NULL DEFAULT 8000,
    "deliveryFreeAbove" REAL NOT NULL DEFAULT 0,
    "deliveryLeadDays" INTEGER NOT NULL DEFAULT 1,
    "additionalPickupFee" REAL NOT NULL DEFAULT 500,
    "deliveryAvgSpeedKmh" REAL NOT NULL DEFAULT 20,
    "gpsHistoryRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "basicPlanPrice" REAL NOT NULL DEFAULT 0,
    "certifiedPlanPrice" REAL NOT NULL DEFAULT 15000,
    "certifiedMonthlyPrice" REAL NOT NULL DEFAULT 1500,
    "driverSubPrice" REAL NOT NULL DEFAULT 5000,
    "driverAnnualPrice" REAL NOT NULL DEFAULT 48000,
    "basicMaxProducts" INTEGER NOT NULL DEFAULT 0,
    "premiumDriverCommission" REAL NOT NULL DEFAULT 0.20,
    "basicCanAnalytics" BOOLEAN NOT NULL DEFAULT true,
    "shopBasicFeatures" TEXT,
    "shopCertifiedFeatures" TEXT,
    "driverBasicFeatures" TEXT,
    "driverPremiumFeatures" TEXT,
    "offerExpiryMin" INTEGER NOT NULL DEFAULT 15,
    "minDriverRating" REAL NOT NULL DEFAULT 3.5,
    "maxOfferAttempts" INTEGER NOT NULL DEFAULT 3,
    "penaltyWarn1Rate" REAL NOT NULL DEFAULT 0.70,
    "penaltyWarn2Rate" REAL NOT NULL DEFAULT 0.50,
    "penaltySuspendRate" REAL NOT NULL DEFAULT 0.30,
    "autoValidateOrders" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "supportEmail" TEXT NOT NULL DEFAULT 'support@rizivoirien.ci',
    "supportPhone" TEXT NOT NULL DEFAULT '+225 07 00 00 00',
    "seoTitle" TEXT NOT NULL DEFAULT 'RizIvoirien — Marketplace de riz en Côte d''Ivoire',
    "seoDescription" TEXT NOT NULL DEFAULT 'Achetez du riz de qualité directement auprès de coopératives ivoiriennes. Livraison rapide à Abidjan et dans toute la Côte d''Ivoire.',
    "seoKeywords" TEXT NOT NULL DEFAULT 'riz ivoirien, achat riz, marketplace riz, Côte d''Ivoire, livraison riz Abidjan',
    "seoOgImage" TEXT NOT NULL DEFAULT '',
    "seoCanonicalDomain" TEXT NOT NULL DEFAULT 'https://rizivoirien.ci',
    "seoGoogleId" TEXT NOT NULL DEFAULT '',
    "seoFbPixelId" TEXT NOT NULL DEFAULT '',
    "seoRobotsIndex" BOOLEAN NOT NULL DEFAULT true,
    "seoSitemapEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PlatformSettings" ("additionalPickupFee", "autoValidateOrders", "basicCanAnalytics", "basicMaxProducts", "basicPlanPrice", "certifiedMonthlyPrice", "certifiedPlanPrice", "commissionRate", "deliveryAvgSpeedKmh", "deliveryBasePrice", "deliveryFreeAbove", "deliveryLeadDays", "deliveryMaxPrice", "deliveryPricePerKg", "deliveryPricePerKm", "driverAnnualPrice", "driverBasicFeatures", "driverCommission", "driverPremiumFeatures", "driverSubPrice", "id", "maintenanceMode", "maxOfferAttempts", "minDriverRating", "offerExpiryMin", "penaltySuspendRate", "penaltyWarn1Rate", "penaltyWarn2Rate", "premiumDriverCommission", "seoCanonicalDomain", "seoDescription", "seoFbPixelId", "seoGoogleId", "seoKeywords", "seoOgImage", "seoRobotsIndex", "seoSitemapEnabled", "seoTitle", "shopBasicFeatures", "shopCertifiedFeatures", "supportEmail", "supportPhone", "updatedAt") SELECT "additionalPickupFee", "autoValidateOrders", "basicCanAnalytics", "basicMaxProducts", "basicPlanPrice", "certifiedMonthlyPrice", "certifiedPlanPrice", "commissionRate", "deliveryAvgSpeedKmh", "deliveryBasePrice", "deliveryFreeAbove", "deliveryLeadDays", "deliveryMaxPrice", "deliveryPricePerKg", "deliveryPricePerKm", "driverAnnualPrice", "driverBasicFeatures", "driverCommission", "driverPremiumFeatures", "driverSubPrice", "id", "maintenanceMode", "maxOfferAttempts", "minDriverRating", "offerExpiryMin", "penaltySuspendRate", "penaltyWarn1Rate", "penaltyWarn2Rate", "premiumDriverCommission", "seoCanonicalDomain", "seoDescription", "seoFbPixelId", "seoGoogleId", "seoKeywords", "seoOgImage", "seoRobotsIndex", "seoSitemapEnabled", "seoTitle", "shopBasicFeatures", "shopCertifiedFeatures", "supportEmail", "supportPhone", "updatedAt" FROM "PlatformSettings";
DROP TABLE "PlatformSettings";
ALTER TABLE "new_PlatformSettings" RENAME TO "PlatformSettings";
CREATE TABLE "new_Shipment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
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
    CONSTRAINT "Shipment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Shipment" ("createdAt", "deliveredAt", "distanceKm", "driverId", "dropoffAddress", "dropoffLat", "dropoffLng", "failureReason", "id", "orderId", "pickedUpAt", "pickupAddress", "status", "updatedAt", "weightKg") SELECT "createdAt", "deliveredAt", "distanceKm", "driverId", "dropoffAddress", "dropoffLat", "dropoffLng", "failureReason", "id", "orderId", "pickedUpAt", "pickupAddress", "status", "updatedAt", "weightKg" FROM "Shipment";
DROP TABLE "Shipment";
ALTER TABLE "new_Shipment" RENAME TO "Shipment";
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");
CREATE INDEX "Shipment_driverId_idx" ON "Shipment"("driverId");
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DriverLocationHistory_driverId_createdAt_idx" ON "DriverLocationHistory"("driverId", "createdAt");

-- CreateIndex
CREATE INDEX "DriverLocationHistory_orderId_idx" ON "DriverLocationHistory"("orderId");

