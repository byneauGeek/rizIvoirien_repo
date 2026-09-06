-- CreateTable
CREATE TABLE "CooperativeInvoice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cooperativeId" INTEGER NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CooperativeInvoice_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CooperativeInvoice_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "B2BTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CooperativeInvoice_transactionId_key" ON "CooperativeInvoice"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "CooperativeInvoice_invoiceNumber_key" ON "CooperativeInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "CooperativeInvoice_cooperativeId_idx" ON "CooperativeInvoice"("cooperativeId");
