import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../../app/api/flomo/route.ts";

test("POST /api/flomo forwards a valid memo to Flomo", async () => {
  const originalUrl = process.env.FLOMO_WEBHOOK_URL;
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  process.env.FLOMO_WEBHOOK_URL = "https://flomoapp.com/iwh/test-token";
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
  };

  try {
    const response = await POST(
      new Request("http://localhost/api/flomo", {
        method: "POST",
        body: JSON.stringify({
          eventName: "Write course notes",
          summary: "Finished the outline.",
          startAt: "2026-07-12T10:00:00.000Z",
          endAt: "2026-07-12T11:15:30.000Z",
        }),
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://flomoapp.com/iwh/test-token");
    assert.equal(JSON.parse(String(calls[0].init?.body)).content_type, "markdown");
  } finally {
    if (originalUrl === undefined) {
      delete process.env.FLOMO_WEBHOOK_URL;
    } else {
      process.env.FLOMO_WEBHOOK_URL = originalUrl;
    }
    globalThis.fetch = originalFetch;
  }
});

test("POST /api/flomo returns NOT_CONFIGURED when webhook is missing", async () => {
  const originalUrl = process.env.FLOMO_WEBHOOK_URL;
  delete process.env.FLOMO_WEBHOOK_URL;

  try {
    const response = await POST(
      new Request("http://localhost/api/flomo", {
        method: "POST",
        body: JSON.stringify({
          eventName: "Write course notes",
          summary: "Finished the outline.",
          startAt: "2026-07-12T10:00:00.000Z",
          endAt: "2026-07-12T11:15:30.000Z",
        }),
      }),
    );

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      ok: false,
      code: "NOT_CONFIGURED",
      message: "Flomo webhook is not configured.",
    });
  } finally {
    if (originalUrl !== undefined) {
      process.env.FLOMO_WEBHOOK_URL = originalUrl;
    }
  }
});
