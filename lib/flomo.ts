export type FlomoMemoInput = {
  eventName: string;
  entries: string[];
  startAt: string;
  endAt: string;
  durationSeconds: number;
};

type SendFlomoMemoOptions = {
  webhookUrl: string;
  memo: FlomoMemoInput;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

const TIME_ZONE = "Asia/Tokyo";

function formatDateTime(value: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));

  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${lookup.year}-${lookup.month}-${lookup.day} ${lookup.hour}:${lookup.minute}:${lookup.second}`;
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function buildFlomoMemo(input: FlomoMemoInput): string {
  return [
    "#timeFri",
    "",
    `事件：${input.eventName}`,
    `开始：${formatDateTime(input.startAt)}`,
    `结束：${formatDateTime(input.endAt)}`,
    `持续：${formatDuration(input.durationSeconds)}`,
    "",
    "记录：",
    input.entries.join("\n"),
  ].join("\n");
}

export async function sendFlomoMemo({
  webhookUrl,
  memo,
  fetcher = fetch,
  timeoutMs = 10_000,
}: SendFlomoMemoOptions): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: buildFlomoMemo(memo),
        content_type: "markdown",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Flomo webhook returned HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
