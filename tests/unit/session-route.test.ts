import assert from "node:assert/strict";
import test from "node:test";

import { createSessionHandlers } from "../../app/api/session/route.ts";
import { createSessionStore } from "../../lib/session-store.ts";

test("GET /api/session returns null before a session starts", async () => {
  const store = createSessionStore(":memory:");
  const handlers = createSessionHandlers(store);

  const response = await handlers.GET();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, session: null });
  store.close();
});

test("POST /api/session creates and returns the shared session", async () => {
  const store = createSessionStore(":memory:");
  const handlers = createSessionHandlers(store);

  const response = await handlers.POST(
    new Request("http://localhost/api/session", {
      method: "POST",
      body: JSON.stringify({
        id: "session-1",
        eventName: "  Write plan  ",
        startAt: 1000,
      }),
    }),
  );

  assert.equal(response.status, 201);
  assert.equal((await response.json()).session.eventName, "Write plan");
  assert.equal(store.get()?.id, "session-1");
  store.close();
});

test("POST /api/session rejects invalid input and an existing session", async () => {
  const store = createSessionStore(":memory:");
  const handlers = createSessionHandlers(store);

  const invalidResponse = await handlers.POST(
    new Request("http://localhost/api/session", {
      method: "POST",
      body: JSON.stringify({ id: "", eventName: "", startAt: "now" }),
    }),
  );
  assert.equal(invalidResponse.status, 400);
  assert.equal((await invalidResponse.json()).code, "INVALID_INPUT");

  store.create({ id: "session-1", eventName: "First", startAt: 1000 });
  const conflictResponse = await handlers.POST(
    new Request("http://localhost/api/session", {
      method: "POST",
      body: JSON.stringify({
        id: "session-2",
        eventName: "Second",
        startAt: 2000,
      }),
    }),
  );
  assert.equal(conflictResponse.status, 409);
  assert.equal((await conflictResponse.json()).code, "SESSION_EXISTS");
  store.close();
});

test("PATCH /api/session appends a trimmed entry", async () => {
  const store = createSessionStore(":memory:");
  const handlers = createSessionHandlers(store, () => 2000);
  store.create({ id: "session-1", eventName: "Write", startAt: 1000 });

  const response = await handlers.PATCH(
    new Request("http://localhost/api/session", {
      method: "PATCH",
      body: JSON.stringify({
        sessionId: "session-1",
        content: "  Saved note  ",
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).session.entries, ["Saved note"]);
  assert.equal(store.get()?.updatedAt, 2000);
  store.close();
});

test("PATCH /api/session rejects stale sessions and oversized entries", async () => {
  const store = createSessionStore(":memory:");
  const handlers = createSessionHandlers(store);
  store.create({ id: "session-1", eventName: "Write", startAt: 1000 });

  const staleResponse = await handlers.PATCH(
    new Request("http://localhost/api/session", {
      method: "PATCH",
      body: JSON.stringify({ sessionId: "session-old", content: "Note" }),
    }),
  );
  assert.equal(staleResponse.status, 409);
  assert.equal((await staleResponse.json()).code, "SESSION_CHANGED");

  const oversizedResponse = await handlers.PATCH(
    new Request("http://localhost/api/session", {
      method: "PATCH",
      body: JSON.stringify({
        sessionId: "session-1",
        content: "x".repeat(2001),
      }),
    }),
  );
  assert.equal(oversizedResponse.status, 400);
  store.close();
});
