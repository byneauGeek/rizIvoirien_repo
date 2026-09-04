-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'BUYER',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiry" DATETIME
);

-- CreateTable
CREATE TABLE "Producer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "region" TEXT NOT NULL,
    "department" TEXT,
    "commune" TEXT,
    "locality" TEXT,
    "farmType" TEXT,
    "surfaceHa" REAL,
    "capacityKg" REAL,
    "photo" TEXT,
    "description" TEXT,
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Producer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cooperative" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "responsable" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "zone" TEXT,
    "description" TEXT,
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cooperative_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CooperativeMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cooperativeId" INTEGER NOT NULL,
    "producerId" INTEGER NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CooperativeMember_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CooperativeMember_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trader" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "companyName" TEXT NOT NULL,
    "activity" TEXT,
    "zones" TEXT,
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Trader_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Processor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "companyName" TEXT NOT NULL,
    "zones" TEXT,
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Processor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Exporter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "companyName" TEXT NOT NULL,
    "capacityKg" REAL,
    "zones" TEXT,
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Exporter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiceOffer" (
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
    "photos" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RiceOffer_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RiceOffer_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "traderId" INTEGER,
    "processorId" INTEGER,
    "exporterId" INTEGER,
    "product" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "period" TEXT,
    "requirements" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseRequest_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "Trader" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseRequest_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "Processor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseRequest_exporterId_fkey" FOREIGN KEY ("exporterId") REFERENCES "Exporter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shop" (
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
    CONSTRAINT "Shop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '5kg',
    "pricePerKg" REAL NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT NOT NULL DEFAULT '[]',
    "badge" TEXT,
    "origin" TEXT,
    "harvest" TEXT,
    "saleType" TEXT NOT NULL DEFAULT 'BOTH',
    "wholesalePrice" REAL,
    "minWholesaleQty" INTEGER,
    "rating" REAL NOT NULL DEFAULT 5.0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "actorName" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
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

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "actorId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "online" BOOLEAN NOT NULL DEFAULT false,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "avatar" TEXT,
    "idNumber" TEXT,
    "idPhoto" TEXT,
    "licenseNumber" TEXT,
    "licenseExpiry" TEXT,
    "licensePhoto" TEXT,
    "vehicleType" TEXT,
    "vehiclePlate" TEXT,
    "vehiclePhoto" TEXT,
    "rating" REAL NOT NULL DEFAULT 5.0,
    "totalDeliveries" INTEGER NOT NULL DEFAULT 0,
    "acceptanceRate" REAL NOT NULL DEFAULT 1.0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "autoSuspended" BOOLEAN NOT NULL DEFAULT false,
    "monthlyEarnings" REAL NOT NULL DEFAULT 0,
    "earningsMonth" INTEGER NOT NULL DEFAULT 0,
    "earningsYear" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractSigned" BOOLEAN NOT NULL DEFAULT false,
    "plan" TEXT NOT NULL DEFAULT 'BASIC',
    CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DriverOffer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DriverOffer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DriverOffer_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DriverMetric" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "driverId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "deliveries" INTEGER NOT NULL DEFAULT 0,
    "earnings" REAL NOT NULL DEFAULT 0,
    "rating" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DriverMetric_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CarouselSlide" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL DEFAULT 'promotion',
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "badge" TEXT,
    "cta" TEXT,
    "ctaLink" TEXT,
    "bg" TEXT NOT NULL DEFAULT '#1B4332',
    "accent" TEXT NOT NULL DEFAULT '#E8A217',
    "image" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
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

-- CreateTable
CREATE TABLE "Subscription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopId" INTEGER NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "amount" REAL NOT NULL,
    CONSTRAINT "Subscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "shopId" INTEGER,
    "driverId" INTEGER,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_SIGNATURE',
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" DATETIME,
    CONSTRAINT "Contract_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Address" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Abidjan',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Wishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "refundAmount" REAL NOT NULL DEFAULT 0,
    "refundProcessed" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Dispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dispute_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShopReview" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopReview_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShopReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "adminId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" INTEGER,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PlanUpgradeRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "shopId" INTEGER,
    "driverId" INTEGER,
    "fromPlan" TEXT NOT NULL,
    "toPlan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "billingPeriod" TEXT NOT NULL DEFAULT 'monthly',
    "note" TEXT,
    "adminNote" TEXT,
    "amount" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanUpgradeRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlanUpgradeRequest_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PERCENT',
    "value" REAL NOT NULL,
    "minOrder" REAL NOT NULL DEFAULT 0,
    "maxUses" INTEGER NOT NULL DEFAULT 100,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CommercialNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopId" INTEGER,
    "driverId" INTEGER,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommercialNote_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommercialNote_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommercialNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Producer_userId_key" ON "Producer"("userId");

-- CreateIndex
CREATE INDEX "Producer_region_idx" ON "Producer"("region");

-- CreateIndex
CREATE INDEX "Producer_verification_idx" ON "Producer"("verification");

-- CreateIndex
CREATE UNIQUE INDEX "Cooperative_userId_key" ON "Cooperative"("userId");

-- CreateIndex
CREATE INDEX "Cooperative_region_idx" ON "Cooperative"("region");

-- CreateIndex
CREATE INDEX "Cooperative_verification_idx" ON "Cooperative"("verification");

-- CreateIndex
CREATE UNIQUE INDEX "CooperativeMember_cooperativeId_producerId_key" ON "CooperativeMember"("cooperativeId", "producerId");

-- CreateIndex
CREATE UNIQUE INDEX "Trader_userId_key" ON "Trader"("userId");

-- CreateIndex
CREATE INDEX "Trader_verification_idx" ON "Trader"("verification");

-- CreateIndex
CREATE UNIQUE INDEX "Processor_userId_key" ON "Processor"("userId");

-- CreateIndex
CREATE INDEX "Processor_verification_idx" ON "Processor"("verification");

-- CreateIndex
CREATE UNIQUE INDEX "Exporter_userId_key" ON "Exporter"("userId");

-- CreateIndex
CREATE INDEX "Exporter_verification_idx" ON "Exporter"("verification");

-- CreateIndex
CREATE INDEX "RiceOffer_status_idx" ON "RiceOffer"("status");

-- CreateIndex
CREATE INDEX "RiceOffer_region_idx" ON "RiceOffer"("region");

-- CreateIndex
CREATE INDEX "RiceOffer_product_idx" ON "RiceOffer"("product");

-- CreateIndex
CREATE INDEX "RiceOffer_producerId_idx" ON "RiceOffer"("producerId");

-- CreateIndex
CREATE INDEX "RiceOffer_cooperativeId_idx" ON "RiceOffer"("cooperativeId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_region_idx" ON "PurchaseRequest"("region");

-- CreateIndex
CREATE INDEX "PurchaseRequest_product_idx" ON "PurchaseRequest"("product");

-- CreateIndex
CREATE INDEX "PurchaseRequest_traderId_idx" ON "PurchaseRequest"("traderId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_processorId_idx" ON "PurchaseRequest"("processorId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_exporterId_idx" ON "PurchaseRequest"("exporterId");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_userId_key" ON "Shop"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_slug_key" ON "Shop"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_shopId_idx" ON "Product"("shopId");

-- CreateIndex
CREATE INDEX "Product_active_idx" ON "Product"("active");

-- CreateIndex
CREATE INDEX "Product_saleType_idx" ON "Product"("saleType");

-- CreateIndex
CREATE INDEX "Order_buyerId_idx" ON "Order"("buyerId");

-- CreateIndex
CREATE INDEX "Order_shopId_idx" ON "Order"("shopId");

-- CreateIndex
CREATE INDEX "Order_driverId_idx" ON "Order"("driverId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_groupId_idx" ON "Order"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_buyerId_idempotencyKey_key" ON "Order"("buyerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_inviteCode_key" ON "Driver"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "DriverOffer_orderId_key" ON "DriverOffer"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverMetric_driverId_month_year_key" ON "DriverMetric"("driverId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_shopId_key" ON "Subscription"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_shopId_key" ON "Contract"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_driverId_key" ON "Contract"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Review_productId_userId_key" ON "Review"("productId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_userId_productId_key" ON "Wishlist"("userId", "productId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_orderId_key" ON "Dispute"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopReview_shopId_userId_key" ON "ShopReview"("shopId", "userId");

-- CreateIndex
CREATE INDEX "PlanUpgradeRequest_status_idx" ON "PlanUpgradeRequest"("status");

-- CreateIndex
CREATE INDEX "PlanUpgradeRequest_type_idx" ON "PlanUpgradeRequest"("type");

-- CreateIndex
CREATE INDEX "PlanUpgradeRequest_shopId_idx" ON "PlanUpgradeRequest"("shopId");

-- CreateIndex
CREATE INDEX "PlanUpgradeRequest_driverId_idx" ON "PlanUpgradeRequest"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "CommercialNote_shopId_idx" ON "CommercialNote"("shopId");

-- CreateIndex
CREATE INDEX "CommercialNote_driverId_idx" ON "CommercialNote"("driverId");

