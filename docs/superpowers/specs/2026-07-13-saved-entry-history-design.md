# Saved Entry History Design

## Goal

Show every saved progress entry inside the recording sheet so users can verify that each local save succeeded, and remove blank lines between entries in the final Flomo memo.

## Recording Sheet

When a running session has saved entries, the recording sheet displays a history section above the record-content textarea. Its heading reads `已保存记录 · N 条`.

The section renders every saved entry in input order. Each entry uses a visually separated list item without timestamps or generated numbering. Entry text preserves user-entered line breaks but wraps long lines within the sheet.

Only saved entries appear in history. Text currently present in the textarea remains a draft until the user selects `继续计时` or `结束`. This distinction makes the history section a reliable confirmation of persisted content.

When there are no saved entries, the history list is omitted. The existing session summary and textarea remain in their current positions without an empty placeholder panel.

## Responsive Behavior

The history region has a bounded maximum height and its own vertical scrolling. Desktop and phone sheets remain within their existing viewport limits. Scrolling the history does not resize controls or hide the textarea actions.

List items use theme variables for surface, border, primary text, and muted heading colors. Both light and dark themes must maintain readable contrast.

## Flomo Formatting

`buildFlomoMemo` joins saved entries with one newline (`\n`). No blank line, timestamp, generated number, bullet, or separator is inserted between entries.

The structural blank line before the `记录：` heading remains unchanged. User-authored line breaks inside an individual entry are preserved.

## Testing and Verification

Unit tests assert that multiple entries are rendered consecutively with a single newline and that no empty line appears between them.

Browser verification covers saving two entries, reopening the sheet, seeing both entries in order, confirming the count, and checking history scrolling and text wrapping at desktop, 390-pixel, and 320-pixel widths. Browser QA does not select `结束`, so it cannot create a real Flomo memo.

## Out of Scope

This change does not add editing, deleting, reordering, collapsing, searching, timestamps, numbering, or showing saved entry content on the main timer view.
