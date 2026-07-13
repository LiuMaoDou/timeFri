import { sendFlomoMemo, type FlomoMemoInput } from "../../../../lib/flomo.ts";
import {
  getSessionStore,
  SessionChangedError,
  type SessionStore,
} from "../../../../lib/session-store.ts";

type FinishBody = {
  sessionId?: unknown;
  finalEntry?: unknown;
};

type SendMemo = (options: {
  webhookUrl: string;
  memo: FlomoMemoInput;
}) => Promise<void>;

type FinishDependencies = {
  store: SessionStore;
  sendMemo: SendMemo;
  getWebhookUrl?: () => string | undefined;
  now?: () => number;
};

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

export function createFinishHandler({
  store,
  sendMemo,
  getWebhookUrl = () => process.env.FLOMO_WEBHOOK_URL,
  now = Date.now,
}: FinishDependencies) {
  return async function POST(request: Request): Promise<Response> {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
      return jsonResponse({ ok: false, code: "NOT_CONFIGURED" }, 500);
    }

    let body: FinishBody;
    try {
      body = (await request.json()) as FinishBody;
    } catch {
      return jsonResponse({ ok: false, code: "INVALID_JSON" }, 400);
    }

    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const finalEntry =
      typeof body.finalEntry === "string" ? body.finalEntry.trim() : "";

    if (
      !sessionId ||
      (body.finalEntry !== undefined && typeof body.finalEntry !== "string") ||
      finalEntry.length > 2000
    ) {
      return jsonResponse({ ok: false, code: "INVALID_INPUT" }, 400);
    }

    let session = store.get();
    if (!session || session.id !== sessionId) {
      return jsonResponse(
        { ok: false, code: "SESSION_CHANGED", session },
        409,
      );
    }

    const endAt = now();
    try {
      if (finalEntry) {
        session = store.append(sessionId, finalEntry, endAt);
      }
    } catch (error) {
      if (error instanceof SessionChangedError) {
        return jsonResponse(
          { ok: false, code: "SESSION_CHANGED", session: store.get() },
          409,
        );
      }
      throw error;
    }

    if (session.entries.length === 0) {
      return jsonResponse({ ok: false, code: "EMPTY_ENTRIES" }, 400);
    }

    const totalEntryLength = session.entries.reduce(
      (total, entry) => total + entry.length,
      0,
    );
    if (totalEntryLength > 10_000) {
      return jsonResponse({ ok: false, code: "INVALID_INPUT" }, 400);
    }

    try {
      await sendMemo({
        webhookUrl,
        memo: {
          eventName: session.eventName,
          entries: session.entries,
          startAt: new Date(session.startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          durationSeconds: Math.floor((endAt - session.startAt) / 1000),
        },
      });
    } catch {
      return jsonResponse(
        {
          ok: false,
          code: "UPSTREAM_ERROR",
          session,
        },
        502,
      );
    }

    try {
      store.delete(sessionId);
    } catch (error) {
      if (error instanceof SessionChangedError) {
        return jsonResponse(
          { ok: false, code: "SESSION_CHANGED", session: store.get() },
          409,
        );
      }
      throw error;
    }

    return jsonResponse({ ok: true }, 200);
  };
}

export const POST = createFinishHandler({
  store: getSessionStore(),
  sendMemo: sendFlomoMemo,
});
