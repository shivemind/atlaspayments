import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const testDbPath = resolve(process.cwd(), "prisma", "task5-test.db");
const testDbUrl = `file:${testDbPath.replace(/\\/g, "/")}`;

process.env.DATABASE_URL = testDbUrl;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: testDbUrl,
    },
  },
});

let ledger: typeof import("../../src/lib/ledger");

describe("Ledger service", () => {
  beforeAll(async () => {
    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }

    execSync("pnpm prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: "pipe",
    });

    ledger = await import("../../src/lib/ledger");
  });

  beforeEach(async () => {
    await prisma.ledgerLine.deleteMany();
    await prisma.ledgerJournalEntry.deleteMany();
    await prisma.ledgerAccount.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.merchant.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();

    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }
  });

  it("posting creates a balanced journal entry", async () => {
    const merchant = await prisma.merchant.create({
      data: {
        name: "Task 5 Merchant",
      },
    });

    const availableAccount = await prisma.ledgerAccount.create({
      data: {
        merchantId: merchant.id,
        code: ledger.BALANCE_AVAILABLE_ACCOUNT_CODE,
        name: "Available Balance",
        accountType: "LIABILITY",
        currency: "USD",
      },
    });

    const pendingAccount = await prisma.ledgerAccount.create({
      data: {
        merchantId: merchant.id,
        code: ledger.BALANCE_PENDING_ACCOUNT_CODE,
        name: "Pending Balance",
        accountType: "LIABILITY",
        currency: "USD",
      },
    });

    const journalEntry = await ledger.postJournalEntry({
      merchantId: merchant.id,
      reference: "pay_001",
      description: "Move pending funds to available",
      prismaClient: prisma,
      lines: [
        {
          accountId: pendingAccount.id,
          direction: "DEBIT",
          amount: 1000,
        },
        {
          accountId: availableAccount.id,
          direction: "CREDIT",
          amount: 1000,
        },
      ],
    });

    expect(journalEntry.lines).toHaveLength(2);

    const totals = await ledger.assertJournalEntryBalanced(journalEntry.id, prisma);
    expect(totals.debitTotal).toBe(1000);
    expect(totals.creditTotal).toBe(1000);

    const balances = await ledger.getMerchantBalances(merchant.id, prisma);
    expect(balances.available).toBe(1000);
    expect(balances.pending).toBe(-1000);
    expect(balances.fees).toBe(0);
  });

  it("invariant checker catches imbalance", async () => {
    const merchant = await prisma.merchant.create({
      data: {
        name: "Task 5 Merchant",
      },
    });

    const availableAccount = await prisma.ledgerAccount.create({
      data: {
        merchantId: merchant.id,
        code: ledger.BALANCE_AVAILABLE_ACCOUNT_CODE,
        name: "Available Balance",
        accountType: "LIABILITY",
        currency: "USD",
      },
    });

    const feesAccount = await prisma.ledgerAccount.create({
      data: {
        merchantId: merchant.id,
        code: ledger.FEES_ACCOUNT_CODE,
        name: "Processing Fees",
        accountType: "REVENUE",
        currency: "USD",
      },
    });

    const entry = await prisma.ledgerJournalEntry.create({
      data: {
        merchantId: merchant.id,
        reference: "manual_bad_entry",
        status: "POSTED",
        postedAt: new Date(),
      },
    });

    await prisma.ledgerLine.createMany({
      data: [
        {
          merchantId: merchant.id,
          journalEntryId: entry.id,
          accountId: availableAccount.id,
          direction: "DEBIT",
          amount: 1000,
        },
        {
          merchantId: merchant.id,
          journalEntryId: entry.id,
          accountId: feesAccount.id,
          direction: "CREDIT",
          amount: 900,
        },
      ],
    });

    await expect(ledger.assertJournalEntryBalanced(entry.id, prisma)).rejects.toThrow(
      "Journal entry is unbalanced",
    );
  });
});