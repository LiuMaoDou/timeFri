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
