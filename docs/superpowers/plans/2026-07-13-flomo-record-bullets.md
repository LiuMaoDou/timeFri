# Flomo Record Bullets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render each progress record sent to Flomo as a Markdown bullet.

**Architecture:** Keep entries as plain strings through session storage and the API. Update only `buildFlomoMemo` to add the presentation prefix when it renders the existing `记录：` section, and assert the output contract in the formatter unit test.

**Tech Stack:** Next.js, TypeScript, Node.js built-in test runner, `tsx`.

## Global Constraints

- Preserve the existing `#timeFri`, event metadata, timestamps, duration, and `记录：` heading.
- Keep the API payload shape as `entries: string[]`; do not add formatting in the route or client.
- Render every entry in input order as `- <entry>` on its own line.
- Do not alter unrelated untracked font files.

---

### Task 1: Render progress records as Markdown bullets

**Files:**
- Modify: `tests/unit/flomo.test.ts:23-42`
- Modify: `lib/flomo.ts:46-58`

**Interfaces:**
- Consumes: `buildFlomoMemo(input: FlomoMemoInput): string`
- Produces: A Flomo memo whose record section formats each `input.entries` item as `- ${entry}`.

- [ ] **Step 1: Write the failing test**

Replace the two expected record lines in `tests/unit/flomo.test.ts` with:

```ts
      "记录：",
      "- Finished the outline.",
      "- Marked the next step.",
```

Add assertions after the memo assertion:

```ts
  assert.equal(buildFlomoMemo(baseMemo).includes("\n- Finished the outline."), true);
  assert.equal(buildFlomoMemo(baseMemo).includes("\n- Marked the next step."), true);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test -- tests/unit/flomo.test.ts`

Expected: FAIL because `buildFlomoMemo` still emits unprefixed entry lines.

- [ ] **Step 3: Write minimal implementation**

In `lib/flomo.ts`, replace:

```ts
    input.entries.join("\n"),
```

with:

```ts
    input.entries.map((entry) => `- ${entry}`).join("\n"),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test -- tests/unit/flomo.test.ts`

Expected: PASS with the formatter test and webhook-payload test both succeeding.

- [ ] **Step 5: Run the full test suite**

Run: `rtk npm test`

Expected: PASS with no test failures.

- [ ] **Step 6: Review and commit**

Run: `rtk git diff -- lib/flomo.ts tests/unit/flomo.test.ts`

Stage only the implementation files and commit with `fix: format flomo records as bullets`.
