# Theme and Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent light, dark, and system theme selector plus a phone layout with stacked controls and bottom-sheet dialogs.

**Architecture:** Pure theme functions live in `lib/theme.ts` and are covered by Node unit tests. The root layout runs a small pre-hydration script, while the client page owns the selector and system-theme listener. Existing CSS variables are extended for dark mode and responsive breakpoints.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS, Node test runner

## Global Constraints

- Keep the timer and Flomo data flows unchanged.
- Do not add a theme dependency.
- Persist only `light`, `dark`, or `system`; invalid values resolve to `system`.
- Support widths down to 320 pixels.
- Keep `.env.local` and the Flomo webhook out of Git.
- Use English for code, commands, filenames, and commit messages.

---

### Task 1: Pure Theme Resolution

**Files:**
- Create: `lib/theme.ts`
- Create: `tests/unit/theme.test.ts`

**Interfaces:**
- Produces: `ThemePreference`, `ResolvedTheme`, `parseThemePreference(value)`, and `resolveTheme(preference, systemPrefersDark)`.

- [ ] **Step 1: Write the failing tests**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { parseThemePreference, resolveTheme } from "../../lib/theme.ts";

test("parseThemePreference accepts supported preferences", () => {
  assert.equal(parseThemePreference("light"), "light");
  assert.equal(parseThemePreference("dark"), "dark");
  assert.equal(parseThemePreference("system"), "system");
});

test("parseThemePreference falls back to system", () => {
  assert.equal(parseThemePreference("sepia"), "system");
  assert.equal(parseThemePreference(null), "system");
});

test("resolveTheme follows explicit and system preferences", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `rtk node --test tests/unit/theme.test.ts`
Expected: FAIL because `lib/theme.ts` does not exist.

- [ ] **Step 3: Implement the pure functions**

```typescript
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  return preference === "system"
    ? systemPrefersDark ? "dark" : "light"
    : preference;
}
```

- [ ] **Step 4: Run all unit tests and verify GREEN**

Run: `rtk npm test`
Expected: all theme and Flomo tests pass.

- [ ] **Step 5: Review and commit**

```bash
rtk git diff
rtk git add lib/theme.ts tests/unit/theme.test.ts
rtk git commit -m "feat: add theme resolution"
```

### Task 2: Theme Bootstrap and Selector

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `ThemePreference`, `parseThemePreference`, and `resolveTheme` from `lib/theme.ts`.
- Produces: root `data-theme-preference` and `data-theme` attributes plus a three-option accessible selector.

- [ ] **Step 1: Add a pre-hydration bootstrap script in `app/layout.tsx`**

The script must read `timeFri.theme.v1`, validate it against `light`, `dark`, and `system`, resolve `prefers-color-scheme: dark`, and set both root data attributes before paint. Add `suppressHydrationWarning` to `<html>`.

- [ ] **Step 2: Add client theme state and synchronization in `app/page.tsx`**

Initialize from the root attribute, apply selections to the root and storage, and subscribe to `MediaQueryList.change` only when preference is `system`. Render three icon buttons with `aria-label`, `aria-pressed`, and `title`.

- [ ] **Step 3: Add theme tokens and selector styles in `app/globals.css`**

Define dark values under `html[data-theme="dark"]`. Replace hard-coded light surfaces used by status, session, buttons, dialogs, fields, and toast with semantic variables. Add `color-scheme` for both resolved themes and stable dimensions for selector buttons.

- [ ] **Step 4: Run automated checks**

Run: `rtk npm test`
Run: `rtk npm run typecheck`
Run: `rtk npm run lint`
Expected: every command exits 0 with no warnings.

- [ ] **Step 5: Review and commit**

```bash
rtk git diff
rtk git add app/layout.tsx app/page.tsx app/globals.css
rtk git commit -m "feat: add system-aware theme selector"
```

### Task 3: Phone Layout and Browser Verification

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: existing page class names and theme variables.
- Produces: stacked phone controls, safe-area spacing, and bottom-sheet dialogs at phone widths.

- [ ] **Step 1: Add responsive CSS**

At `max-width: 640px`, allow vertical shell scrolling, reduce horizontal padding, keep the top bar from overlapping, constrain the clock, stack `.controls`, and align footer content vertically. Anchor `.dialog-backdrop` content to the bottom and style `.dialog-card` as a width-filling sheet with safe-area padding and a scrollable maximum height.

- [ ] **Step 2: Verify the production build**

Run: `rtk npm run build`
Expected: Next.js build succeeds and lists `/` and `/api/flomo`.

- [ ] **Step 3: Verify rendered behavior in the in-app browser**

Check desktop, 390-pixel, and 320-pixel viewports. Exercise all three theme options, emulate system light and dark, reload for persistence, open both dialogs, and inspect console logs. Expected: no overflow, overlap, hydration errors, or console warnings; phone buttons stack and dialogs render as bottom sheets.

- [ ] **Step 4: Review and commit**

```bash
rtk git diff
rtk git add app/globals.css
rtk git commit -m "feat: improve mobile timer layout"
```

### Task 4: Publish to GitHub

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: verified local `main` branch.
- Produces: a new GitHub repository with `main` pushed and tracked.

- [ ] **Step 1: Confirm the worktree is clean and secrets are ignored**

Run: `rtk git status --short`
Run: `rtk git check-ignore .env.local`
Expected: clean status and `.env.local` is reported as ignored.

- [ ] **Step 2: Create the repository and push**

Create a new repository named `timeFri` under the authenticated GitHub account, add it as `origin`, and push `main` with upstream tracking. Never include `.env.local`.

- [ ] **Step 3: Verify publication**

Confirm the remote default branch is `main`, the latest local commit exists remotely, and provide the repository URL.
