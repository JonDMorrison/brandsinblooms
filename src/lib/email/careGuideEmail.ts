/** Care Guide Email v1. Shared pure renderer for POS, BloomSites and CRM. Does not send mail or modify consent. */
export const CARE_GUIDE_EMAIL_VERSION = 1 as const;

export interface ReviewedCareGuidePlant {
  /** Resolved using the approved merchant SKU/variant to botanical identity mapping. */
  productId: string;
  name: string;
  botanicalName?: string | null;
  careVersion: string;
  care: { status: 'REVIEWED'; sun: string; water: string; soil: string; sourceLabel?: string };
  /** Caller has confirmed image licensing for customer messages. */
  approvedImageUrl?: string | null;
  publicProductUrl?: string | null;
}
export interface CareGuideBrand {
  storeName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  headline?: string | null;
  intro?: string | null;
  helpHeading?: string | null;
  helpBody?: string | null;
  helpUrl?: string | null;
  helpLinkText?: string | null;
  /** Pinned published version; draft designs must never enter the renderer. */
  publishedVersion: string;
}
export interface CareGuideEmailInput {
  brand: CareGuideBrand;
  plants: ReviewedCareGuidePlant[];
  /** Explicit one-time request or controlled staff test only. */
  requested: boolean;
}
export interface RenderedCareGuideEmail {
  version: 1;
  templateVersion: string;
  plantVersions: { productId: string; careVersion: string }[];
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c] || c));
const printable = (value: unknown, label: string, max: number): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw Error('Invalid ' + label);
  return value.trim();
};
const optional = (value: string | null | undefined, label: string, max: number): string =>
  value == null || value === '' ? '' : printable(value, label, max);
const hex = (value: string | null | undefined, fallback: string): string =>
  value && /^#[a-fA-F0-9]{6}$/.test(value) ? value : fallback;
const httpsUrl = (value: string | null | undefined): string => {
  if (!value || value.length > 2048) return '';
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
};
const row = (number: string, title: string, value: string, green: string): string =>
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #e3e5dc"><tr>' +
  '<td width="54" valign="top" style="width:54px;padding:19px 0;font-family:Georgia,serif;font-size:26px;line-height:32px;color:#b38b68">' + number + '</td>' +
  '<td style="padding:20px 0 19px"><p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:700;color:' + green + '">' + escapeHtml(title) + '</p>' +
  '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#59665c">' + escapeHtml(value) + '</p></td></tr></table>';

