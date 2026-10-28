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
  assert.doesNotMatch(selector, /<select/);
  assert.match(selector, /<Languages size=\{17\}/);
  assert.match(selector, /className="icon-button theme-toggle language-toggle"/);
  assert.match(selector, /aria-label=\{t\("common.language"\)\}/);
  assert.match(selector, /role="menuitemradio"/);
  assert.match(selector, /aria-checked=\{locale === value\}/);
  assert.match(selector, /\["en", "ka"\] as const/);
});
test("Original PDF and API data remain outside locale messages", () => {
  const passport = text("app/passport/page.tsx");
  assert.match(passport, /\/me\/passport\/versions\/\$\{version\}\/download/);
  assert.match(passport, /type="application\/pdf"/);
  assert.doesNotMatch(text("lib/i18n.ts"), /officialBtu=true/);
});

test("Georgian landing has responsive headlines and never forces long labels into two tiny columns", () => {
  const home = text("app/page.tsx");
  const css = fs.readFileSync(path.resolve(root, "app/landing.module.css"), "utf8");
  const globalCss = text("app/globals.css");
  assert.match(home, /locale === "ka"/);
  assert.match(home, /home\.verify/);
  assert.match(css, /html\[lang="ka"\]/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /white-space: normal/);
  assert.match(css, /text-transform: uppercase/);
  assert.match(globalCss, /\.language-menu/);
  assert.match(globalCss, /max-width: 460px/);
  assert.ok(ka["home.titleLine2"].length < 24);
  assert.ok(ka["home.open"].length < 27);
});

test("iPhone header logo has bounded width and height (no intrinsic-image expansion)", () => {
  const css = text("app/globals.css");
  assert.match(css, /@media \(max-width: 460px\)[\s\S]*?\.public-header \.brand-logo\s*\{\s*width: 106px;[\s\S]*?height: 28px;[\s\S]*?overflow: hidden;/);
  assert.match(css, /@media \(min-width: 461px\) and \(max-width: 767px\)[\s\S]*?\.public-header \.brand-logo\s*\{\s*width: 115px;[\s\S]*?height: 30px;/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*?\.public-header \.brand-logo\s*\{\s*width: 96px;[\s\S]*?height: 25px;/);
  assert.match(css, /\.public-header \.brand-logo > \.brand-logo-img\s*\{\s*width: 100%;\s*height: 100%;\s*object-fit: contain;/);
  const logo = text("components/brand-logo.tsx");
  assert.match(logo, /\/orionx-logo-dark\.png/);
  assert.match(logo, /\/orionx-logo-light\.png/);
});
