/*
  Warnings:

  - Added the required column `scopes` to the `api_keys` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyType" TEXT NOT NULL DEFAULT 'SECRET',
    "role" TEXT NOT NULL DEFAULT 'MERCHANT',
    "scopes" JSONB NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "api_keys_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_api_keys" ("createdAt", "id", "isActive", "keyHash", "keyPrefix", "keyType", "lastUsedAt", "merchantId", "name", "updatedAt") SELECT "createdAt", "id", "isActive", "keyHash", "keyPrefix", "keyType", "lastUsedAt", "merchantId", "name", "updatedAt" FROM "api_keys";
DROP TABLE "api_keys";
ALTER TABLE "new_api_keys" RENAME TO "api_keys";
CREATE INDEX "api_keys_merchantId_createdAt_idx" ON "api_keys"("merchantId", "createdAt");
CREATE UNIQUE INDEX "api_keys_merchantId_keyHash_key" ON "api_keys"("merchantId", "keyHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
