# Progress Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save ordered progress entries during a timer, send the combined entries to Flomo on end, and improve the dark running badge text and dot contrast.

**Architecture:** A pure session module owns stored-session parsing and ordered entry appends. The existing Flomo module and route switch from one summary string to an entries array. The page coordinates local saves and final submission while CSS variables own running-badge contrast.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS, Node test runner

## Global Constraints

- Work directly on `main` as previously authorized.
- Keep saved entries in `timeFri.activeSession.v1` and preserve input order.
- Do not add entry timestamps, generated numbering, editing, deletion, or reordering.
- Keep the timer and theme behavior unchanged outside the requested flow.
- Keep `.env.local` and the Flomo webhook out of Git.
- Commit each completed task and push verified `main` to `origin`.

---

### Task 1: Stored Session Entries

**Files:**
- Create: `lib/session.ts`
- Create: `tests/unit/session.test.ts`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: `ActiveSession`, `parseStoredSession(value)`, and `appendSessionEntry(session, content)`.
- Consumers: `app/page.tsx` uses the shared type and helpers for load and local save.

- [ ] **Step 1: Write failing tests**

```typescript
test("parseStoredSession migrates sessions without entries", () => {
  assert.deepEqual(parseStoredSession({
    id: "session-1",
    eventName: "Write plan",
    startAt: 1000,
  }), {
    id: "session-1",
    eventName: "Write plan",
    startAt: 1000,
    entries: [],
  });
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

test("appendSessionEntry trims and preserves order", () => {
  const next = appendSessionEntry(session, "  Second note  ");
  assert.deepEqual(next.entries, ["First note", "Second note"]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `rtk node --test tests/unit/session.test.ts`
Expected: FAIL because `lib/session.ts` does not exist.

- [ ] **Step 3: Implement the pure session module**

Define the shared `ActiveSession` shape, return `null` for invalid core fields, migrate missing entries to an empty array, filter non-string entries, and append one trimmed string without mutating the source session.

```typescript
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
  ) return null;
  return {
    id: candidate.id,
    eventName: candidate.eventName,
    startAt: candidate.startAt,
    entries: Array.isArray(candidate.entries)
      ? candidate.entries.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

export function appendSessionEntry(
  session: ActiveSession,
  content: string,
): ActiveSession {
  return { ...session, entries: [...session.entries, content.trim()] };
}
```

- [ ] **Step 4: Replace page-local session parsing**

Import the shared type and parser in `app/page.tsx`. Keep invalid JSON cleanup behavior, create new sessions with `entries: []`, and guard local-storage writes so React state remains usable when storage is unavailable.

- [ ] **Step 5: Verify and commit**

Run: `rtk npm test`
Run: `rtk npm run typecheck`
Run: `rtk npm run lint`

```bash
rtk git diff
rtk git add lib/session.ts tests/unit/session.test.ts app/page.tsx
rtk git commit -m "feat: persist progress entries"
```

### Task 2: Flomo Entries Contract

**Files:**
- Modify: `lib/flomo.ts`
- Modify: `app/api/flomo/route.ts`
- Modify: `tests/unit/flomo.test.ts`
- Modify: `tests/unit/flomo-route.test.ts`

**Interfaces:**
- Consumes: `entries: string[]` from the browser request.
- Produces: `FlomoMemoInput` with ordered entries and Markdown containing a `记录：` section.

- [ ] **Step 1: Change tests to the entries contract and verify RED**

Use two entries in formatter and route tests. Assert both appear in input order separated by a blank line, assert no generated timestamp or numbering, and assert empty entries arrays return `INVALID_INPUT`.

Run: `rtk npm test`
Expected: FAIL because production code still requires `summary`.

- [ ] **Step 2: Update formatter and sender types**

Replace `summary: string` with `entries: string[]` in `FlomoMemoInput`. Render `记录：` followed by `entries.join("\n\n")` while preserving event, start, end, duration, and tag output.

```typescript
export type FlomoMemoInput = {
  eventName: string;
  entries: string[];
  startAt: string;
  endAt: string;
};

const content = [
  "#timeFri",
  "",
  `事件：${input.eventName}`,
  `开始：${formatDateTime(startAt)}`,
  `结束：${formatDateTime(endAt)}`,
  `持续：${formatDuration(endAt.getTime() - startAt.getTime())}`,
  "",
  "记录：",
  input.entries.join("\n\n"),
].join("\n");
```

- [ ] **Step 3: Update route validation**

Accept only arrays with at least one entry after trimming. Reject non-string entries, entries over 2000 characters, and aggregate content over 10000 characters. Forward the normalized entries array.

```typescript
if (!Array.isArray(body.entries) || body.entries.some((entry) => typeof entry !== "string")) {
  return invalidInputResponse();
}
const entries = body.entries.map((entry) => entry.trim()).filter(Boolean);
if (
  entries.length === 0 ||
  entries.some((entry) => entry.length > 2000) ||
  entries.reduce((total, entry) => total + entry.length, 0) > 10000
) {
  return invalidInputResponse();
}
```

- [ ] **Step 4: Verify and commit**

Run: `rtk npm test`
Run: `rtk npm run typecheck`
Run: `rtk npm run lint`

```bash
rtk git diff
rtk git add lib/flomo.ts app/api/flomo/route.ts tests/unit/flomo.test.ts tests/unit/flomo-route.test.ts
rtk git commit -m "feat: send ordered progress entries to flomo"
```

### Task 3: Recording Interaction and Running Contrast

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `appendSessionEntry` and the entries-based `/api/flomo` contract.
- Produces: the `记录` action, local `继续计时` save, final `结束` request, saved-count indicator, and semantic running-badge variables.

- [ ] **Step 1: Implement local progress saves**

Rename the main action to `记录`. Rename copy from summary to record content. On `继续计时`, require non-empty trimmed content, append it to the session, persist, clear the textarea, close the sheet, and show `已保存本次记录`.

- [ ] **Step 2: Implement final end behavior**

On `结束`, append non-empty textarea content automatically. Allow an empty textarea when saved entries exist. Reject a completely empty session. Submit the complete entries array and clear the session only after a successful Flomo response. Preserve entries and textarea content after failure.

- [ ] **Step 3: Add saved-entry feedback**

Show `已记录 N 条` in the running session area when `N > 0`. Keep the timer and event title layout stable on desktop and phone.

- [ ] **Step 4: Fix running badge and dot contrast**

Add semantic variables for running badge background, border, text, dot, and halo in light and dark themes. Replace hard-coded `.status-dot.is-running` colors with those variables.

- [ ] **Step 5: Verify and commit**

Run: `rtk npm test`
Run: `rtk npm run typecheck`
Run: `rtk npm run lint`
Run: `rtk npm run build`

```bash
rtk git diff
rtk git add app/page.tsx app/globals.css
rtk git commit -m "feat: add in-session progress recording"
```

### Task 4: Browser QA and Publication

**Files:**
- No source changes expected unless QA finds a defect.

**Interfaces:**
- Consumes: the completed recording flow and running badge styles.
- Produces: browser evidence and synchronized GitHub `main`.

- [ ] **Step 1: Verify the recording flow without sending a real memo**

Use a temporary browser-level interception for `/api/flomo`. Start a fresh session, save two entries with `继续计时`, reload, verify the count remains, enter a final note, and click `结束`. Assert the intercepted JSON contains all three entries in order.

- [ ] **Step 2: Verify edge cases**

Confirm an empty first record is rejected, ending with an empty textarea works after prior entries, and a simulated API failure preserves the session and entries.

- [ ] **Step 3: Verify responsive and dark status visuals**

Check desktop, 390-pixel, and 320-pixel widths. Inspect the dark running badge text, dot fill, and halo; confirm no overlap or horizontal overflow and no console warnings or framework overlay.

- [ ] **Step 4: Run final checks and publish**

Run: `rtk npm test`
Run: `rtk npm run typecheck`
Run: `rtk npm run lint`
Run: `rtk npm run build`
Run: `rtk git status --short`
Run: `rtk git check-ignore .env.local`

Push `main` to `origin` and verify local and remote commit hashes match.
