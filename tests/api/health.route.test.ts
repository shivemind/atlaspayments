import { describe, expect, it } from "vitest";

import { GET } from "../../src/app/api/health/route";

describe("GET /api/health", () => {
  it("returns 200 and expected payload fields", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("atlaspayments");
    expect(typeof body.timestamp).toBe("string");
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });
});