-- CreateTable
CREATE TABLE "ContractSignature" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "signerUserId" INTEGER NOT NULL,
    "signedByName" TEXT NOT NULL,
    "contentSnapshot" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractSignature_contractId_idx" ON "ContractSignature"("contractId");

-- CreateIndex
CREATE INDEX "ContractSignature_signerUserId_idx" ON "ContractSignature"("signerUserId");

-- AddForeignKey
ALTER TABLE "ContractSignature" ADD CONSTRAINT "ContractSignature_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractSignature" ADD CONSTRAINT "ContractSignature_signerUserId_fkey" FOREIGN KEY ("signerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

