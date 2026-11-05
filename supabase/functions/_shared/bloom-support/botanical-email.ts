/**
 * Bloom Support botanical email primitives.
 *
 * Visual contract matches BloomSites premium-botanical.ts
 * (cms-brandsinblooms src/lib/emails/premium-botanical.ts) and BloomSuite POS
 * _shared/email-design.ts / _shared/botanical-email.ts. Built on the CRM's
 * existing copy of that contract, src/lib/email/premiumBotanical.ts (palette,
 * icons, escaping), and adds the hero, panels, quotes, buttons and page shell
 * that BloomSites uses. support_emails_test.ts pins the palette and icon host
 * to the BloomSites values so drift is caught.
 *
 * Table layout, inline styles and hosted first-party PNG icons work in Outlook,
 * Gmail and Apple Mail without web fonts, CSS backgrounds or emojis. Decorative
 * images never carry a required fact or action: every icon has alt="" and the
 * label next to it carries the meaning.
 *
 * Pure string rendering: no I/O and no Deno globals.
 */
import { BLOOM_EMAIL, type BloomEmailIcon, bloomEmailEscape, bloomEmailIcon } from "../../../../src/lib/email/premiumBotanical.ts";

export const PREMIUM_BOTANICAL_EMAIL = Object.freeze({
  navy: BLOOM_EMAIL.navy,
  /** BloomSites body ink (premium-botanical.ts `ink`). */
  ink: "#243D55",
  body: BLOOM_EMAIL.body,
  muted: BLOOM_EMAIL.muted,
  sage: BLOOM_EMAIL.sage,
  page: BLOOM_EMAIL.ivory,
  /** BloomSites hero and footer panel (premium-botanical.ts `panel`). */
  panel: "#F5F7F3",
  /** Section/callout panel: BloomSites calloutBlock and POS POS_EMAIL_ART.panel. */
  callout: BLOOM_EMAIL.panel,
  border: BLOOM_EMAIL.border,
  white: BLOOM_EMAIL.white,
});

export type BotanicalEmailIcon = BloomEmailIcon;

export const BOTANICAL_ICON_BASE = "https://bloomsites.app/email/premium-icons/";

export const esc = (value: unknown): string => bloomEmailEscape(value);

/** Only https links without credentials reach an href. */
export function safeUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) return "";
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : "";
  } catch {
    return "";
  }
}

/** Optional illustration only. Labels and values remain readable if disabled. */
export function botanicalEmailIcon(name: BotanicalEmailIcon, size = 42): string {
  return bloomEmailIcon(name, size);
}

/** One semantic row: icon, bold label, value. Values are plain text. */
export interface BotanicalEmailFact {
  label: string;
  value: string;
  icon: BotanicalEmailIcon;
}
export function botanicalEmailFacts(rows: BotanicalEmailFact[]): string {
  const t = PREMIUM_BOTANICAL_EMAIL;
  if (rows.length === 0) return "";
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">' +
    rows.map((row, index) => (
      '<tr><td width="54" valign="top" style="width:54px;vertical-align:top;padding:' +
      (index === 0 ? "14px" : "18px") + " 8px 15px 4px;border-bottom:1px solid " + t.border + '">' +
      botanicalEmailIcon(row.icon, 42) +
      '</td><td valign="top" style="vertical-align:top;padding:' +
      (index === 0 ? "17px" : "21px") + " 4px 17px 4px;border-bottom:1px solid " + t.border +
      ";font-size:15px;line-height:1.65;color:" + t.body + '">' +
      '<strong style="font-weight:700;color:' + t.navy + '">' + esc(row.label) +
      '</strong><span style="color:' + t.muted + '">&nbsp; · &nbsp;</span>' + esc(row.value) +
      "</td></tr>"
    )).join("") + "</table>";
}

