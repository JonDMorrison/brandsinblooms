import { assert, assertEquals, assertFalse, assertMatch, assertNotMatch } from "@std/assert";
import {
  BLOOMSUITE_LOGO_URL, botanicalClientAvatar, clientLogoUrl, clientWebsite, renderBotanicalEmail,
} from "./botanical-email.ts";
import { brandFromSources, cmsSiteWebsite } from "./client-brand.ts";
import { renderAlertEmail, renderCustomerEmail, renderDigestEmail, renderEscalationEmail, type StaffTicket, groupAlertFindings } from "./support-emails.ts";

const APP = "https://bloomsuite.app";
const NOW = new Date("2026-11-03T18:00:00Z");
const FLOWERHOUSE = {
  name: "The Flowerhouse",
  website: "theflowerhousegardencenter.com",
  logoUrl: "https://cdn.bloomsuite.app/5e7d2797-4169-46ae-b2d2-db3cb6990b7a/images/Untitled_design_51_1787004526652_42rp8.jpg",
};
const t1011: StaffTicket = {
  id: "5c8e8a77-3f1d-4c55-9d0b-1f2a3b4c5d6e", number: 1011, product: "cms", kind: "bug", status: "working", stage: "investigating",
  subject: "Logo won't save on the fundraising page", created_at: "2026-11-02T17:27:24Z", account: { name: "The Flowerhouse" }, messages: [],
};
const customer = (client?: Parameters<typeof renderCustomerEmail>[0]["client"]) =>
  renderCustomerEmail({ number: 1011, subject: t1011.subject, status: "working", purpose: "acknowledgement", bodies: ["Thanks, we've got it."], trackUrl: "https://bloomsuite.app/support/track/abc", client });
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
const imgs = (html: string) => [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);

Deno.test("every support email header carries the BloomSuite logo with alt text and fixed size", () => {
  const mails = [
    customer().html,
    renderEscalationEmail({ escalation: { reason: "ticket_overdue" }, ticket: t1011, appUrl: APP, now: NOW }).html,
    renderAlertEmail(groupAlertFindings([{ condition: "worker_not_running" }])[0], { appUrl: APP }).html,
    renderDigestEmail({ needs_you: [], resolved: [{ number: 1, subject: "x", client: null, by_bloom: true, summary: null }], said: [], repairs: [], alerts: [] }, { appUrl: APP, date: "Thu" })!.html,
  ];
  for (const html of mails) {
    const logo = imgs(html).find((i) => i.includes(BLOOMSUITE_LOGO_URL));
    assert(logo, "header logo present");
    assertMatch(logo, /alt="Open BloomSuite"/);
    assertMatch(logo, /width="44"/);
    assertMatch(logo, /height="44"/);
    assert(hrefs(html).includes("https://bloomsuite.app/"), "links to bloomsuite.app");
    // The sender name is text, so the header still reads with images blocked.
    assertMatch(html, />Bloom Support<\/td>/);
  }
  assertEquals(BLOOMSUITE_LOGO_URL, "https://bloomsuite.app/pos/features-assets/bloomsuite-logo.png");
});

Deno.test("clientWebsite accepts https URLs and bare hostnames, home page only", () => {
  assertEquals(clientWebsite("theflowerhousegardencenter.com"), { href: "https://theflowerhousegardencenter.com/", label: "theflowerhousegardencenter.com" });
  assertEquals(clientWebsite("https://www.westcoastgardens.ca/"), { href: "https://www.westcoastgardens.ca/", label: "westcoastgardens.ca" });
  assertEquals(clientWebsite(" HTTPS://Example.COM/shop?x=1#y "), { href: "https://example.com/", label: "example.com" });
  assertEquals(clientWebsite("horsford-gardens-and-nursery.bloomsites.app")?.href, "https://horsford-gardens-and-nursery.bloomsites.app/");
});

Deno.test("clientWebsite rejects javascript:, http:, credentials, ports, IPs and odd input", () => {
  for (const bad of [
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", "java\nscript:alert(1)", "data:text/html,<b>x</b>", "http://example.com", "ftp://example.com",
    "//example.com", "https://user:pw@example.com", "https://example.com:8443/", "https://127.0.0.1/", "https://localhost/", "localhost",
    "192.168.0.1", "example", "exa mple.com", "example.com\"onmouseover=\"x", "<script>.com", "https://exa_mple.com/", "", "   ",
    null, undefined, 42, { href: "https://example.com" }, "a".repeat(3000) + ".com", "mailto:someone@example.com", "example.com:80",
  ]) {
    assertEquals(clientWebsite(bad), null, `rejects ${JSON.stringify(bad)?.slice(0, 40)}`);
  }
});

