import {
  LedgerAccountType,
  LedgerEntryStatus,
  LedgerLineDirection,
  PrismaClient,
} from "@prisma/client";

import { prisma } from "./prisma";

type LedgerLineInput = {
  accountId: string;
  direction: LedgerLineDirection;
  amount: number;
};

type PostJournalEntryInput = {
  merchantId: string;
  reference?: string;
  description?: string;
  status?: LedgerEntryStatus;
  postedAt?: Date;
  lines: LedgerLineInput[];
  prismaClient?: PrismaClient;
};

type LedgerInvariantTotals = {
  debitTotal: number;
  creditTotal: number;
};

type MerchantBalances = {
  available: number;
  pending: number;
  fees: number;
};

export const BALANCE_AVAILABLE_ACCOUNT_CODE = "BALANCE_AVAILABLE";
export const BALANCE_PENDING_ACCOUNT_CODE = "BALANCE_PENDING";
export const FEES_ACCOUNT_CODE = "FEES";

export class LedgerInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerInvariantError";
  }
}

function assertValidLineAmounts(lines: LedgerLineInput[]) {
  if (lines.length === 0) {
    throw new LedgerInvariantError("Journal entry must include at least one ledger line.");
  }

  for (const line of lines) {
    if (!Number.isInteger(line.amount) || line.amount <= 0) {
      throw new LedgerInvariantError("Ledger line amounts must be positive integers.");
    }
  }
}

function calculateTotals(lines: LedgerLineInput[]): LedgerInvariantTotals {
  return lines.reduce<LedgerInvariantTotals>(
    (totals, line) => {
      if (line.direction === "DEBIT") {
        totals.debitTotal += line.amount;
      }

      if (line.direction === "CREDIT") {
        totals.creditTotal += line.amount;
      }

      return totals;
    },
    {
      debitTotal: 0,
      creditTotal: 0,
    },
  );
}

export function assertBalancedLines(lines: LedgerLineInput[]): void {
  assertValidLineAmounts(lines);

  const totals = calculateTotals(lines);
  if (totals.debitTotal !== totals.creditTotal) {
    throw new LedgerInvariantError(
      `Journal entry is unbalanced: debits=${totals.debitTotal}, credits=${totals.creditTotal}.`,
    );
  }
}

export async function postJournalEntry(input: PostJournalEntryInput) {
  const {
    merchantId,
    reference,
    description,
    status = "POSTED",
    postedAt = new Date(),
    lines,
    prismaClient = prisma,
  } = input;

  assertBalancedLines(lines);

  const journalEntry = await prismaClient.$transaction(async (tx) => {
    const createdEntry = await tx.ledgerJournalEntry.create({
      data: {
        merchantId,
        reference,
        description,
        status,
        postedAt: status === "POSTED" ? postedAt : null,
      },
    });

    await tx.ledgerLine.createMany({
      data: lines.map((line) => ({
        merchantId,
        journalEntryId: createdEntry.id,
        accountId: line.accountId,
        direction: line.direction,
        amount: line.amount,
      })),
    });

    return tx.ledgerJournalEntry.findUniqueOrThrow({
      where: { id: createdEntry.id },
      include: {
        lines: true,
      },
    });
  });

  return journalEntry;
}

export async function assertJournalEntryBalanced(
  journalEntryId: string,
  prismaClient: PrismaClient = prisma,
): Promise<LedgerInvariantTotals> {
  const lines = await prismaClient.ledgerLine.findMany({
    where: {
      journalEntryId,
    },
    select: {
      direction: true,
      amount: true,
    },
  });

  const typedLines: LedgerLineInput[] = lines.map((line) => ({
    accountId: "",
    direction: line.direction,
    amount: line.amount,
  }));

  assertBalancedLines(typedLines);

  return calculateTotals(typedLines);
}

function normalizeAccountBalance(accountType: LedgerAccountType, debitTotal: number, creditTotal: number) {
  if (accountType === "ASSET" || accountType === "EXPENSE") {
    return debitTotal - creditTotal;
  }

  return creditTotal - debitTotal;
}

export async function getMerchantBalances(
  merchantId: string,
  prismaClient: PrismaClient = prisma,
): Promise<MerchantBalances> {
  const accounts = await prismaClient.ledgerAccount.findMany({
    where: {
      merchantId,
      code: {
        in: [BALANCE_AVAILABLE_ACCOUNT_CODE, BALANCE_PENDING_ACCOUNT_CODE, FEES_ACCOUNT_CODE],
      },
    },
    include: {
      lines: {
        select: {
          direction: true,
          amount: true,
        },
      },
    },
  });

  const balancesByCode = new Map<string, number>();

  for (const account of accounts) {
    const debitTotal = account.lines
      .filter((line) => line.direction === "DEBIT")
      .reduce((sum, line) => sum + line.amount, 0);
    const creditTotal = account.lines
      .filter((line) => line.direction === "CREDIT")
      .reduce((sum, line) => sum + line.amount, 0);

    balancesByCode.set(
      account.code,
      normalizeAccountBalance(account.accountType, debitTotal, creditTotal),
    );
  }

  return {
    available: balancesByCode.get(BALANCE_AVAILABLE_ACCOUNT_CODE) ?? 0,
    pending: balancesByCode.get(BALANCE_PENDING_ACCOUNT_CODE) ?? 0,
    fees: balancesByCode.get(FEES_ACCOUNT_CODE) ?? 0,
  };
}