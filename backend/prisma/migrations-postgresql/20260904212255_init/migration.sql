-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'BUYER',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "region" TEXT NOT NULL,
    "department" TEXT,
    "commune" TEXT,
    "locality" TEXT,
    "farmType" TEXT,
    "surfaceHa" DOUBLE PRECISION,
    "capacityKg" DOUBLE PRECISION,
    "photo" TEXT,
    "description" TEXT,
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cooperative" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "responsable" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "zone" TEXT,
    "description" TEXT,
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cooperative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CooperativeMember" (
    "id" SERIAL NOT NULL,
    "cooperativeId" INTEGER NOT NULL,
    "producerId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CooperativeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trader" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyName" TEXT NOT NULL,
    "activity" TEXT,
    "zones" TEXT,
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Processor" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyName" TEXT NOT NULL,
    "zones" TEXT,
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Processor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exporter" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyName" TEXT NOT NULL,
    "capacityKg" DOUBLE PRECISION,
    "zones" TEXT,
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exporter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiceOffer" (
    "id" SERIAL NOT NULL,
    "producerId" INTEGER,
    "cooperativeId" INTEGER,
    "product" TEXT NOT NULL,
    "variety" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "availableFrom" TIMESTAMP(3),
    "quality" TEXT,
    "price" DOUBLE PRECISION,
    "photos" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiceOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" SERIAL NOT NULL,
    "traderId" INTEGER,
    "processorId" INTEGER,
    "exporterId" INTEGER,
    "product" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "period" TEXT,
    "requirements" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" SERIAL NOT NULL,
    "fromUserId" INTEGER NOT NULL,
    "toUserId" INTEGER NOT NULL,
    "offerId" INTEGER,
    "requestId" INTEGER,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "B2BTransaction" (
    "id" SERIAL NOT NULL,
    "contactId" INTEGER,
    "buyerUserId" INTEGER NOT NULL,
    "sellerUserId" INTEGER NOT NULL,
    "product" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'DECLARED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "B2BTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "B2BReport" (
    "id" SERIAL NOT NULL,
    "reporterId" INTEGER NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "B2BReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "B2BReferenceItem" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "B2BReferenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" SERIAL NOT NULL,
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
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "deliveryZones" TEXT,
    "coverImage" TEXT,
    "avatar" TEXT,
    "minOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
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
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractSigned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '5kg',
    "pricePerKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT NOT NULL DEFAULT '[]',
    "badge" TEXT,
    "origin" TEXT,
    "harvest" TEXT,
    "saleType" TEXT NOT NULL DEFAULT 'BOTH',
    "wholesalePrice" DOUBLE PRECISION,
    "minWholesaleQty" INTEGER,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductHistory" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "actorName" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "shopId" INTEGER NOT NULL,
    "driverId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total" DOUBLE PRECISION NOT NULL,
    "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "promoCode" TEXT,
    "address" TEXT NOT NULL,
    "note" TEXT,
    "groupId" TEXT,
    "idempotencyKey" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH_ON_DELIVERY',
    "driverRated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "actorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" SERIAL NOT NULL,
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
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "totalDeliveries" INTEGER NOT NULL DEFAULT 0,
    "acceptanceRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "autoSuspended" BOOLEAN NOT NULL DEFAULT false,
    "monthlyEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "earningsMonth" INTEGER NOT NULL DEFAULT 0,
    "earningsYear" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractSigned" BOOLEAN NOT NULL DEFAULT false,
    "plan" TEXT NOT NULL DEFAULT 'BASIC',

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverOffer" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverMetric" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "deliveries" INTEGER NOT NULL DEFAULT 0,
    "earnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarouselSlide" (
    "id" SERIAL NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarouselSlide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "driverCommission" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "deliveryBasePrice" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "deliveryPricePerKg" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "deliveryPricePerKm" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "deliveryMaxPrice" DOUBLE PRECISION NOT NULL DEFAULT 8000,
    "deliveryFreeAbove" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryLeadDays" INTEGER NOT NULL DEFAULT 1,
    "additionalPickupFee" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "basicPlanPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "certifiedPlanPrice" DOUBLE PRECISION NOT NULL DEFAULT 15000,
    "certifiedMonthlyPrice" DOUBLE PRECISION NOT NULL DEFAULT 1500,
    "driverSubPrice" DOUBLE PRECISION NOT NULL DEFAULT 5000,
    "driverAnnualPrice" DOUBLE PRECISION NOT NULL DEFAULT 48000,
    "basicMaxProducts" INTEGER NOT NULL DEFAULT 0,
    "premiumDriverCommission" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "basicCanAnalytics" BOOLEAN NOT NULL DEFAULT true,
    "shopBasicFeatures" TEXT,
    "shopCertifiedFeatures" TEXT,
    "driverBasicFeatures" TEXT,
    "driverPremiumFeatures" TEXT,
    "offerExpiryMin" INTEGER NOT NULL DEFAULT 15,
    "minDriverRating" DOUBLE PRECISION NOT NULL DEFAULT 3.5,
    "maxOfferAttempts" INTEGER NOT NULL DEFAULT 3,
    "penaltyWarn1Rate" DOUBLE PRECISION NOT NULL DEFAULT 0.70,
    "penaltyWarn2Rate" DOUBLE PRECISION NOT NULL DEFAULT 0.50,
    "penaltySuspendRate" DOUBLE PRECISION NOT NULL DEFAULT 0.30,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "shopId" INTEGER,
    "driverId" INTEGER,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_SIGNATURE',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Abidjan',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundProcessed" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopReview" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminLog" (
    "id" SERIAL NOT NULL,
    "adminId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" INTEGER,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanUpgradeRequest" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "shopId" INTEGER,
    "driverId" INTEGER,
    "fromPlan" TEXT NOT NULL,
    "toPlan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "billingPeriod" TEXT NOT NULL DEFAULT 'monthly',
    "note" TEXT,
    "adminNote" TEXT,
    "amount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanUpgradeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PERCENT',
    "value" DOUBLE PRECISION NOT NULL,
    "minOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxUses" INTEGER NOT NULL DEFAULT 100,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialNote" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER,
    "driverId" INTEGER,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialNote_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "ContactRequest_fromUserId_idx" ON "ContactRequest"("fromUserId");

-- CreateIndex
CREATE INDEX "ContactRequest_toUserId_idx" ON "ContactRequest"("toUserId");

-- CreateIndex
CREATE INDEX "ContactRequest_status_idx" ON "ContactRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "B2BTransaction_contactId_key" ON "B2BTransaction"("contactId");

-- CreateIndex
CREATE INDEX "B2BTransaction_buyerUserId_idx" ON "B2BTransaction"("buyerUserId");

-- CreateIndex
CREATE INDEX "B2BTransaction_sellerUserId_idx" ON "B2BTransaction"("sellerUserId");

-- CreateIndex
CREATE INDEX "B2BTransaction_status_idx" ON "B2BTransaction"("status");

-- CreateIndex
CREATE INDEX "B2BReport_status_idx" ON "B2BReport"("status");

-- CreateIndex
CREATE INDEX "B2BReport_targetType_targetId_idx" ON "B2BReport"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "B2BReferenceItem_type_active_idx" ON "B2BReferenceItem"("type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "B2BReferenceItem_type_value_key" ON "B2BReferenceItem"("type", "value");

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

-- AddForeignKey
ALTER TABLE "Producer" ADD CONSTRAINT "Producer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cooperative" ADD CONSTRAINT "Cooperative_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeMember" ADD CONSTRAINT "CooperativeMember_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeMember" ADD CONSTRAINT "CooperativeMember_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trader" ADD CONSTRAINT "Trader_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Processor" ADD CONSTRAINT "Processor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exporter" ADD CONSTRAINT "Exporter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiceOffer" ADD CONSTRAINT "RiceOffer_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiceOffer" ADD CONSTRAINT "RiceOffer_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "Trader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "Processor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_exporterId_fkey" FOREIGN KEY ("exporterId") REFERENCES "Exporter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "RiceOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B2BTransaction" ADD CONSTRAINT "B2BTransaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ContactRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B2BTransaction" ADD CONSTRAINT "B2BTransaction_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B2BTransaction" ADD CONSTRAINT "B2BTransaction_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B2BReport" ADD CONSTRAINT "B2BReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductHistory" ADD CONSTRAINT "ProductHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverOffer" ADD CONSTRAINT "DriverOffer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverOffer" ADD CONSTRAINT "DriverOffer_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverMetric" ADD CONSTRAINT "DriverMetric_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopReview" ADD CONSTRAINT "ShopReview_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopReview" ADD CONSTRAINT "ShopReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanUpgradeRequest" ADD CONSTRAINT "PlanUpgradeRequest_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialNote" ADD CONSTRAINT "CommercialNote_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialNote" ADD CONSTRAINT "CommercialNote_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialNote" ADD CONSTRAINT "CommercialNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

