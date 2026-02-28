import { NextResponse } from "next/server";

import { authenticateApiKey } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id } = await context.params;

  const customer = await prisma.customer.findFirst({
    where: {
      id,
      merchantId: authResult.merchant.id,
    },
  });

  if (!customer) {
    return NextResponse.json(
      {
        error: {
          code: "CUSTOMER_NOT_FOUND",
          message: "Customer not found.",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ customer: customerResponse(customer) });
}