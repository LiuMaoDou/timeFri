export type ActiveSession = {
  id: string;
  eventName: string;
  startAt: number;
  entries: string[];
};

export function parseStoredSession(value: unknown): ActiveSession | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<ActiveSession>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.eventName !== "string" ||
    typeof candidate.startAt !== "number"
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
  };
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
