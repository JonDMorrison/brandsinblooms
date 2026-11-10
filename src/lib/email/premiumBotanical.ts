/**
 * BloomSuite CRM's shared, email-client-safe visual language for system mail.
 *
 * Aligns with the BloomSites/POS premium botanical email components.
 * Tables and inline styles work with Outlook/Gmail/Apple Mail. Decorative,
 * first-party PNGs are optional; no important information lives in images.
 *
 * This is intentionally separate from tenant-authored campaigns. Do not wrap
 * or overwrite existing Studio designs, merge tags, click tracking, required
 * preference/unsubscribe footers, or customer-selected brand colours.
 */
export const BLOOM_EMAIL = Object.freeze({
  navy:"#1B3049",
  body:"#536475",
  sage:"#527566",
  ivory:"#FAF9F6",
  panel:"#F8F9F6",
  white:"#FFFFFF",
  border:"#DBE3DF",
  muted:"#5B6B79",
});
export type BloomEmailIcon = "sun"|"water"|"soil"|"check"|"truck"|"calendar"|"mail"|"alert"|"leaf";
const ICONS="https://bloomsites.app/email/premium-icons/";
export const bloomEmailEscape=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export function bloomEmailIcon(name:BloomEmailIcon,size=44):string{
  const n=Math.max(20,Math.min(56,Math.round(size)));
  return '<img src="'+ICONS+name+'.png" alt="" width="'+n+'" height="'+n+
    '" style="display:block;border:0;width:'+n+'px;height:'+n+'px;object-fit:contain"/>';
}
function verifiedLink(v:string):string{
  try{const u=new URL(v);return u.protocol==="https:"&&!u.username&&!u.password&&u.href.length<=2048?u.href:"";}catch{return "";}
}
export function bloomEmailFact(label:string,value:string,icon:BloomEmailIcon="leaf"):string{
 const t=BLOOM_EMAIL;return '<tr><td width="54" valign="top" style="width:54px;padding:12px 8px 14px 2px;border-bottom:1px solid '+
 t.border+'">'+bloomEmailIcon(icon,42)+'</td><td valign="top" style="padding:14px 2px;border-bottom:1px solid '+t.border+
 ';font-size:15px;line-height:1.65;color:'+t.body+'"><strong style="color:'+t.navy+'">'+bloomEmailEscape(label)+
 '</strong><span>&nbsp; · &nbsp;</span>'+bloomEmailEscape(value)+'</td></tr>';
}
export function bloomEmailCard(title:string,rows:Array<{label:string;value:string;icon:BloomEmailIcon}>,icon:BloomEmailIcon="leaf"):string{
 if(!rows.length)return "";const t=BLOOM_EMAIL;
 return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:18px 0;border:1px solid '+t.border+';border-radius:14px;background:#FFFFFF"><tr><td style="padding:18px">'+
 '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle" style="color:'+t.navy+';font-size:20px;line-height:1.3;font-weight:700">'+bloomEmailEscape(title)+'</td>'+
 '<td width="48" align="right">'+bloomEmailIcon(icon,42)+'</td></tr></table>'+
 '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'+
 rows.map(row=>bloomEmailFact(row.label,row.value,row.icon)).join("")+'</table></td></tr></table>';
}
export interface BloomSystemEmail {
 eyebrow:string;title:string;preheader?:string;bodyHtml:string;
 icon?:BloomEmailIcon;brandName?:string;action?:{label:string;url:string};
 footer?:string;
}
/**
 * Only for system-generated, already-escaped body markup. Never pass raw
 * user-supplied HTML as bodyHtml without escaping/sanitizing it first.
 */
export function renderBloomSystemEmail(p:BloomSystemEmail):string{
 const t=BLOOM_EMAIL,brand=bloomEmailEscape(p.brandName||"BloomSuite"),action=p.action&&verifiedLink(p.action.url);
 const button=action?'<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0"><tr><td bgcolor="'+t.navy+'" style="border-radius:8px;background:'+t.navy+'"><a href="'+bloomEmailEscape(action)+'" style="display:inline-block;padding:15px 22px;color:#FFFFFF;font-size:15px;line-height:22px;font-weight:700;text-decoration:none">'+bloomEmailEscape(p.action!.label)+'</a></td></tr></table>':"";
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>'+
 bloomEmailEscape(p.title)+'</title></head><body style="margin:0;padding:0;color:'+t.navy+';background:'+t.ivory+';font-family:Arial,Helvetica,sans-serif">'+
 '<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">'+bloomEmailEscape(p.preheader||p.title)+'</div>'+
 '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:'+t.ivory+'"><tr><td align="center" style="padding:24px 12px">'+
 '<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border:1px solid '+t.border+';border-radius:16px;background:#FFFFFF;overflow:hidden">'+
 '<tr><td bgcolor="'+t.navy+'" style="padding:25px 28px;background:'+t.navy+';color:#FFFFFF;font-size:22px;line-height:28px;font-weight:700">'+brand+'</td></tr>'+
 '<tr><td style="padding:26px 24px 29px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'+
 '<td valign="top" style="vertical-align:top;padding-right:9px"><p style="margin:0 0 9px;color:'+t.sage+';font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">'+bloomEmailEscape(p.eyebrow)+'</p>'+
 '<h1 style="margin:0 0 17px;color:'+t.navy+';font-size:29px;line-height:1.2;font-weight:700;letter-spacing:-.02em">'+bloomEmailEscape(p.title)+'</h1></td>'+
 '<td width="52" align="right" valign="top" style="width:52px">'+bloomEmailIcon(p.icon||"leaf",48)+'</td></tr></table>'+
 '<div style="font-size:15px;line-height:1.65;color:'+t.body+'">'+p.bodyHtml+'</div>'+button+
 '</td></tr><tr><td style="padding:20px 24px;border-top:1px solid '+t.border+';background:'+t.panel+';color:'+t.muted+';font-size:12px;line-height:1.6">'+
 bloomEmailEscape(p.footer||"BloomSuite — made for garden centres.")+
 '</td></tr></table></td></tr></table></body></html>';
}
