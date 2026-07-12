import assert from "node:assert/strict";
import test from "node:test";

import {
  appendSessionEntry,
  parseStoredSession,
  type ActiveSession,
} from "../../lib/session.ts";

test("parseStoredSession migrates sessions without entries", () => {
  assert.deepEqual(
    parseStoredSession({
      id: "session-1",
      eventName: "Write plan",
      startAt: 1000,
    }),
    {
      id: "session-1",
      eventName: "Write plan",
      startAt: 1000,
      entries: [],
    },
  );
});

test("parseStoredSession keeps only string entries", () => {
  const session = parseStoredSession({
    id: "session-1",
    eventName: "Write plan",
    startAt: 1000,
    entries: ["First", 2, "Second"],
  });

  assert.deepEqual(session?.entries, ["First", "Second"]);
});

test("parseStoredSession rejects invalid core fields", () => {
  assert.equal(parseStoredSession({ eventName: "Missing fields" }), null);
  assert.equal(parseStoredSession(null), null);
});

test("appendSessionEntry trims content and preserves order", () => {
  const session: ActiveSession = {
    id: "session-1",
    eventName: "Write plan",
    startAt: 1000,
    entries: ["First note"],
  };

  const next = appendSessionEntry(session, "  Second note  ");

  assert.deepEqual(next.entries, ["First note", "Second note"]);
  assert.deepEqual(session.entries, ["First note"]);
});
