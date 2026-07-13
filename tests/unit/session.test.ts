import assert from "node:assert/strict";
import test from "node:test";

import {
  appendSessionEntry,
  parseStoredSession,
  shouldReplaceSession,
  type ActiveSession,
  type StoredSession,
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
      version: 0,
      updatedAt: 1000,
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

test("parseStoredSession accepts server version metadata", () => {
  const session = parseStoredSession({
    id: "session-1",
    eventName: "Write plan",
    startAt: 1000,
    entries: ["First"],
    version: 3,
    updatedAt: 2000,
  });

  assert.equal(session?.version, 3);
  assert.equal(session?.updatedAt, 2000);
  assert.equal(
    parseStoredSession({
      id: "session-1",
      eventName: "Write plan",
      startAt: 1000,
      version: "3",
      updatedAt: 2000,
    }),
    null,
  );
});

test("shouldReplaceSession accepts authoritative and newer server state", () => {
  const current: StoredSession = {
    id: "session-1",
    eventName: "Write",
    startAt: 1000,
    entries: ["First"],
    version: 2,
    updatedAt: 2000,
  };

  assert.equal(shouldReplaceSession(current, { ...current, version: 1 }), false);
  assert.equal(shouldReplaceSession(current, { ...current, version: 3 }), true);
  assert.equal(shouldReplaceSession(current, null), true);
  assert.equal(
    shouldReplaceSession(current, {
      ...current,
      id: "session-2",
      version: 1,
    }),
    true,
  );
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
