import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";

const absoluteDbPath = resolve(process.cwd(), "prisma", "test.db").replace(/\\/g, "/");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${absoluteDbPath}`,
    },
  },
});

describe("Prisma connectivity", () => {
  it("connects and runs a trivial query", async () => {
    const rows = await prisma.$queryRaw<Array<{ value: bigint }>>`SELECT 1 as value`;
    expect(rows[0]?.value).toBe(1n);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});