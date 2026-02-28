-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "responseStatusCode" INTEGER,
    "responseBody" TEXT,
    "responseContentType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    CONSTRAINT "idempotency_records_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "idempotency_records_merchantId_createdAt_idx" ON "idempotency_records"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_merchantId_route_idempotencyKey_key" ON "idempotency_records"("merchantId", "route", "idempotencyKey");
