# SQLite Session Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the shared active session in SQLite and synchronize it across browsers without authentication.

**Architecture:** A focused `lib/session-store.ts` repository owns SQLite access and returns the existing `ActiveSession` shape with a version field. Next.js route handlers expose read, create, append, and finish operations; the client loads immediately, polls every three seconds, and uses server responses as authoritative state.

**Tech Stack:** Next.js 16, React 19, TypeScript, `better-sqlite3`, Node test runner

## Global Constraints

- Store only one shared active session and ordered progress entries.
- Keep theme preference in browser `localStorage`.
- Poll every three seconds after an immediate initial fetch.
- Delete data only after Flomo accepts the completed memo.
- Keep failed completion data available for retry.
- Store the default database at `data/timefri.sqlite`; production requires a persistent volume.
- Do not add authentication.

---

### Task 1: SQLite Session Repository

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Modify: `lib/session.ts`
- Create: `lib/session-store.ts`
- Create: `tests/unit/session-store.test.ts`

**Interfaces:**
- Produces: `SessionStore`, `createSessionStore(databasePath)`, and `getSessionStore()`.
- Produces: `StoredSession` extending `ActiveSession` with `version` and `updatedAt`.
- Store methods: `get()`, `create(input)`, `append(sessionId, content)`, and `delete(sessionId)`.

- [ ] **Step 1: Add `better-sqlite3` and its TypeScript definitions**

Run: `rtk npm install better-sqlite3 && rtk npm install -D @types/better-sqlite3`

- [ ] **Step 2: Write failing repository tests**

Cover an empty database, singleton creation, ordered appends, rejection of a second session, rejection of a stale session ID, persistence after reopening, and deletion.

- [ ] **Step 3: Verify the repository tests fail**

Run: `rtk node --test tests/unit/session-store.test.ts`
Expected: FAIL because `lib/session-store.ts` does not exist.

- [ ] **Step 4: Implement schema initialization and transactional repository methods**

Use `active_session(singleton_key INTEGER PRIMARY KEY CHECK(singleton_key = 1), id TEXT UNIQUE, event_name TEXT, start_at INTEGER, version INTEGER, updated_at INTEGER)` and `session_entry(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, position INTEGER, content TEXT, UNIQUE(session_id, position))`. Use an immediate transaction for append position calculation and version increment.

- [ ] **Step 5: Ignore runtime database files and verify tests**

Add `data/` to `.gitignore`.

Run: `rtk node --test tests/unit/session-store.test.ts`
Expected: all repository tests pass.

- [ ] **Step 6: Review and commit**

Run: `rtk git diff`

Commit: `feat: add sqlite session repository`

### Task 2: Session API And Atomic Finish Flow

**Files:**
- Create: `app/api/session/route.ts`
- Create: `app/api/session/finish/route.ts`
- Modify: `lib/flomo.ts` only if a shared validation type is required
- Create: `tests/unit/session-route.test.ts`
- Create: `tests/unit/session-finish-route.test.ts`

**Interfaces:**
- `GET /api/session`: `{ ok: true, session: StoredSession | null }`.
- `POST /api/session`: validated `{ id, eventName, startAt }`, returning the created session or `409 SESSION_EXISTS`.
- `PATCH /api/session`: validated `{ sessionId, content }`, returning the updated session or `409 SESSION_CHANGED`.
- `POST /api/session/finish`: validated `{ sessionId, finalEntry? }`, returning `{ ok: true }` after Flomo success and deletion.

- [ ] **Step 1: Write failing route tests with temporary databases and injected store dependencies**

Cover malformed JSON, field limits, create conflict, ordered append, missing session, finish with optional final content, Flomo failure retention, and Flomo success deletion.

- [ ] **Step 2: Verify route tests fail**

Run: `rtk node --test tests/unit/session-route.test.ts tests/unit/session-finish-route.test.ts`
Expected: FAIL because the route modules do not exist.

- [ ] **Step 3: Implement shared session route validation and handlers**

Validate event names at 1-100 trimmed characters, entries at 1-2000 trimmed characters, numeric start times, UUID-like nonempty IDs, and matching session IDs. Map store conflicts to stable JSON error codes.

- [ ] **Step 4: Implement finish orchestration**

Read the authoritative session, append `finalEntry` when nonempty, require at least one entry, call `sendFlomoMemo`, and delete only after the call succeeds. Return `502 UPSTREAM_ERROR` while retaining the session on failure.

- [ ] **Step 5: Run route and full unit tests**

Run: `rtk npm test`
Expected: all tests pass.

- [ ] **Step 6: Review and commit**

Run: `rtk git diff`

Commit: `feat: add shared session api`

### Task 3: Browser Synchronization

**Files:**
- Modify: `app/page.tsx`
- Modify: `lib/session.ts`
- Modify: `tests/unit/session.test.ts`

**Interfaces:**
- Consumes the Task 2 API response shapes.
- Client session state uses `StoredSession` and no longer writes active sessions to `localStorage`.

- [ ] **Step 1: Add failing tests for server-session parsing and freshness comparison**

Test parsing `version` and `updatedAt`, rejecting invalid server sessions, and preferring the larger version for the same session ID.

- [ ] **Step 2: Verify tests fail**

Run: `rtk node --test tests/unit/session.test.ts`
Expected: FAIL because server-session helpers do not exist.

- [ ] **Step 3: Implement session parsing helpers**

Add `StoredSession`, `parseStoredSession`, and `shouldReplaceSession(current, incoming)` while retaining migration-safe parsing for existing tests.

- [ ] **Step 4: Replace active-session local storage with API synchronization**

Fetch immediately on mount, schedule a three-second interval, skip polling during mutations, update immediately from create/append responses, remove the legacy `timeFri.activeSession.v1` key after the first successful fetch, and keep theme persistence unchanged.

- [ ] **Step 5: Route completion through the finish endpoint**

Send `{ sessionId, finalEntry }`; on success clear client state, and on failure keep the dialog and show the existing error treatment.

- [ ] **Step 6: Run unit and static checks**

Run: `rtk npm test && rtk npm run typecheck && rtk npm run lint`
Expected: all commands pass.

- [ ] **Step 7: Review and commit**

Run: `rtk git diff`

Commit: `feat: sync sessions across browsers`

### Task 4: Production And Browser Verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md` if present

**Interfaces:**
- Documents `TIMEFRI_DATABASE_PATH` and persistent-volume requirements.

- [ ] **Step 1: Document database configuration**

Add `TIMEFRI_DATABASE_PATH=./data/timefri.sqlite` to `.env.example` and explain that deployed SQLite storage must be mounted persistently.

- [ ] **Step 2: Run complete verification**

Run: `rtk npm test && rtk npm run typecheck && rtk npm run lint && rtk npm run build`
Expected: tests, type checking, linting, and production build all pass.

- [ ] **Step 3: Verify two-browser behavior**

Open two browser tabs, start a session in the first, confirm the second receives it within three seconds, append entries from each tab, confirm ordering in both, and verify a simulated Flomo failure retains the session. Do not submit a real test memo to Flomo.

- [ ] **Step 4: Review and commit**

Run: `rtk git diff`

Commit: `docs: document sqlite deployment`
