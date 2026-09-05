-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RouteStop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "routeId" INTEGER NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "arrivedAt" DATETIME,
    "departedAt" DATETIME,
    "failureReason" TEXT,
    CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RouteStop_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RouteStop" ("arrivedAt", "departedAt", "failureReason", "id", "order", "routeId", "shipmentId", "status") SELECT "arrivedAt", "departedAt", "failureReason", "id", "order", "routeId", "shipmentId", "status" FROM "RouteStop";
DROP TABLE "RouteStop";
ALTER TABLE "new_RouteStop" RENAME TO "RouteStop";
CREATE UNIQUE INDEX "RouteStop_shipmentId_key" ON "RouteStop"("shipmentId");
CREATE INDEX "RouteStop_routeId_idx" ON "RouteStop"("routeId");
CREATE UNIQUE INDEX "RouteStop_routeId_order_key" ON "RouteStop"("routeId", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
