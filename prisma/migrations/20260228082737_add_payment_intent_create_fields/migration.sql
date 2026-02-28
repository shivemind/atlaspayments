/*
  Warnings:

  - Added the required column `paymentMethodToken` to the `payment_intents` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_payment_intents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUIRES_CONFIRMATION',
    "paymentMethodToken" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payment_intents_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_intents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_payment_intents" ("amount", "createdAt", "currency", "customerId", "description", "id", "idempotencyKey", "merchantId", "metadata", "status", "updatedAt") SELECT "amount", "createdAt", "currency", "customerId", "description", "id", "idempotencyKey", "merchantId", "metadata", "status", "updatedAt" FROM "payment_intents";
DROP TABLE "payment_intents";
ALTER TABLE "new_payment_intents" RENAME TO "payment_intents";
CREATE INDEX "payment_intents_merchantId_createdAt_idx" ON "payment_intents"("merchantId", "createdAt");
CREATE UNIQUE INDEX "payment_intents_merchantId_idempotencyKey_key" ON "payment_intents"("merchantId", "idempotencyKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
