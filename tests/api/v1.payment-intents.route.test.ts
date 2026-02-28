import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const testDbPath = resolve(process.cwd(), "prisma", "task6-test.db");
const testDbUrl = `file:${testDbPath.replace(/\\/g, "/")}`;

process.env.DATABASE_URL = testDbUrl;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: testDbUrl,
    },
  },
});

let POST: (request: Request) => Promise<Response>;

function apiKeyHash(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

async function seedMerchantWithAuth(rawKey: string) {
  const merchant = await prisma.merchant.create({
    data: {
      name: "Task 6 Merchant",
      status: "ACTIVE",
    },
  });

  await prisma.apiKey.create({
    data: {
      merchantId: merchant.id,
      name: "Task 6 Key",
      keyType: "SECRET",
      role: "MERCHANT",
      scopes: ["payment_intents:write"],
      keyPrefix: rawKey.slice(0, 10),
      keyHash: apiKeyHash(rawKey),
      isActive: true,
    },
  });

  return merchant;
}

describe("POST /api/v1/payment_intents", () => {
  beforeAll(async () => {
    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }

    execSync("pnpm prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: "pipe",
    });

    ({ POST } = await import("../../src/app/api/v1/payment_intents/route"));
  });

  beforeEach(async () => {
    await prisma.webhookAttempt.deleteMany();
    await prisma.webhookDelivery.deleteMany();
    await prisma.webhookEndpoint.deleteMany();
    await prisma.idempotencyRecord.deleteMany();
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

  it("creates payment intent in requires_confirmation status", async () => {
    const merchant = await seedMerchantWithAuth("sk_test_pi_create");
    const customer = await prisma.customer.create({
      data: {
        merchantId: merchant.id,
        externalId: "cust_pi_001",
        email: "pi@example.com",
        name: "PI Customer",
      },
    });

    await prisma.webhookEndpoint.create({
      data: {
        merchantId: merchant.id,
        url: "https://example.com/webhooks",
        secret: "whsec_test_123",
        isActive: true,
        eventTypes: ["payment_intent.created"],
      },
    });

    const response = await POST(
      new Request("http://localhost/api/v1/payment_intents", {
        method: "POST",
        headers: {
          Authorization: "Bearer sk_test_pi_create",
          "content-type": "application/json",
          "idempotency-key": "pi_create_key_1",
        },
        body: JSON.stringify({
          amount: 2500,
          currency: "usd",
          customer_id: customer.id,
          payment_method_token: "pm_tok_visa",
          metadata: { order_id: "ord_123" },
        }),
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.payment_intent.status).toBe("requires_confirmation");
    expect(body.payment_intent.amount).toBe(2500);
    expect(body.payment_intent.currency).toBe("USD");
    expect(body.payment_intent.customer_id).toBe(customer.id);
    expect(body.payment_intent.payment_method_token).toBe("pm_tok_visa");
  });

  it("is idempotent on create with same key and payload", async () => {
    const merchant = await seedMerchantWithAuth("sk_test_pi_idempotent");
    const customer = await prisma.customer.create({
      data: {
        merchantId: merchant.id,
        externalId: "cust_pi_002",
      },
    });

    await prisma.webhookEndpoint.create({
      data: {
        merchantId: merchant.id,
        url: "https://example.com/webhooks",
        secret: "whsec_test_456",
        isActive: true,
        eventTypes: ["payment_intent.created"],
      },
    });

    const makeRequest = () =>
      new Request("http://localhost/api/v1/payment_intents", {
        method: "POST",
        headers: {
          Authorization: "Bearer sk_test_pi_idempotent",
          "content-type": "application/json",
          "idempotency-key": "pi_create_key_same",
        },
        body: JSON.stringify({
          amount: 3200,
          currency: "USD",
          customer_id: customer.id,
          payment_method_token: "pm_tok_mastercard",
          metadata: { source: "checkout" },
        }),
      });

    const first = await POST(makeRequest());
    const firstBody = await first.json();

    const second = await POST(makeRequest());
    const secondBody = await second.json();

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(firstBody.payment_intent.id).toBe(secondBody.payment_intent.id);

    const paymentIntentCount = await prisma.paymentIntent.count({
      where: {
        merchantId: merchant.id,
      },
    });

    const deliveryCount = await prisma.webhookDelivery.count({
      where: {
        merchantId: merchant.id,
      },
    });

    expect(paymentIntentCount).toBe(1);
    expect(deliveryCount).toBe(1);
  });

  it("creates queued webhook delivery record for payment_intent.created", async () => {
    const merchant = await seedMerchantWithAuth("sk_test_pi_webhook");
    const customer = await prisma.customer.create({
      data: {
        merchantId: merchant.id,
        externalId: "cust_pi_003",
      },
    });

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        merchantId: merchant.id,
        url: "https://example.com/payment-webhooks",
        secret: "whsec_test_789",
        isActive: true,
        eventTypes: ["payment_intent.created", "refund.created"],
      },
    });

    const response = await POST(
      new Request("http://localhost/api/v1/payment_intents", {
        method: "POST",
        headers: {
          Authorization: "Bearer sk_test_pi_webhook",
          "content-type": "application/json",
          "idempotency-key": "pi_create_key_webhook",
        },
        body: JSON.stringify({
          amount: 4100,
          currency: "USD",
          customer_id: customer.id,
          payment_method_token: "pm_tok_amex",
        }),
      }),
    );

    expect(response.status).toBe(201);

    const deliveries = await prisma.webhookDelivery.findMany({
      where: {
        merchantId: merchant.id,
      },
    });

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]?.webhookEndpointId).toBe(endpoint.id);
    expect(deliveries[0]?.eventType).toBe("payment_intent.created");
    expect(deliveries[0]?.status).toBe("PENDING");
  });
});