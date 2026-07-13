import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFlomoMemo,
  sendFlomoMemo,
  type FlomoMemoInput,
} from "../../lib/flomo.ts";

const baseMemo: FlomoMemoInput = {
  eventName: "Write course notes",
  entries: [
    "Finished the outline.",
    "Marked the next step.",
  ],
  startAt: new Date("2026-07-12T10:00:00.000Z").toISOString(),
  endAt: new Date("2026-07-12T11:15:30.000Z").toISOString(),
  durationSeconds: 4530,
};

test("buildFlomoMemo formats a time tracking memo", () => {
  assert.equal(
    buildFlomoMemo(baseMemo),
    [
      "#timeFri",
      "",
      "事件：Write course notes",
      "开始：2026-07-12 19:00:00",
      "结束：2026-07-12 20:15:30",
      "持续：01:15:30",
      "",
      "记录：",
      "Finished the outline.",
      "Marked the next step.",
    ].join("\n"),
  );
  assert.equal(
    buildFlomoMemo(baseMemo).includes(
      "Finished the outline.\n\nMarked the next step.",
    ),
    false,
  );
  assert.equal(buildFlomoMemo(baseMemo).includes("1."), false);
});

test("sendFlomoMemo posts content JSON to the webhook URL", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
  };

  await sendFlomoMemo({
    webhookUrl: "https://flomoapp.com/iwh/test-token",
    memo: baseMemo,
    fetcher,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://flomoapp.com/iwh/test-token");
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(
    (calls[0].init?.headers as Record<string, string>)["Content-Type"],
    "application/json",
  );
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    content: buildFlomoMemo(baseMemo),
    content_type: "markdown",
  });
});
