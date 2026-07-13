# Flomo Record Bullets Design

## Goal

Format every individual progress record sent to Flomo as a Markdown bullet.

## Scope

`buildFlomoMemo` remains the single place that creates Flomo content. It will preserve the existing header, event metadata, and `记录：` label. Within that section, each item in `entries` will render on its own line as `- <entry>` in input order.

The application stores and sends entries as plain strings. The API request contract and validation do not change.

## Error Handling

No new error conditions are introduced. Existing validation continues to remove empty entries before memo construction.

## Testing

Update the formatter unit test to assert that every record line begins with `- ` while the surrounding memo content remains unchanged.

## Out of Scope

This change does not alter event metadata, entry storage, API payloads, entry ordering, or Flomo webhook behavior.
