import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateApiKey } from "../../../../lib/auth";
import { executeWithIdempotency } from "../../../../lib/idempotency";
import { prisma } from "../../../../lib/prisma";

const createPaymentIntentSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  customer_id: z.string().min(1).optional(),
  payment_method_token: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function paymentIntentResponse(paymentIntent: {
  id: string;
  merchantId: string;
  customerId: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethodToken: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: paymentIntent.id,
    merchant_id: paymentIntent.merchantId,
    customer_id: paymentIntent.customerId,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: paymentIntent.status.toLowerCase(),
    payment_method_token: paymentIntent.paymentMethodToken,
    metadata: paymentIntent.metadata,
    created_at: paymentIntent.createdAt.toISOString(),
    updated_at: paymentIntent.updatedAt.toISOString(),
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

  const body = await request.clone().json().catch(() => null);
  const parsed = createPaymentIntentSchema.safeParse(body);

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

  const merchantId = authResult.merchant.id;

  if (parsed.data.customer_id) {
    const customer = await prisma.customer.findFirst({
      where: {
        id: parsed.data.customer_id,
        merchantId,
      },
      select: { id: true },
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
  }

  const route = "/api/v1/payment_intents";

  return executeWithIdempotency({
    request,
    merchantId,
    route,
    execute: async () => {
      const idempotencyKey = request.headers.get("idempotency-key") ?? "";

      const paymentIntent = await prisma.$transaction(async (tx) => {
        const created = await tx.paymentIntent.create({
          data: {
            merchantId,
            customerId: parsed.data.customer_id,
            amount: parsed.data.amount,
            currency: parsed.data.currency,
            status: "REQUIRES_CONFIRMATION",
            paymentMethodToken: parsed.data.payment_method_token,
            idempotencyKey,
            metadata: parsed.data.metadata,
          },
        });

        const endpoints = await tx.webhookEndpoint.findMany({
          where: {
            merchantId,
            isActive: true,
          },
          select: {
            id: true,
            eventTypes: true,
          },
        });

        const deliveryRows = endpoints
          .filter((endpoint) => {
            if (!Array.isArray(endpoint.eventTypes)) {
              return false;
            }

            return endpoint.eventTypes.includes("payment_intent.created");
          })
          .map((endpoint) => ({
            merchantId,
            webhookEndpointId: endpoint.id,
            eventType: "payment_intent.created",
            payload: {
              type: "payment_intent.created",
              data: {
                payment_intent_id: created.id,
                merchant_id: merchantId,
                amount: created.amount,
                currency: created.currency,
                status: created.status.toLowerCase(),
              },
            },
            status: "PENDING" as const,
          }));

        if (deliveryRows.length > 0) {
          await tx.webhookDelivery.createMany({ data: deliveryRows });
        }

        return created;
      });

      return NextResponse.json(
        {
          payment_intent: paymentIntentResponse(paymentIntent),
        },
        { status: 201 },
      );
    },
  });
}