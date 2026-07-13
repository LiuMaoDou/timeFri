import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  SessionChangedError,
  SessionExistsError,
  createSessionStore,
} from "../../lib/session-store.ts";

function withDatabase(
  run: (databasePath: string) => void | Promise<void>,
): () => Promise<void> {
  return async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "timefri-store-"));
    const databasePath = path.join(directory, "test.sqlite");

    try {
      await run(databasePath);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  };
}

test(
  "session store starts empty and creates one active session",
  withDatabase((databasePath) => {
    const store = createSessionStore(databasePath);

    assert.equal(store.get(), null);
    const session = store.create({
      id: "session-1",
      eventName: "Write plan",
      startAt: 1000,
    });

    assert.deepEqual(session, {
      id: "session-1",
      eventName: "Write plan",
      startAt: 1000,
      entries: [],
      version: 1,
      updatedAt: 1000,
    });
    store.close();
  }),
);

test(
  "session store rejects a second active session",
  withDatabase((databasePath) => {
    const store = createSessionStore(databasePath);
    store.create({ id: "session-1", eventName: "First", startAt: 1000 });

    assert.throws(
      () =>
        store.create({ id: "session-2", eventName: "Second", startAt: 2000 }),
      SessionExistsError,
    );
    store.close();
  }),
);

test(
  "session store appends entries in order and increments its version",
  withDatabase((databasePath) => {
    const store = createSessionStore(databasePath);
    store.create({ id: "session-1", eventName: "Write", startAt: 1000 });

    store.append("session-1", "First entry", 2000);
    const session = store.append("session-1", "Second entry", 3000);

    assert.deepEqual(session.entries, ["First entry", "Second entry"]);
    assert.equal(session.version, 3);
    assert.equal(session.updatedAt, 3000);
    store.close();
  }),
);

test(
  "session store rejects changes for a replaced session",
  withDatabase((databasePath) => {
    const store = createSessionStore(databasePath);
    store.create({ id: "session-1", eventName: "Write", startAt: 1000 });

    assert.throws(
      () => store.append("session-old", "Lost entry", 2000),
      SessionChangedError,
    );
    assert.throws(() => store.delete("session-old"), SessionChangedError);
    store.close();
  }),
);

test(
  "session store persists entries after reopening and can delete the session",
  withDatabase((databasePath) => {
    const firstStore = createSessionStore(databasePath);
    firstStore.create({
      id: "session-1",
      eventName: "Persist me",
      startAt: 1000,
    });
    firstStore.append("session-1", "Saved entry", 2000);
    firstStore.close();

    const secondStore = createSessionStore(databasePath);
    assert.deepEqual(secondStore.get()?.entries, ["Saved entry"]);
    assert.equal(secondStore.delete("session-1"), true);
    assert.equal(secondStore.get(), null);
    secondStore.close();
  }),
);
