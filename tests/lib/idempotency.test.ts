import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const testDbPath = resolve(process.cwd(), "prisma", "task3-test.db");
const testDbUrl = `file:${testDbPath.replace(/\\/g, "/")}`;

process.env.DATABASE_URL = testDbUrl;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: testDbUrl,
    },
  },
});

let executeWithIdempotency: typeof import("../../src/lib/idempotency").executeWithIdempotency;
let InMemoryIdempotencyCache: typeof import("../../src/lib/idempotency").InMemoryIdempotencyCache;

describe("Idempotency framework", () => {
  beforeAll(async () => {
    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }

    execSync("pnpm prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: "pipe",
    });

    ({ executeWithIdempotency, InMemoryIdempotencyCache } = await import("../../src/lib/idempotency"));
  });

  beforeEach(async () => {
    await prisma.idempotencyRecord.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.merchant.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();

    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }
  });

  it("replays the exact status/body for same idempotency key and payload", async () => {
    const merchant = await prisma.merchant.create({
      data: {
        name: "Task 3 Merchant",
      },
    });

    const cache = new InMemoryIdempotencyCache();
    let executionCount = 0;

    const firstRequest = new Request("http://localhost/api/v1/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "idem_same_123",
      },
      body: JSON.stringify({ amount: 1000, currency: "USD" }),
    });

    const firstResponse = await executeWithIdempotency({
      request: firstRequest,
      merchantId: merchant.id,
      route: "/api/v1/payments",
      prismaClient: prisma,
      cache,
      execute: async () => {
        executionCount += 1;
        return new Response(JSON.stringify({ paymentId: "pay_123", attempt: executionCount }), {
          status: 201,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    const secondRequest = new Request("http://localhost/api/v1/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "idem_same_123",
      },
      body: JSON.stringify({ amount: 1000, currency: "USD" }),
    });

    const secondResponse = await executeWithIdempotency({
      request: secondRequest,
      merchantId: merchant.id,
      route: "/api/v1/payments",
      prismaClient: prisma,
      cache,
      execute: async () => {
        executionCount += 1;
        return new Response(JSON.stringify({ paymentId: "pay_123", attempt: executionCount }), {
          status: 201,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(await firstResponse.text()).toBe(await secondResponse.text());
    expect(executionCount).toBe(1);
  });

  it("returns deterministic 409 for different payload with same idempotency key", async () => {
    const merchant = await prisma.merchant.create({
      data: {
        name: "Task 3 Merchant",
      },
    });

    const cache = new InMemoryIdempotencyCache();

    const initialRequest = new Request("http://localhost/api/v1/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "idem_conflict_123",
      },
      body: JSON.stringify({ amount: 5000 }),
    });

    await executeWithIdempotency({
      request: initialRequest,
      merchantId: merchant.id,
      route: "/api/v1/payments",
      prismaClient: prisma,
      cache,
      execute: async () =>
        new Response(JSON.stringify({ paymentId: "pay_conflict" }), {
          status: 201,
          headers: {
            "content-type": "application/json",
          },
        }),
    });

    const conflictingRequest = new Request("http://localhost/api/v1/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "idem_conflict_123",
      },
      body: JSON.stringify({ amount: 7000 }),
    });

    const conflictResponse = await executeWithIdempotency({
      request: conflictingRequest,
      merchantId: merchant.id,
      route: "/api/v1/payments",
      prismaClient: prisma,
      cache,
      execute: async () =>
        new Response(JSON.stringify({ paymentId: "should_not_happen" }), {
          status: 201,
          headers: {
            "content-type": "application/json",
          },
        }),
    });

    const conflictBody = await conflictResponse.json();

    expect(conflictResponse.status).toBe(409);
    expect(conflictBody.error.code).toBe("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST");
  });
});