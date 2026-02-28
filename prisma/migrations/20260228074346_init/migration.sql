-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyType" TEXT NOT NULL DEFAULT 'SECRET',
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "api_keys_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "externalId" TEXT,
    "email" TEXT,
    "name" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "customers_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payment_intents_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_intents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "refunds_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "refunds_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "payment_intents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ledger_accounts_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ledger_journal_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "postedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ledger_journal_entries_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ledger_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ledger_lines_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ledger_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "ledger_journal_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ledger_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ledger_accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "eventTypes" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "webhook_endpoints_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "webhookEndpointId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveredAt" DATETIME,
    "nextAttemptAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "webhook_deliveries_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "webhook_deliveries_webhookEndpointId_fkey" FOREIGN KEY ("webhookEndpointId") REFERENCES "webhook_endpoints" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "webhook_attempts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "requestBody" JSONB,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "webhook_attempts_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "webhook_attempts_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "webhook_deliveries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "api_keys_merchantId_createdAt_idx" ON "api_keys"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_merchantId_keyHash_key" ON "api_keys"("merchantId", "keyHash");

-- CreateIndex
CREATE INDEX "customers_merchantId_createdAt_idx" ON "customers"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "customers_merchantId_externalId_key" ON "customers"("merchantId", "externalId");

-- CreateIndex
CREATE INDEX "payment_intents_merchantId_createdAt_idx" ON "payment_intents"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_merchantId_idempotencyKey_key" ON "payment_intents"("merchantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "refunds_merchantId_createdAt_idx" ON "refunds"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "ledger_accounts_merchantId_createdAt_idx" ON "ledger_accounts"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_merchantId_code_key" ON "ledger_accounts"("merchantId", "code");

-- CreateIndex
CREATE INDEX "ledger_journal_entries_merchantId_createdAt_idx" ON "ledger_journal_entries"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "ledger_lines_merchantId_createdAt_idx" ON "ledger_lines"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "ledger_lines_journalEntryId_idx" ON "ledger_lines"("journalEntryId");

-- CreateIndex
CREATE INDEX "ledger_lines_accountId_idx" ON "ledger_lines"("accountId");

-- CreateIndex
CREATE INDEX "webhook_endpoints_merchantId_createdAt_idx" ON "webhook_endpoints"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "webhook_deliveries_merchantId_createdAt_idx" ON "webhook_deliveries"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "webhook_attempts_merchantId_createdAt_idx" ON "webhook_attempts"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_attempts_deliveryId_attemptNumber_key" ON "webhook_attempts"("deliveryId", "attemptNumber");
