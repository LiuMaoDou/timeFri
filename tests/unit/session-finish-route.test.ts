import assert from "node:assert/strict";
import test from "node:test";

import { createFinishHandler } from "../../app/api/session/finish/route.ts";
import { createSessionStore } from "../../lib/session-store.ts";
import type { FlomoMemoInput } from "../../lib/flomo.ts";

test("POST /api/session/finish sends authoritative entries and deletes the session", async () => {
  const store = createSessionStore(":memory:");
  store.create({ id: "session-1", eventName: "Write", startAt: 1000 });
  store.append("session-1", "First", 1500);
  const memos: FlomoMemoInput[] = [];
  const handler = createFinishHandler({
    store,
    getWebhookUrl: () => "https://flomoapp.com/iwh/test",
    now: () => 4000,
    sendMemo: async ({ memo }) => {
      memos.push(memo);
    },
  });

  const response = await handler(
    new Request("http://localhost/api/session/finish", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "session-1",
        finalEntry: "  Final  ",
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(memos[0], {
    eventName: "Write",
    entries: ["First", "Final"],
    startAt: new Date(1000).toISOString(),
    endAt: new Date(4000).toISOString(),
    durationSeconds: 3,
  });
  assert.equal(store.get(), null);
  store.close();
});

test("POST /api/session/finish retains the final entry when Flomo fails", async () => {
  const store = createSessionStore(":memory:");
  store.create({ id: "session-1", eventName: "Write", startAt: 1000 });
  const handler = createFinishHandler({
    store,
    getWebhookUrl: () => "https://flomoapp.com/iwh/test",
    now: () => 4000,
    sendMemo: async () => {
      throw new Error("Flomo unavailable");
    },
  });

  const response = await handler(
    new Request("http://localhost/api/session/finish", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "session-1",
        finalEntry: "Final",
      }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.code, "UPSTREAM_ERROR");
  assert.deepEqual(body.session.entries, ["Final"]);
  assert.deepEqual(store.get()?.entries, ["Final"]);
  store.close();
});

test("POST /api/session/finish validates configuration, session, and content", async () => {
  const store = createSessionStore(":memory:");
  const noWebhookHandler = createFinishHandler({
    store,
    getWebhookUrl: () => undefined,
    sendMemo: async () => undefined,
  });
  const noWebhookResponse = await noWebhookHandler(
    new Request("http://localhost/api/session/finish", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-1" }),
    }),
  );
  assert.equal(noWebhookResponse.status, 500);
  assert.equal((await noWebhookResponse.json()).code, "NOT_CONFIGURED");

  const handler = createFinishHandler({
    store,
    getWebhookUrl: () => "https://flomoapp.com/iwh/test",
    sendMemo: async () => undefined,
  });
  const missingResponse = await handler(
    new Request("http://localhost/api/session/finish", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-1" }),
    }),
  );
  assert.equal(missingResponse.status, 409);
  assert.equal((await missingResponse.json()).code, "SESSION_CHANGED");

  store.create({ id: "session-1", eventName: "Write", startAt: 1000 });
  const emptyResponse = await handler(
    new Request("http://localhost/api/session/finish", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-1" }),
    }),
  );
  assert.equal(emptyResponse.status, 400);
  assert.equal((await emptyResponse.json()).code, "EMPTY_ENTRIES");
  assert.notEqual(store.get(), null);
  store.close();
});