Deno.test("clientLogoUrl only allows our own hosted PNG/JPEG/GIF uploads over https", () => {
  assertEquals(clientLogoUrl(FLOWERHOUSE.logoUrl), FLOWERHOUSE.logoUrl);
  const crm = "https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/company-assets/a2f02f74/company-logo.jpeg?t=1777072008985";
  assertEquals(clientLogoUrl(crm), crm);
  for (const bad of [
    "https://cdn11.bigcommerce.com/s-7foht5vda7/images/logo.png", "http://cdn.bloomsuite.app/x.png", "https://cdn.bloomsuite.app/x.svg",
    "https://cdn.bloomsuite.app/x.webp", "https://udldmkqwnxhdeztyqcau.supabase.co/rest/v1/x.png", "https://evil.supabase.co/storage/v1/object/public/x.png",
    "javascript:alert(1)", "https://user@cdn.bloomsuite.app/x.png", "https://cdn.bloomsuite.app:444/x.png", "", null,
  ]) assertEquals(clientLogoUrl(bad), "", `rejects ${bad}`);
});

Deno.test("customer email names the client and links their website when it is known", () => {
  const mail = customer(FLOWERHOUSE);
  assertMatch(mail.html, /Request for <strong[^>]*>The Flowerhouse<\/strong>/);
  assert(hrefs(mail.html).includes("https://theflowerhousegardencenter.com/"));
  assertMatch(mail.html, />theflowerhousegardencenter\.com<\/a>/);
  assert(imgs(mail.html).some((i) => i.includes(FLOWERHOUSE.logoUrl) && /width="34"/.test(i) && /height="34"/.test(i)), "client logo avatar");
  assertMatch(mail.text, /Request for The Flowerhouse · https:\/\/theflowerhousegardencenter\.com\//);
});

Deno.test("an unsafe website or logo never reaches the customer email; the name still shows", () => {
  const mail = customer({ name: "Evil <b>Co</b>", website: "javascript:alert(document.cookie)", logoUrl: "https://tracker.example.com/pixel.png" });
  assertNotMatch(mail.html, /javascript:|tracker\.example\.com/);
  assertMatch(mail.html, /Evil &lt;b&gt;Co&lt;\/b&gt;/);
  assertFalse(/<b>Co<\/b>/.test(mail.html));
  for (const h of hrefs(mail.html)) assertMatch(h, /^https:\/\//);
  const http = customer({ name: "Plain Co", website: "http://plainco.com" });
  assertFalse(hrefs(http.html).some((h) => h.includes("plainco.com")));
  assertNotMatch(http.text, /plainco\.com/);
});

Deno.test("customer email without a client or without a logo keeps its layout", () => {
  const none = customer(null);
  assertNotMatch(none.html, /Request for/);
  assertEquals(imgs(none.html).filter((i) => !i.includes("premium-icons") && !i.includes(BLOOMSUITE_LOGO_URL)).length, 0);
  const noLogo = customer({ name: "Horsford Gardens and Nursery", website: "horsfordnursery.com", logoUrl: null });
  assertMatch(noLogo.html, /Request for <strong[^>]*>Horsford Gardens and Nursery<\/strong>/);
  assertMatch(noLogo.html, />H<\/td>/, "initial as the text fallback");
  assert(hrefs(noLogo.html).includes("https://horsfordnursery.com/"));
  // Same table structure either way: every opened table is closed.
  for (const html of [none.html, noLogo.html]) assertEquals((html.match(/<table/g) ?? []).length, (html.match(/<\/table>/g) ?? []).length);
});

Deno.test("needs-you email: client row links the website and shows the logo avatar", () => {
  const mail = renderEscalationEmail({ escalation: { reason: "ticket_overdue" }, ticket: t1011, appUrl: APP, now: NOW, client: FLOWERHOUSE });
  assert(hrefs(mail.html).includes("https://theflowerhousegardencenter.com/"));
  assertMatch(mail.html, /Client<\/strong>.*The Flowerhouse.*theflowerhousegardencenter\.com<\/a>/s);
  assert(imgs(mail.html).some((i) => i.includes(FLOWERHOUSE.logoUrl) && /width="42"/.test(i)));
  assertMatch(mail.text, /Client: The Flowerhouse · https:\/\/theflowerhousegardencenter\.com\//);
  // No logo: initial instead, website still linked.
  const plain = renderEscalationEmail({ escalation: { reason: "ticket_overdue" }, ticket: t1011, appUrl: APP, now: NOW, client: { name: "The Flowerhouse", website: "theflowerhousegardencenter.com" } });
  assertMatch(plain.html, />T<\/td>/);
  assert(hrefs(plain.html).includes("https://theflowerhousegardencenter.com/"));
});

Deno.test("needs-you email ignores brand for a ticket without an account and rejects unsafe links", () => {
  const noAccount = renderEscalationEmail({ escalation: { reason: "ticket_overdue" }, ticket: { ...t1011, account: null, requester: { name: "Pat" } }, appUrl: APP, now: NOW, client: FLOWERHOUSE });
  assertNotMatch(noAccount.html, /theflowerhousegardencenter/);
  const bad = renderEscalationEmail({ escalation: { reason: "ticket_overdue" }, ticket: t1011, appUrl: APP, now: NOW, client: { name: "x", website: "http://theflowerhousegardencenter.com" } });
  assertNotMatch(bad.html, /theflowerhousegardencenter/);
  assertNotMatch(bad.text, /theflowerhousegardencenter/);
});

Deno.test("avatar escapes the initial and never emits an external image", () => {
  assertMatch(botanicalClientAvatar({ name: "<script>" }), />S<\/td>/);
  assertMatch(botanicalClientAvatar({ name: "" }), />\?<\/td>/);
  assertNotMatch(botanicalClientAvatar({ name: "A", logoUrl: "https://example.com/a.png" }), /<img/);
});

Deno.test("brand sources: BloomSites site first, then the CRM profile; unverified or unpublished sites are skipped", () => {
  assertEquals(cmsSiteWebsite({ subdomain: "the-flowerhouse-2", custom_domain: "theflowerhousegardencenter.com", custom_domain_status: "verified", is_active: true, is_published: true }), "theflowerhousegardencenter.com");
  assertEquals(cmsSiteWebsite({ subdomain: "the-flowerhouse-2", custom_domain: "theflowerhousegardencenter.com", custom_domain_status: "pending", is_active: true, is_published: true }), "the-flowerhouse-2.bloomsites.app");
  assertEquals(cmsSiteWebsite({ subdomain: "draft", is_active: true, is_published: false }), null);
  assertEquals(cmsSiteWebsite({ subdomain: "off", is_active: false, is_published: true }), null);
  assertEquals(cmsSiteWebsite({ subdomain: "../x", is_published: true }), null);
  const b = brandFromSources("The Flowerhouse", { subdomain: "the-flowerhouse-2", custom_domain: "theflowerhousegardencenter.com", custom_domain_status: "verified", is_published: true, logo_url: "https://cdn11.bigcommerce.com/logo.png" },
    { website_url: "https://other.example.com", logo_url: "https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/company-assets/u/company-logo.jpeg" });
  assertEquals(b.website, "theflowerhousegardencenter.com");
  assertEquals(b.logoUrl, "https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/company-assets/u/company-logo.jpeg");
  assertEquals(brandFromSources("West Coast Gardens", null, { website_url: "javascript:x", tenant_website: "westcoastgardens.ca" }).website, "westcoastgardens.ca");
  assertEquals(brandFromSources("Nobody", null, null), { name: "Nobody", website: null, logoUrl: null });
});

Deno.test("page shell: no fact lives only in an image", () => {
  const html = renderBotanicalEmail({ header: "Bloom Support", eyebrow: "E", title: "T", preheader: "P", bodyHtml: "", footer: "F" });
  // Strip every image: the sender, the BloomSuite name and its address remain as text.
  const text = html.replace(/<img\b[^>]*>/g, "").replace(/<[^>]+>/g, " ");
  assertMatch(text, /Bloom Support/);
  assertMatch(text, /BloomSuite/);
  assertMatch(text, /bloomsuite\.app/);
});
