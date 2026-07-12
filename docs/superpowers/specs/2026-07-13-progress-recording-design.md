# Progress Recording Design

## Goal

Let users save multiple notes during a running timer, continue timing after each note, and send the ordered collection to Flomo only when the session ends. Also fix the dark-theme contrast of the running status text and dot.

## Interaction Flow

The main secondary action changes from `结束` to `记录`. It opens the existing end-session sheet, which becomes a recording sheet.

The textarea label changes from `总结` to `记录内容`. The sheet has two actions:

- `继续计时` saves the trimmed textarea content as a new entry, persists the session, closes the sheet, and shows `已保存本次记录`. Empty content is rejected for this action.
- `结束` sends all saved entries to Flomo and completes the session. Non-empty textarea content is automatically appended before sending. An empty textarea is allowed when at least one entry was saved earlier. If there are no saved entries and the textarea is empty, the sheet shows a validation error.

The main timer view shows the number of saved entries while a session is running. This confirms that a note was retained without displaying the note content in the main clock view.

## Session Data

`ActiveSession` gains an `entries: string[]` field. The entire session, including entries, remains under `timeFri.activeSession.v1` in `localStorage`.

Every successful `继续计时` action updates React state and `localStorage` together. Existing stored sessions without `entries` are migrated in memory to `entries: []` and written in the new shape on the next update. Invalid entry values are discarded during loading rather than invalidating an otherwise usable session.

Entries preserve input order. They do not store or display timestamps. Each entry is individually trimmed before storage.

## Flomo Output

The browser sends an `entries: string[]` payload to `/api/flomo`. The route validates that the array contains at least one non-empty string and enforces per-entry and aggregate length limits.

The Flomo formatter renders a `记录：` section with entries in input order, separated by blank lines. No entry timestamps or generated numbering are added. Existing event name, session start, session end, duration, and `#timeFri` output remain unchanged.

The legacy single `summary` request shape is replaced because only this app calls the local route. Tests are updated around the new contract.

## Failure Handling

Saving a progress entry is local-only and does not contact Flomo. If local storage is unavailable, the entry remains in React state for the current page lifetime.

If the final Flomo request fails, the session and all entries remain available. The recording sheet reopens with the final unsaved textarea content intact so the user can retry without losing work.

## Dark Running Status

The running badge currently combines a hard-coded light background with the dark theme's light accent text, which reduces contrast. The running background, text, border, dot fill, and dot halo move to semantic theme variables.

Dark mode uses a darker accent-tinted badge surface with brighter text. The status dot beside `记录中` uses a solid bright accent and a restrained darker halo, so both the text and the status mark remain distinct.

## Testing and Verification

Unit tests cover:

- Loading sessions with missing, valid, and invalid entries.
- Appending trimmed entries in order.
- Building the Flomo memo from multiple entries without timestamps.
- Route acceptance and rejection for the new entries payload.

Browser verification covers:

- Saving two entries through `继续计时` and seeing the saved count increase.
- Reloading and retaining saved entries.
- Ending with an empty textarea when prior entries exist.
- Automatically including non-empty final textarea content on `结束`.
- Rejecting an end action when no entries exist.
- Preserving entries after a simulated Flomo failure.
- Desktop and phone recording sheets.
- Light and dark running badge text, dot, and halo contrast.

## Out of Scope

This change does not add editing or deleting saved entries, timestamps, entry reordering, multiple simultaneous sessions, or cross-device synchronization.