export function renderCareGuideEmail(input: CareGuideEmailInput): RenderedCareGuideEmail {
  if (!input?.requested) throw Error('Care guide requires a recorded customer request or staff test');
  const brand = input.brand;
  if (!brand || !Array.isArray(input.plants) || input.plants.length < 1 || input.plants.length > 12) throw Error('Choose 1–12 approved plants');
  const storeName = printable(brand.storeName, 'store name', 160);
  const templateVersion = printable(brand.publishedVersion, 'published template version', 80);
  const primary = hex(brand.primaryColor, '#173f37');
  const accent = hex(brand.accentColor, '#486d58');
  const single = input.plants.length === 1;
  const headline = optional(brand.headline, 'headline', 100) || (single ? 'A good start for something green.' : 'A good start for everything green.');
  const intro = optional(brand.intro, 'intro', 320) || (single ? 'A little guidance for your new plant. Here are three simple things to help it settle in.' : 'Your new plants have found their way home. Here is the care advice to help each one settle in.');
  const helpHeading = optional(brand.helpHeading, 'help heading', 100) || "Questions? We're still here.";
  const helpBody = optional(brand.helpBody, 'help copy', 400) || 'Bring a photo, stop by the shop, or ask us about your plant. Good gardening is something we grow together.';
  const helpUrl = httpsUrl(brand.helpUrl);
  const helpText = optional(brand.helpLinkText, 'help link text', 70) || 'Ask us about your plant';
  const logo = httpsUrl(brand.logoUrl);
  const seen = new Set<string>();
  const plants = input.plants.map(plant => {
    if (!plant || typeof plant !== 'object' || plant.care?.status !== 'REVIEWED') throw Error('Only reviewed plant care may be emailed');
    const productId = printable(plant.productId, 'product identity', 150);
    if (seen.has(productId)) throw Error('Duplicate product identity');
    seen.add(productId);
    return {
      productId,
      name: printable(plant.name, 'plant name', 160),
      botanicalName: optional(plant.botanicalName, 'botanical name', 180),
      careVersion: printable(plant.careVersion, 'approved care version', 100),
      sourceLabel: optional(plant.care.sourceLabel, 'care source', 180),
      image: httpsUrl(plant.approvedImageUrl),
      link: httpsUrl(plant.publicProductUrl),
      sun: printable(plant.care.sun, 'reviewed light advice', 1200),
      water: printable(plant.care.water, 'reviewed watering advice', 1200),
      soil: printable(plant.care.soil, 'reviewed soil advice', 1200),
    };
  });
  const lead = plants[0];
  const preheader = single ? 'Helpful tips to care for your ' + lead.name + '.' : 'Helpful care tips for the plants you brought home.';
  const subject = single ? 'Your ' + lead.name + ' care guide from ' + storeName : 'Your plant care guide from ' + storeName;
  const logoMarkup = logo ?
    '<img src="' + escapeHtml(logo) + '" alt="' + escapeHtml(storeName) + '" width="180" height="60" border="0" style="display:block;width:auto;max-width:180px;height:auto;max-height:60px;border:0">' :
    '<span style="font-family:Georgia,serif;font-size:23px;line-height:30px;color:' + primary + '">' + escapeHtml(storeName) + '</span>';
  const heroImage = lead.image ?
    '<td class="stack" width="43%" valign="top" bgcolor="#b7c6a3" style="width:43%;background-color:#b7c6a3"><img class="hero-img" src="' + escapeHtml(lead.image) + '" width="267" height="350" border="0" alt="' + escapeHtml(lead.name) + '" style="display:block;width:267px;max-width:100%;height:350px;object-fit:cover;border:0;color:' + primary + '"></td>' : '';
  const article = plants.map(plant => {
    const link = plant.link ? '<p style="margin:19px 0 0;font:700 13px/20px Arial,Helvetica,sans-serif"><a href="' + escapeHtml(plant.link) + '" style="color:' + primary + '">View this plant in our catalogue &rarr;</a></p>' : '';
    return '<tr><td class="pad" style="padding:34px 36px 8px">' +
      '<p style="margin:0 0 9px;font:700 10px/16px Arial,Helvetica,sans-serif;letter-spacing:2px;color:#8b785d">' + escapeHtml(plant.botanicalName || 'YOUR NEW PLANT') + '</p>' +
      '<h2 style="margin:0 0 9px;font-family:Georgia,serif;font-size:29px;line-height:36px;font-weight:400;color:' + primary + '">' + escapeHtml(plant.name) + '</h2>' +
      '<p style="margin:0 0 11px;font-family:Georgia,serif;font-size:21px;line-height:27px;color:' + primary + '">Three things it will love.</p>' +
      row('01', 'Light', plant.sun, primary) + row('02', 'Watering', plant.water, primary) + row('03', 'Soil & drainage', plant.soil, primary) + link +
      (plant.sourceLabel ? '<p style="margin:13px 0 0;font:11px/17px Arial,Helvetica,sans-serif;color:#7a8177">Care information: ' + escapeHtml(plant.sourceLabel) + '</p>' : '') +
      '</td></tr>';
  }).join('');
  const helpLink = helpUrl ?
    '<p style="margin:13px 0 0;font:700 13px/21px Arial,Helvetica,sans-serif"><a href="' + escapeHtml(helpUrl) + '" style="color:' + primary + '">' + escapeHtml(helpText) + ' &rarr;</a></p>' : '';
  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>' + escapeHtml(subject) + '</title>' +
    '<style>@media only screen and (max-width:620px){.shell{width:100%!important}.pad{padding-left:24px!important;padding-right:24px!important}.stack{display:block!important;width:100%!important}.hero-copy{padding:34px 26px!important}.hero-img{width:100%!important;height:auto!important}.hero-head{font-size:37px!important;line-height:1.1!important}}</style></head>' +
    '<body style="margin:0;padding:0;background-color:#eeeae0;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">' + escapeHtml(preheader) + '</div>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#eeeae0"><tr><td align="center" style="padding:30px 12px">' +
    '<table class="shell" role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:620px;max-width:620px;background-color:#fffdf8"><tr><td bgcolor="' + primary + '" style="height:8px;background-color:' + primary + ';font-size:0;line-height:8px">&nbsp;</td></tr>' +
    '<tr><td style="padding:26px 35px 25px;border-bottom:1px solid #e8e6dc"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td valign="middle">' + logoMarkup + '</td><td align="right" valign="middle" style="font:700 10px/18px Arial,Helvetica,sans-serif;letter-spacing:1.5px;color:#748477">THE PLANT NOTE</td></tr></table></td></tr>' +
    '<tr><td bgcolor="#e7eddf" style="background-color:#e7eddf"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="stack hero-copy" width="' + (heroImage ? '57%' : '100%') + '" valign="middle" style="padding:42px 29px 40px 35px"><p style="margin:0 0 18px;font:700 10px/16px Arial,Helvetica,sans-serif;letter-spacing:2px;color:' + accent + '">A LITTLE HELP AFTER YOU SHOP</p>' +
    '<h1 class="hero-head" style="margin:0 0 18px;font-family:Georgia,serif;font-size:42px;line-height:1.1;font-weight:400;letter-spacing:-1px;color:' + primary + '">' + escapeHtml(headline) + '</h1>' +
    '<p style="margin:0;font:14px/23px Arial,Helvetica,sans-serif;color:#37564b">' + escapeHtml(intro) + '</p></td>' + heroImage + '</tr></table></td></tr>' + article +
    '<tr><td class="pad" style="padding:30px 36px 35px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#f1eee6" style="padding:24px;background-color:#f1eee6"><p style="margin:0 0 9px;font:400 23px/29px Georgia,serif;color:' + primary + '">' + escapeHtml(helpHeading) + '</p><p style="margin:0;font:13px/21px Arial,Helvetica,sans-serif;color:#526359">' + escapeHtml(helpBody) + '</p>' + helpLink + '</td></tr></table></td></tr>' +
    '<tr><td bgcolor="' + primary + '" style="padding:25px 36px;background-color:' + primary + '"><p style="margin:0 0 6px;font:400 20px/26px Georgia,serif;color:#f3f0e7">Keep growing.</p><p style="margin:0 0 12px;font:12px/19px Arial,Helvetica,sans-serif;color:#d0dcd3">A little guidance today. A happier garden tomorrow.</p><p style="margin:0;font:10px/17px Arial,Helvetica,sans-serif;color:#b1c6bd">Sent by ' + escapeHtml(storeName) + ' because you requested plant care information. This email does not subscribe you to promotional messages.</p></td></tr>' +
    '</table></td></tr></table></body></html>';
  const lines = plants.flatMap(plant => [plant.name + (plant.botanicalName ? ' (' + plant.botanicalName + ')' : ''), 'Light: ' + plant.sun, 'Watering: ' + plant.water, 'Soil & drainage: ' + plant.soil, ...(plant.link ? ['View plant: ' + plant.link] : []), '']);
  const plain = [storeName, 'THE PLANT NOTE', '', headline, intro, '', ...lines, helpHeading, helpBody, ...(helpUrl ? [helpText + ': ' + helpUrl] : []), '', 'Sent because you requested plant care information. You were not subscribed to promotional messages.'].join('\n');
  return {version:CARE_GUIDE_EMAIL_VERSION,templateVersion,plantVersions:plants.map(p=>({productId:p.productId,careVersion:p.careVersion})),subject,html,text:plain};
}
