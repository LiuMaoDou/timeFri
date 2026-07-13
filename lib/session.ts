export type ActiveSession = {
  id: string;
  eventName: string;
  startAt: number;
  entries: string[];
};

export type StoredSession = ActiveSession & {
  version: number;
  updatedAt: number;
};

export function parseStoredSession(value: unknown): StoredSession | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<StoredSession>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.eventName !== "string" ||
    typeof candidate.startAt !== "number" ||
    (candidate.version !== undefined &&
      (typeof candidate.version !== "number" ||
        !Number.isInteger(candidate.version) ||
        candidate.version < 0)) ||
    (candidate.updatedAt !== undefined &&
      typeof candidate.updatedAt !== "number")
  ) {
    return null;
  }

  return {
    id: candidate.id,
    eventName: candidate.eventName,
    startAt: candidate.startAt,
    entries: Array.isArray(candidate.entries)
      ? candidate.entries.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
    version: candidate.version ?? 0,
    updatedAt: candidate.updatedAt ?? candidate.startAt,
  };
}

export function shouldReplaceSession(
  current: StoredSession | null,
  incoming: StoredSession | null,
): boolean {
  if (!incoming) return current !== null;
  if (!current || current.id !== incoming.id) return true;
  return incoming.version > current.version;
}

export function appendSessionEntry(
  session: ActiveSession,
  content: string,
): ActiveSession {
  return {
    ...session,
    entries: [...session.entries, content.trim()],
  };
}
