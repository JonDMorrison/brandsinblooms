import { TNewsletterBlock, registry } from '../../newsletter/blocks/registry';

// Very small inline-styles email renderer. Produces a simple HTML string.
export function renderToString(blocks: TNewsletterBlock[]): string {
  const parts: string[] = [];
  const open = '<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;">';
  const close = '</div>';

  parts.push('<!doctype html>');
  parts.push('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><meta charSet="utf-8"/></head><body style="margin:0;padding:0;background:#ffffff;">');
  parts.push(open);

  for (const block of blocks) {
    // Reuse the simple HTML structure from registry renderers where possible
    // For the email string, we compose minimal HTML that most clients accept
    switch (block.type) {
      case 'hero': {
        const b = block as any;
        if (b.imageUrl) parts.push(`<img src="${b.imageUrl}" alt="${escapeHtml(b.title || 'Hero')}" style="display:block;width:100%;height:auto;"/>`);
        parts.push(`<h1 style="font-size:24px;line-height:1.3;margin:16px 0 4px 0;">${escapeHtml(b.title || '')}</h1>`);
        if (b.subtitle) parts.push(`<p style="color:#6B7280;margin:0 0 8px 0;">${escapeHtml(b.subtitle)}</p>`);
        if (b.ctaText && b.ctaUrl) parts.push(`<div style="margin:12px 0;"><a href="${b.ctaUrl}" style="background:#16A34A;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;display:inline-block;">${escapeHtml(b.ctaText)}</a></div>`);
        break;
      }
      case 'text': {
        const b = block as any;
        if (b.heading) parts.push(`<h2 style="font-size:18px;line-height:1.4;margin:16px 0 8px 0;">${escapeHtml(b.heading)}</h2>`);
        parts.push(`<div style="font-size:14px;line-height:1.6;">${b.body || ''}</div>`);
        break;
      }
      case 'image': {
        const b = block as any;
        if (!b.imageUrl) break;
        const img = `<img src="${b.imageUrl}" alt="${escapeHtml(b.alt || '')}" style="display:block;width:100%;height:auto;"/>`;
        parts.push(b.href ? `<a href="${b.href}">${img}</a>` : img);
        break;
      }
      case 'articleList': {
        const b = block as any;
        const col = b.columns === 3 ? 3 : 2;
        const width = Math.floor(600 / col);
        parts.push(`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0;">`);
        for (let i = 0; i < b.items.length; i += col) {
          parts.push('<tr>');
          for (let j = 0; j < col; j++) {
            const it = b.items[i + j];
            if (!it) { parts.push(`<td width="${width}"></td>`); continue; }
            parts.push(`<td width="${width}" style="vertical-align:top;padding:6px;">`);
            if (it.imageUrl) parts.push(`<img src="${it.imageUrl}" alt="${escapeHtml(it.title)}" style="display:block;width:100%;height:auto;border-radius:6px;"/>`);
            parts.push(`<div style="font-weight:600;margin:8px 0 4px 0;">${escapeHtml(it.title)}</div>`);
            if (it.excerpt) parts.push(`<div style="font-size:13px;color:#6B7280;margin-bottom:6px;">${escapeHtml(it.excerpt)}</div>`);
            if (it.href) parts.push(`<a href="${it.href}" style="color:#1E40AF;text-decoration:underline;">Read more</a>`);
            parts.push('</td>');
          }
          parts.push('</tr>');
        }
        parts.push('</table>');
        break;
      }
      case 'promoBand': {
        const b = block as any;
        parts.push(`<div style="background:#F3F4F6;padding:12px 16px;border-radius:6px;margin:8px 0;display:flex;justify-content:space-between;align-items:center;">`);
        parts.push(`<div style="font-weight:600;">${escapeHtml(b.text)}</div>`);
        if (b.ctaText && b.ctaUrl) parts.push(`<a href="${b.ctaUrl}" style="background:#16A34A;color:#ffffff;text-decoration:none;padding:8px 12px;border-radius:6px;">${escapeHtml(b.ctaText)}</a>`);
        parts.push(`</div>`);
        break;
      }
      case 'cta': {
        const b = block as any;
        parts.push(`<div style="text-align:center;margin:12px 0;"><a href="${b.url}" style="background:#16A34A;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;display:inline-block;">${escapeHtml(b.text)}</a></div>`);
        break;
      }
      case 'divider': {
        const b = block as any;
        parts.push(`<hr style="border:0;border-top:${b.thickness ?? 1}px solid ${b.color || '#E5E7EB'};margin:12px 0;"/>`);
        break;
      }
      case 'gallery': {
        const b = block as any;
        const col = b.columns === 4 ? 4 : 3;
        const width = Math.floor(600 / col);
        parts.push(`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0;">`);
        for (let i = 0; i < b.images.length; i += col) {
          parts.push('<tr>');
          for (let j = 0; j < col; j++) {
            const it = b.images[i + j];
            if (!it) { parts.push(`<td width="${width}"></td>`); continue; }
            parts.push(`<td width="${width}" style="vertical-align:top;padding:6px;">`);
            const img = `<img src="${it.imageUrl}" alt="${escapeHtml(it.alt || '')}" style="display:block;width:100%;height:auto;border-radius:6px;"/>`;
            parts.push(it.href ? `<a href="${it.href}">${img}</a>` : img);
            parts.push('</td>');
          }
          parts.push('</tr>');
        }
        parts.push('</table>');
        break;
      }
      case 'quote': {
        const b = block as any;
        parts.push(`<blockquote style="font-style:italic;text-align:center;margin:16px 0;">${escapeHtml(b.text)}${b.author ? `<footer style=\"font-size:12px;color:#6B7280;margin-top:6px;\">— ${escapeHtml(b.author)} </footer>` : ''}</blockquote>`);
        break;
      }
      case 'socialLinks': {
        const b = block as any;
        parts.push('<div style="text-align:center;margin:12px 0;">');
        for (const l of b.links) parts.push(`<a href="${l.url}" style="margin:0 8px;color:#374151;text-decoration:underline;">${escapeHtml(l.platform)}</a>`);
        parts.push('</div>');
        break;
      }
      case 'footer': {
        const b = block as any;
        parts.push('<div style="font-size:12px;color:#6B7280;margin:16px 0;">');
        if (b.text) parts.push(`<div>${escapeHtml(b.text)}</div>`);
        if (b.address) parts.push(`<div>${escapeHtml(b.address)}</div>`);
        if (b.unsubscribeUrl) parts.push(`<div><a href="${b.unsubscribeUrl}" style="color:#1E40AF;">Unsubscribe</a></div>`);
        parts.push('</div>');
        break;
      }
      default:
        break;
    }
  }

  parts.push(close);
  parts.push('</body></html>');
  return parts.join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
