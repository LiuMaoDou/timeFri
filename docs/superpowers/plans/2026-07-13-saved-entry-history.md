# Saved Entry History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display every saved progress entry in the recording sheet and join final Flomo entries with a single newline.

**Architecture:** The existing session entries array remains the single source of truth. The page renders it as a bounded history list, CSS provides responsive theme-aware presentation, and the existing Flomo formatter changes only its entry separator.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS, Node test runner

## Global Constraints

- Work directly on `main` as previously authorized.
- Do not add timestamps, numbering, editing, deleting, or reordering.
- Preserve user-authored line breaks inside each entry.
- Browser QA must not select `结束` or create a real Flomo memo.
- Commit completed changes and push verified `main` to `origin`.

---

### Task 1: Single-Newline Flomo Entries

**Files:**
- Modify: `tests/unit/flomo.test.ts`
- Modify: `lib/flomo.ts`

**Interfaces:**
- Consumes: `FlomoMemoInput.entries` in stored order.
- Produces: Markdown with exactly one newline between adjacent entries.

- [ ] **Step 1: Change the expected memo and verify RED**

Remove the empty-string array item between the two expected entries and add:

```typescript
assert.equal(
  buildFlomoMemo(baseMemo).includes(
    "Finished the outline.\n\nMarked the next step.",
  ),
  false,
);
```

Run: `rtk node --test tests/unit/flomo.test.ts`
Expected: FAIL because the formatter still uses `entries.join("\n\n")`.

- [ ] **Step 2: Implement the separator change**

```typescript
"记录：",
input.entries.join("\n"),
```

- [ ] **Step 3: Verify and commit**

Run: `rtk npm test`
Run: `rtk npm run typecheck`
Run: `rtk npm run lint`

```bash
rtk git diff
rtk git add tests/unit/flomo.test.ts lib/flomo.ts
rtk git commit -m "fix: remove blank lines between flomo entries"
```

### Task 2: Saved Entry History UI

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `session.entries` already persisted by the recording flow.
- Produces: an ordered, complete, scrollable saved-entry history inside the recording sheet.

- [ ] **Step 1: Render the history before the textarea form**

```tsx
{session.entries.length > 0 && (
  <section className="entry-history" aria-labelledby="entry-history-title">
    <p className="entry-history-title" id="entry-history-title">
      已保存记录 · {session.entries.length} 条
    </p>
    <div className="entry-history-list">
      {session.entries.map((entry, index) => (
        <p className="entry-history-item" key={`${index}-${entry}`}>
          {entry}
        </p>
      ))}
    </div>
  </section>
)}
```

- [ ] **Step 2: Add theme-aware bounded styles**

Use a `180px` maximum list height, vertical scrolling, `white-space: pre-wrap`, `overflow-wrap: anywhere`, semantic surface and border variables, and compact mobile spacing. Do not render an empty history container.

- [ ] **Step 3: Run automated checks and build**

Run: `rtk npm test`
Run: `rtk npm run typecheck`
Run: `rtk npm run lint`
Run: `rtk npm run build`

- [ ] **Step 4: Browser QA without ending the session**

Start a session, save two entries with `继续计时`, reopen `记录`, and verify both entries and `已保存记录 · 2 条` appear in order. Check desktop, 390-pixel, and 320-pixel widths, history scrolling, wrapping, no horizontal overflow, no framework overlay, and no console warnings. Do not click `结束`.

- [ ] **Step 5: Review, commit, and publish**

```bash
rtk git diff
rtk git add app/page.tsx app/globals.css
rtk git commit -m "feat: show saved progress history"
rtk git push origin main
```

Verify a clean worktree, ignored `.env.local`, and matching local and remote `main` hashes.