/** Compact branded hero (BloomSites botanicalEmailHero). */
export function botanicalEmailHero(eyebrow: string, heading: string, copy?: string, icon: BotanicalEmailIcon = "leaf"): string {
  const t = PREMIUM_BOTANICAL_EMAIL;
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
    'style="margin:0 0 22px;background:' + t.panel + ";border:1px solid " + t.border +
    ';border-radius:16px"><tr><td style="padding:24px 20px 20px">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>' +
    '<td valign="top" style="vertical-align:top;padding-right:10px">' +
    '<p style="margin:0 0 9px;color:' + t.sage +
    ';font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">' +
    esc(eyebrow) + '</p><h1 class="bs-title" style="margin:0 0 11px;color:' + t.navy +
    ';font-size:29px;line-height:1.2;letter-spacing:-.02em;font-weight:700">' +
    esc(heading) + "</h1>" + (copy
      ? '<p style="margin:0;color:' + t.body + ';font-size:15px;line-height:1.65">' + esc(copy) + "</p>"
      : "") + "</td>" +
    '<td width="52" align="right" valign="top" style="width:52px;vertical-align:top">' +
    botanicalEmailIcon(icon, 48) + "</td></tr></table></td></tr></table>";
}

/**
 * Titled panel (POS posEmailSection / BloomSites calloutBlock). `html` must be
 * built from escaped fragments; it is not re-escaped here.
 */
export function botanicalEmailSection(title: string, html: string, icon: BotanicalEmailIcon = "leaf"): string {
  const t = PREMIUM_BOTANICAL_EMAIL;
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
    'style="margin:18px 0;background:' + t.callout + ";border:1px solid " + t.border +
    ';border-radius:14px"><tr><td style="padding:18px">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 6px"><tr>' +
    '<td width="51" valign="middle" style="width:51px;vertical-align:middle">' + botanicalEmailIcon(icon, 38) + "</td>" +
    '<td valign="middle" style="vertical-align:middle;font-size:18px;line-height:1.35;font-weight:700;color:' + t.navy + '">' +
    esc(title) + '</td></tr></table><div style="color:' + t.body + ';font-size:14px;line-height:1.65">' +
    html + "</div></td></tr></table>";
}

/** Escaped paragraph in body copy. */
export function botanicalEmailParagraph(text: string, opts: { muted?: boolean; size?: number; margin?: string } = {}): string {
  const t = PREMIUM_BOTANICAL_EMAIL;
  return '<p style="margin:' + (opts.margin ?? "0 0 10px") + ";color:" + (opts.muted ? t.muted : t.body) +
    ";font-size:" + (opts.size ?? 15) + 'px;line-height:1.65">' +
    esc(text).replace(/\n/g, "<br />") + "</p>";
}

/** Bulleted list of escaped lines. */
export function botanicalEmailList(items: string[]): string {
  const t = PREMIUM_BOTANICAL_EMAIL;
  if (!items.length) return "";
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">' +
    items.map((item) =>
      '<tr><td width="18" valign="top" style="width:18px;vertical-align:top;padding:2px 0 6px;color:' + t.sage +
      ';font-size:15px;line-height:1.6;font-weight:700">&#8226;</td><td valign="top" style="vertical-align:top;padding:2px 0 6px;color:' +
      t.body + ';font-size:14px;line-height:1.6">' + esc(item) + "</td></tr>"
    ).join("") + "</table>";
}

/** A quoted message, as said to a customer. */
export function botanicalEmailQuote(text: string, meta?: string): string {
  const t = PREMIUM_BOTANICAL_EMAIL;
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 10px"><tr>' +
    '<td style="padding:12px 14px;background:' + t.white + ";border:1px solid " + t.border + ";border-left:3px solid " + t.sage +
    ';border-radius:10px;color:' + t.ink + ';font-size:14px;line-height:1.6">' +
    (meta ? '<div style="margin:0 0 4px;color:' + t.muted + ';font-size:12px;line-height:1.4">' + esc(meta) + "</div>" : "") +
    esc(text).replace(/\n/g, "<br />") + "</td></tr></table>";
}

