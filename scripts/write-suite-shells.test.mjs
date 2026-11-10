import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { suitePageShell } from "./write-suite-shells.mjs";

test("POS social previews identify the product before JavaScript loads", () => {
  const html = suitePageShell(readFileSync("index.html", "utf8"), { title: "BloomSuite POS", description: 'Checkout & "inventory"', url: "https://bloomsuite.app/pos", image: "https://bloomsuite.app/pos/manager-workspace.webp" });
  assert.match(html, /<title>BloomSuite POS<\/title>/);
  assert.match(html, /property="og:title" content="BloomSuite POS"/);
  assert.match(html, /name="twitter:title" content="BloomSuite POS"/);
  assert.match(html, /rel="canonical" href="https:\/\/bloomsuite.app\/pos"/);
  assert.match(html, /Checkout &amp; &quot;inventory&quot;/);
  assert.match(html, /manager-workspace.webp/);
  assert.doesNotMatch(html, /application\/ld\+json/);
  assert.match(html, /src="\/src\/main.tsx"/);
});

test("the product launcher is not indexed", () => {
  const html = suitePageShell(readFileSync("index.html", "utf8"), { title: "Your BloomSuite products", description: "Choose your workspace", url: "https://bloomsuite.app/suite", robots: "noindex, follow" });
  assert.match(html, /name="robots" content="noindex, follow"/);
});
