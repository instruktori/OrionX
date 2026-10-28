const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../src");
const text = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = text("lib/i18n.ts");
const en = JSON.parse(source.match(/export const en = ([\s\S]*?) as const;/)[1]);
const ka = JSON.parse(source.match(/export const ka = ([\s\S]*?) satisfies/)[1]);
const placeholders = (value) => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map(v => v[1]).sort();
test("English and Georgian dictionaries have identical semantic keys", () => {
  assert.deepEqual(Object.keys(ka).sort(), Object.keys(en).sort());
  assert.ok(Object.keys(en).length >= 300, "Substantive shared vocabulary must be present");
});
test("Translations are Unicode Georgian text with aligned dynamic slots", () => {
  for (const [key, value] of Object.entries(en)) {
    assert.ok(typeof ka[key] === "string" && ka[key].trim(), key);
    assert.deepEqual(placeholders(ka[key]), placeholders(value), key);
    assert.ok(!/\b(undefined|null)\b/.test(ka[key]), key);
  }
  assert.match(ka["passport.demoIssuer"], /დემო/);
  assert.match(ka["verify.btuAttested"], /უნივერსიტეტ/);
});
test("English is the default and a same-site cookie persists changes without URL rewriting", () => {
  const layout = text("app/layout.tsx");
  const provider = text("lib/i18n-provider.tsx");
  const selector = text("components/language-selector.tsx");
  assert.match(source, /DEFAULT_LOCALE: Locale = "en"/);
  assert.match(layout, /await cookies\(\)/);
  assert.match(layout, /<html lang=\{locale\}/);
  assert.match(provider, /Path=\/; Max-Age=31536000; SameSite=Lax/);
  assert.match(provider, /document\.documentElement\.lang = next/);
  assert.match(provider, /router\.refresh\(\)/);
  assert.doesNotMatch(provider, /(?:router\.(?:push|replace)|location\.assign|location\.href)/);
  assert.match(selector, /<select/);
  assert.match(selector, /aria-label=\{t\("common.language"\)\}/);
});
test("Original PDF and API data remain outside locale messages", () => {
  const passport = text("app/passport/page.tsx");
  assert.match(passport, /\/me\/passport\/versions\/\$\{version\}\/download/);
  assert.match(passport, /type="application\/pdf"/);
  assert.doesNotMatch(text("lib/i18n.ts"), /officialBtu=true/);
});