/** Bulletproof primary button (POS emailButton), navy by default. */
export function botanicalEmailButton(label: string, href: string, color: string = PREMIUM_BOTANICAL_EMAIL.navy): string {
  const url = safeUrl(href);
  if (!url) return "";
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="bs-button" style="margin:20px 0 8px"><tr>' +
    '<td bgcolor="' + color + '" style="border-radius:8px;background:' + color + '">' +
    '<a href="' + esc(url) + '" style="display:inline-block;padding:14px 22px;font-size:16px;font-weight:700;line-height:24px;color:#FFFFFF;text-decoration:none;border-radius:8px">' +
    esc(label) + "</a></td></tr></table>";
}

/** Small text links under the primary button. */
export function botanicalEmailLinks(links: Array<{ label: string; href: string }>): string {
  const t = PREMIUM_BOTANICAL_EMAIL;
  const parts = links.map((l) => ({ label: l.label, url: safeUrl(l.href) })).filter((l) => l.url);
  if (!parts.length) return "";
  return '<p style="margin:4px 0 0;font-size:14px;line-height:1.6;color:' + t.muted + '">' +
    parts.map((l) => '<a href="' + esc(l.url) + '" style="color:' + t.sage + ';font-weight:700;text-decoration:underline">' + esc(l.label) + "</a>")
      .join('<span style="color:' + t.muted + '">&nbsp; · &nbsp;</span>') + "</p>";
}

/**
 * Page shell (BloomSites renderBotanicalNotificationEmail): navy header with the
 * sender name, hero, body, panel footer. `bodyHtml` must be built from escaped
 * fragments.
 */
export function renderBotanicalEmail(args: {
  header: string;
  eyebrow: string;
  title: string;
  intro?: string;
  preheader: string;
  bodyHtml: string;
  icon?: BotanicalEmailIcon;
  footer: string;
}): string {
  const t = PREMIUM_BOTANICAL_EMAIL;
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width,initial-scale=1" />' +
    '<meta name="x-apple-disable-message-reformatting" />' +
    '<meta name="color-scheme" content="light only" /><meta name="supported-color-schemes" content="light only" />' +
    "<title>" + esc(args.title) + "</title>" +
    "<style>@media only screen and (max-width:480px){.bs-pad{padding:20px 16px!important}.bs-title{font-size:24px!important}.bs-button a{display:block!important;text-align:center}}</style>" +
    "</head>" +
    '<body style="margin:0;padding:0;background:' + t.page + ";font-family:Arial,Helvetica,sans-serif;color:" + t.ink + '">' +
    '<div style="display:none;max-width:0;max-height:0;overflow:hidden;opacity:0;mso-hide:all">' + esc(args.preheader) + "</div>" +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="' + t.page + '" style="background:' + t.page + '">' +
    '<tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" ' +
    'style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid ' + t.border + ';border-radius:15px;overflow:hidden">' +
    '<tr><td bgcolor="' + t.navy + '" class="bs-pad" style="padding:22px 26px;background:' + t.navy +
    ';color:#FFFFFF;font-size:21px;line-height:1.4;font-weight:700">' + esc(args.header) + "</td></tr>" +
    '<tr><td class="bs-pad" style="padding:24px 24px 26px">' +
    botanicalEmailHero(args.eyebrow, args.title, args.intro, args.icon ?? "leaf") +
    '<div style="font-size:15px;line-height:1.65;color:' + t.body + '">' + args.bodyHtml + "</div></td></tr>" +
    '<tr><td class="bs-pad" style="padding:17px 24px;background:' + t.panel + ";border-top:1px solid " + t.border +
    ";font-size:12px;line-height:1.5;color:" + t.muted + '">' + esc(args.footer) + "</td></tr>" +
    "</table></td></tr></table></body></html>";
}
