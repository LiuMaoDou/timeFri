import { sendFlomoMemo, type FlomoMemoInput } from "../../../lib/flomo.ts";

type FlomoRequestBody = {
  eventName?: unknown;
  summary?: unknown;
  startAt?: unknown;
  endAt?: unknown;
};

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

function isValidDateString(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function validateBody(body: FlomoRequestBody): FlomoMemoInput | null {
  if (
    typeof body.eventName !== "string" ||
    typeof body.summary !== "string" ||
    typeof body.startAt !== "string" ||
    typeof body.endAt !== "string"
  ) {
    return null;
  }

  const eventName = body.eventName.trim();
  const summary = body.summary.trim();

  if (
    !eventName ||
    eventName.length > 100 ||
    !summary ||
    summary.length > 2000 ||
    !isValidDateString(body.startAt) ||
    !isValidDateString(body.endAt)
  ) {
    return null;
  }

  const startTime = new Date(body.startAt).getTime();
  const endTime = new Date(body.endAt).getTime();
  if (endTime < startTime) {
    return null;
  }

  return {
    eventName,
    summary,
    startAt: body.startAt,
    endAt: body.endAt,
    durationSeconds: Math.floor((endTime - startTime) / 1000),
  };
}

export async function POST(request: Request): Promise<Response> {
  const webhookUrl = process.env.FLOMO_WEBHOOK_URL;
  if (!webhookUrl) {
    return jsonResponse(
      {
        ok: false,
        code: "NOT_CONFIGURED",
        message: "Flomo webhook is not configured.",
      },
      500,
    );
  }

  let body: FlomoRequestBody;
  try {
    body = (await request.json()) as FlomoRequestBody;
  } catch {
    return jsonResponse(
      {
        ok: false,
        code: "INVALID_JSON",
        message: "Request body must be valid JSON.",
      },
      400,
    );
  }

  const memo = validateBody(body);
  if (!memo) {
    return jsonResponse(
      {
        ok: false,
        code: "INVALID_INPUT",
        message: "Event name, summary, start time, and end time are required.",
      },
      400,
    );
  }

  try {
    await sendFlomoMemo({ webhookUrl, memo });
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    console.error("Flomo webhook request failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return jsonResponse(
      {
        ok: false,
        code: "UPSTREAM_ERROR",
        message: "Failed to write memo to Flomo.",
      },
      502,
    );
  }
}
