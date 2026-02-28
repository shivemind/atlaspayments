import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateApiKey } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

const createCustomerSchema = z.object({
  externalId: z.string().min(1).max(128).optional(),
  email: z.email().max(320).optional(),
  name: z.string().min(1).max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

function customerResponse(customer: {
  id: string;
  merchantId: string;
  externalId: string | null;
  email: string | null;
  name: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: customer.id,
    merchantId: customer.merchantId,
    externalId: customer.externalId,
    email: customer.email,
    name: customer.name,
    metadata: customer.metadata,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

export async function POST(request: Request) {
  const authResult = await authenticateApiKey(request);

  if (!authResult.ok) {
    return NextResponse.json(
      {
        error: {
          code: authResult.code,
          message: authResult.message,
        },
      },
      { status: authResult.status },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createCustomerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Request body validation failed.",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const customer = await prisma.customer.create({
    data: {
      merchantId: authResult.merchant.id,
      externalId: parsed.data.externalId,
      email: parsed.data.email,
      name: parsed.data.name,
      metadata: parsed.data.metadata,
    },
  });

  return NextResponse.json({ customer: customerResponse(customer) }, { status: 201 });
}

export async function GET(request: Request) {
  const authResult = await authenticateApiKey(request);

  if (!authResult.ok) {
    return NextResponse.json(
      {
        error: {
          code: authResult.code,
          message: authResult.message,
        },
      },
      { status: authResult.status },
    );
  }

  const url = new URL(request.url);
  const parsedQuery = listCustomersQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_QUERY",
          message: "Query validation failed.",
          details: parsedQuery.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const { page, pageSize } = parsedQuery.data;
  const skip = (page - 1) * pageSize;

  const [total, customers] = await Promise.all([
    prisma.customer.count({
      where: {
        merchantId: authResult.merchant.id,
      },
    }),
    prisma.customer.findMany({
      where: {
        merchantId: authResult.merchant.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    data: customers.map(customerResponse),
    pagination: {
      page,
      pageSize,
      total,
      hasMore: skip + customers.length < total,
    },
  });
}