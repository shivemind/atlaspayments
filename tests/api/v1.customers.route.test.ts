import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const testDbPath = resolve(process.cwd(), "prisma", "task4-test.db");
const testDbUrl = `file:${testDbPath.replace(/\\/g, "/")}`;

process.env.DATABASE_URL = testDbUrl;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: testDbUrl,
    },
  },
});

let customersRoute: typeof import("../../src/app/api/v1/customers/route");
let customerByIdRoute: typeof import("../../src/app/api/v1/customers/[id]/route");

function apiKeyHash(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

async function seedMerchantWithApiKey(rawKey: string, merchantName: string) {
  const merchant = await prisma.merchant.create({
    data: {
      name: merchantName,
      status: "ACTIVE",
    },
  });

  await prisma.apiKey.create({
    data: {
      merchantId: merchant.id,
      name: `${merchantName} key`,
      keyType: "SECRET",
      role: "MERCHANT",
      scopes: ["customers:read", "customers:write"],
      keyPrefix: rawKey.slice(0, 10),
      keyHash: apiKeyHash(rawKey),
      isActive: true,
    },
  });

  return merchant;
}

describe("/api/v1/customers", () => {
  beforeAll(async () => {
    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }

    execSync("pnpm prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: "pipe",
    });

    customersRoute = await import("../../src/app/api/v1/customers/route");
    customerByIdRoute = await import("../../src/app/api/v1/customers/[id]/route");
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

  it("creates a customer with valid payload", async () => {
    await seedMerchantWithApiKey("sk_test_customer_create", "Merchant A");

    const response = await customersRoute.POST(
      new Request("http://localhost/api/v1/customers", {
        method: "POST",
        headers: {
          Authorization: "Bearer sk_test_customer_create",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          externalId: "cust_ext_001",
          email: "customer@example.com",
          name: "Jane Customer",
          metadata: {
            tier: "gold",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.customer.id).toBeTypeOf("string");
    expect(body.customer.externalId).toBe("cust_ext_001");
    expect(body.customer.email).toBe("customer@example.com");
    expect(body.customer.name).toBe("Jane Customer");
    expect(body.customer.metadata).toEqual({ tier: "gold" });
  });

  it("lists only authenticated merchant customers with pagination", async () => {
    const merchant = await seedMerchantWithApiKey("sk_test_customer_list", "Merchant A");
    const otherMerchant = await seedMerchantWithApiKey("sk_test_customer_list_other", "Merchant B");

    await prisma.customer.createMany({
      data: [
        {
          merchantId: merchant.id,
          externalId: "m1_c1",
          email: "m1c1@example.com",
          name: "M1 C1",
        },
        {
          merchantId: merchant.id,
          externalId: "m1_c2",
          email: "m1c2@example.com",
          name: "M1 C2",
        },
        {
          merchantId: otherMerchant.id,
          externalId: "m2_c1",
          email: "m2c1@example.com",
          name: "M2 C1",
        },
      ],
    });

    const response = await customersRoute.GET(
      new Request("http://localhost/api/v1/customers?page=1&pageSize=1", {
        method: "GET",
        headers: {
          Authorization: "Bearer sk_test_customer_list",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(1);
    expect(body.pagination.total).toBe(2);
    expect(body.pagination.hasMore).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].merchantId).toBe(merchant.id);
  });

  it("fetches customer by id for same merchant", async () => {
    const merchant = await seedMerchantWithApiKey("sk_test_customer_fetch", "Merchant A");

    const customer = await prisma.customer.create({
      data: {
        merchantId: merchant.id,
        externalId: "cust_fetch_001",
        email: "fetch@example.com",
        name: "Fetch Target",
      },
    });

    const response = await customerByIdRoute.GET(
      new Request(`http://localhost/api/v1/customers/${customer.id}`, {
        method: "GET",
        headers: {
          Authorization: "Bearer sk_test_customer_fetch",
        },
      }),
      { params: Promise.resolve({ id: customer.id }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.customer.id).toBe(customer.id);
    expect(body.customer.externalId).toBe("cust_fetch_001");
  });

  it("returns 404 when accessing another merchant customer", async () => {
    const merchantA = await seedMerchantWithApiKey("sk_test_customer_tenant_a", "Merchant A");
    const merchantB = await seedMerchantWithApiKey("sk_test_customer_tenant_b", "Merchant B");

    const merchantBCustomer = await prisma.customer.create({
      data: {
        merchantId: merchantB.id,
        externalId: "tenant_b_customer",
        email: "tenantb@example.com",
        name: "Tenant B Customer",
      },
    });

    const response = await customerByIdRoute.GET(
      new Request(`http://localhost/api/v1/customers/${merchantBCustomer.id}`, {
        method: "GET",
        headers: {
          Authorization: "Bearer sk_test_customer_tenant_a",
        },
      }),
      { params: Promise.resolve({ id: merchantBCustomer.id }) },
    );
    const body = await response.json();

    expect(merchantA.id).not.toBe(merchantB.id);
    expect(response.status).toBe(404);
    expect(body.error.code).toBe("CUSTOMER_NOT_FOUND");
  });
});