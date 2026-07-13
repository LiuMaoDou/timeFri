import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

import type { ActiveSession } from "./session.ts";

export type StoredSession = ActiveSession & {
  version: number;
  updatedAt: number;
};

export type CreateSessionInput = Pick<
  ActiveSession,
  "id" | "eventName" | "startAt"
>;

type SessionRow = {
  id: string;
  event_name: string;
  start_at: number;
  version: number;
  updated_at: number;
};

type EntryRow = {
  content: string;
};

export class SessionExistsError extends Error {
  constructor() {
    super("An active session already exists.");
    this.name = "SessionExistsError";
  }
}

export class SessionChangedError extends Error {
  constructor() {
    super("The active session changed.");
    this.name = "SessionChangedError";
  }
}

export type SessionStore = {
  get(): StoredSession | null;
  create(input: CreateSessionInput): StoredSession;
  append(sessionId: string, content: string, now?: number): StoredSession;
  delete(sessionId: string): boolean;
  close(): void;
};

function ensureDatabaseDirectory(databasePath: string) {
  if (databasePath === ":memory:") return;
  mkdirSync(path.dirname(databasePath), { recursive: true });
}

export function createSessionStore(databasePath: string): SessionStore {
  ensureDatabaseDirectory(databasePath);
  const database = new Database(databasePath);

  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS active_session (
      singleton_key INTEGER PRIMARY KEY CHECK (singleton_key = 1),
      id TEXT NOT NULL UNIQUE,
      event_name TEXT NOT NULL,
      start_at INTEGER NOT NULL,
      version INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_entry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      content TEXT NOT NULL,
      UNIQUE (session_id, position),
      FOREIGN KEY (session_id) REFERENCES active_session(id) ON DELETE CASCADE
    );
  `);

  const selectSession = database.prepare<[], SessionRow>(`
    SELECT id, event_name, start_at, version, updated_at
    FROM active_session
    WHERE singleton_key = 1
  `);
  const selectEntries = database.prepare<[string], EntryRow>(`
    SELECT content
    FROM session_entry
    WHERE session_id = ?
    ORDER BY position ASC
  `);

  function get(): StoredSession | null {
    const row = selectSession.get();
    if (!row) return null;

    return {
      id: row.id,
      eventName: row.event_name,
      startAt: row.start_at,
      entries: selectEntries.all(row.id).map((entry) => entry.content),
      version: row.version,
      updatedAt: row.updated_at,
    };
  }

  function create(input: CreateSessionInput): StoredSession {
    try {
      database
        .prepare(
          `INSERT INTO active_session
            (singleton_key, id, event_name, start_at, version, updated_at)
           VALUES (1, ?, ?, ?, 1, ?)`,
        )
        .run(input.id, input.eventName, input.startAt, input.startAt);
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
        throw new SessionExistsError();
      }
      throw error;
    }

    return get() as StoredSession;
  }

  const appendTransaction = database.transaction(
    (sessionId: string, content: string, now: number) => {
      const session = selectSession.get();
      if (!session || session.id !== sessionId) {
        throw new SessionChangedError();
      }

      const position = database
        .prepare<[string], { next_position: number }>(`
          SELECT COALESCE(MAX(position) + 1, 0) AS next_position
          FROM session_entry
          WHERE session_id = ?
        `)
        .get(sessionId)?.next_position ?? 0;

      database
        .prepare(
          `INSERT INTO session_entry (session_id, position, content)
           VALUES (?, ?, ?)`,
        )
        .run(sessionId, position, content);
      database
        .prepare(
          `UPDATE active_session
           SET version = version + 1, updated_at = ?
           WHERE singleton_key = 1 AND id = ?`,
        )
        .run(now, sessionId);

      return get() as StoredSession;
    },
  );

  function append(
    sessionId: string,
    content: string,
    now = Date.now(),
  ): StoredSession {
    return appendTransaction.immediate(sessionId, content, now);
  }

  function deleteSession(sessionId: string): boolean {
    const session = selectSession.get();
    if (!session || session.id !== sessionId) {
      throw new SessionChangedError();
    }

    return database
      .prepare("DELETE FROM active_session WHERE singleton_key = 1 AND id = ?")
      .run(sessionId).changes === 1;
  }

  return {
    get,
    create,
    append,
    delete: deleteSession,
    close: () => database.close(),
  };
}

const globalStore = globalThis as typeof globalThis & {
  timeFriSessionStore?: SessionStore;
};

export function getSessionStore(): SessionStore {
  if (!globalStore.timeFriSessionStore) {
    const databasePath = path.resolve(
      process.env.TIMEFRI_DATABASE_PATH ?? "data/timefri.sqlite",
    );
    globalStore.timeFriSessionStore = createSessionStore(databasePath);
  }

  return globalStore.timeFriSessionStore;
}
