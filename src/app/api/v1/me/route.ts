import { NextResponse } from "next/server";

import { authenticateApiKey } from "../../../../lib/auth";
import { checkApiKeyRateLimit } from "../../../../lib/rate-limit";

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

  const rateLimit = await checkApiKeyRateLimit(authResult.apiKey.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Rate limit exceeded.",
        },
      },
      {
        status: 429,
        headers: {
          "x-ratelimit-limit": String(rateLimit.limit),
          "x-ratelimit-remaining": String(rateLimit.remaining),
          "x-ratelimit-reset": String(Math.floor(rateLimit.resetAt / 1000)),
        },
      },
    );
  }

  return NextResponse.json(
    {
      merchant: authResult.merchant,
      apiKey: authResult.apiKey,
    },
    {
      status: 200,
      headers: {
        "x-ratelimit-limit": String(rateLimit.limit),
        "x-ratelimit-remaining": String(rateLimit.remaining),
        "x-ratelimit-reset": String(Math.floor(rateLimit.resetAt / 1000)),
      },
    },
  );
}