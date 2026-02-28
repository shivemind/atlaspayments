import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const testDbPath = resolve(process.cwd(), "prisma", "task2-test.db");
const testDbUrl = `file:${testDbPath.replace(/\\/g, "/")}`;

process.env.DATABASE_URL = testDbUrl;
process.env.RATE_LIMIT_MAX_REQUESTS = "2";
process.env.RATE_LIMIT_WINDOW_SECONDS = "60";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: testDbUrl,
    },
  },
});

let GET: (request: Request) => Promise<Response>;

function apiKeyHash(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

async function seedApiKey(rawKey: string) {
  const merchant = await prisma.merchant.create({
    data: {
      name: "Task 2 Merchant",
      status: "ACTIVE",
    },
  });

  const keyPrefix = rawKey.slice(0, 10);

  return prisma.apiKey.create({
    data: {
      merchantId: merchant.id,
      name: "Primary key",
      keyType: "SECRET",
      role: "MERCHANT",
      scopes: ["me:read", "payments:read"],
      keyPrefix,
      keyHash: apiKeyHash(rawKey),
      isActive: true,
    },
  });
}

describe("GET /api/v1/me", () => {
  beforeAll(async () => {
    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }

    execSync("pnpm prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: "pipe",
    });

    ({ GET } = await import("../../src/app/api/v1/me/route"));
  });

  beforeEach(async () => {
    await prisma.webhookAttempt.deleteMany();
    await prisma.webhookDelivery.deleteMany();
    await prisma.webhookEndpoint.deleteMany();
    await prisma.ledgerLine.deleteMany();
    await prisma.ledgerJournalEntry.deleteMany();
    await prisma.ledgerAccount.deleteMany();
    await prisma.refund.deleteMany();
    await prisma.paymentIntent.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.merchant.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();

    const { prisma: appPrisma } = await import("../../src/lib/prisma");
    await appPrisma.$disconnect();

    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }
  });

  it("returns 401 when auth header is missing", async () => {
    const response = await GET(new Request("http://localhost/api/v1/me"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("AUTH_REQUIRED");
  });

  it("returns 401 for invalid key", async () => {
    await seedApiKey("sk_test_valid_key_123");

    const response = await GET(
      new Request("http://localhost/api/v1/me", {
        headers: {
          Authorization: "Bearer sk_test_invalid_key",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("INVALID_API_KEY");
  });

  it("returns merchant and key metadata for valid key", async () => {
    await seedApiKey("sk_test_valid_key_456");

    const response = await GET(
      new Request("http://localhost/api/v1/me", {
        headers: {
          Authorization: "Bearer sk_test_valid_key_456",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.merchant.name).toBe("Task 2 Merchant");
    expect(body.apiKey.role).toBe("MERCHANT");
    expect(body.apiKey.scopes).toEqual(["me:read", "payments:read"]);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    await seedApiKey("sk_test_rate_limit_789");

    const request = new Request("http://localhost/api/v1/me", {
      headers: {
        Authorization: "Bearer sk_test_rate_limit_789",
      },
    });

    const first = await GET(request);
    const second = await GET(request);
    const third = await GET(request);
    const body = await third.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});