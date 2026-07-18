import {
  getSessionStore,
  SessionChangedError,
  SessionExistsError,
  type SessionStore,
} from "../../../lib/session-store.ts";

type CreateSessionBody = {
  id?: unknown;
  eventName?: unknown;
  startAt?: unknown;
};

type AppendEntryBody = {
  sessionId?: unknown;
  content?: unknown;
};

type EndSessionBody = {
  sessionId?: unknown;
};

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function createSessionHandlers(
  store: SessionStore,
  now: () => number = Date.now,
) {
  return {
    async GET(): Promise<Response> {
      return jsonResponse({ ok: true, session: store.get() }, 200);
    },

    async POST(request: Request): Promise<Response> {
      const body = await readJson<CreateSessionBody>(request);
      if (!body) {
        return jsonResponse({ ok: false, code: "INVALID_JSON" }, 400);
      }

      const id = typeof body.id === "string" ? body.id.trim() : "";
      const eventName =
        typeof body.eventName === "string" ? body.eventName.trim() : "";
      const startAt = body.startAt;

      if (
        !id ||
        id.length > 100 ||
        !eventName ||
        eventName.length > 100 ||
        typeof startAt !== "number" ||
        !Number.isFinite(startAt) ||
        startAt < 0
      ) {
        return jsonResponse({ ok: false, code: "INVALID_INPUT" }, 400);
      }

      try {
        const session = store.create({ id, eventName, startAt });
        return jsonResponse({ ok: true, session }, 201);
      } catch (error) {
        if (error instanceof SessionExistsError) {
          return jsonResponse(
            { ok: false, code: "SESSION_EXISTS", session: store.get() },
            409,
          );
        }
        throw error;
      }
    },

    async PATCH(request: Request): Promise<Response> {
      const body = await readJson<AppendEntryBody>(request);
      if (!body) {
        return jsonResponse({ ok: false, code: "INVALID_JSON" }, 400);
      }

      const sessionId =
        typeof body.sessionId === "string" ? body.sessionId.trim() : "";
      const content =
        typeof body.content === "string" ? body.content.trim() : "";

      if (!sessionId || !content || content.length > 2000) {
        return jsonResponse({ ok: false, code: "INVALID_INPUT" }, 400);
      }

      try {
        const session = store.append(sessionId, content, now());
        return jsonResponse({ ok: true, session }, 200);
      } catch (error) {
        if (error instanceof SessionChangedError) {
          return jsonResponse(
            { ok: false, code: "SESSION_CHANGED", session: store.get() },
            409,
          );
        }
        throw error;
      }
    },

    async DELETE(request: Request): Promise<Response> {
      const body = await readJson<EndSessionBody>(request);
      if (!body) {
        return jsonResponse({ ok: false, code: "INVALID_JSON" }, 400);
      }

      const sessionId =
        typeof body.sessionId === "string" ? body.sessionId.trim() : "";
      if (!sessionId) {
        return jsonResponse({ ok: false, code: "INVALID_INPUT" }, 400);
      }

      try {
        store.delete(sessionId);
        return jsonResponse({ ok: true }, 200);
      } catch (error) {
        if (error instanceof SessionChangedError) {
          return jsonResponse(
            { ok: false, code: "SESSION_CHANGED", session: store.get() },
            409,
          );
        }
        throw error;
      }
    },
  };
}

const handlers = createSessionHandlers(getSessionStore());

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
