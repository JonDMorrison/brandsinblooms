import React from 'react';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';

// Basic block type definitions for magazine-style newsletters
export type NewsletterBlockType =
  | 'hero'
  | 'text'
  | 'image'
  | 'twoColumn'
  | 'articleList'
  | 'gallery'
  | 'promoBand'
  | 'cta'
  | 'divider'
  | 'quote'
  | 'socialLinks'
  | 'footer';

export interface BaseBlock<T extends NewsletterBlockType = NewsletterBlockType> {
  id: string;
  type: T;
}

export type NewsletterBlock =
  | (BaseBlock<'hero'> & { title: string; subtitle?: string; imageUrl?: string; ctaText?: string; ctaUrl?: string })
  | (BaseBlock<'text'> & { heading?: string; body: string; align?: 'left' | 'center' | 'right' })
  | (BaseBlock<'image'> & { imageUrl?: string; alt?: string; href?: string; align?: 'left' | 'center' | 'right' })
  | (BaseBlock<'twoColumn'> & { left: NewsletterBlock; right: NewsletterBlock })
  | (BaseBlock<'articleList'> & { items: { imageUrl?: string; title: string; excerpt?: string; href?: string }[]; columns?: 2 | 3 })
  | (BaseBlock<'gallery'> & { images: { imageUrl?: string; alt?: string; href?: string }[]; columns?: 3 | 4 })
  | (BaseBlock<'promoBand'> & { text: string; ctaText?: string; ctaUrl?: string })
  | (BaseBlock<'cta'> & { text: string; url: string; align?: 'left' | 'center' | 'right' })
  | (BaseBlock<'divider'> & { thickness?: number; color?: string })
  | (BaseBlock<'quote'> & { text: string; author?: string })
  | (BaseBlock<'socialLinks'> & { links: { platform: 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'youtube'; url: string }[] })
  | (BaseBlock<'footer'> & { text?: string; address?: string; unsubscribeUrl?: string });

export interface BlockRegistryItem<T extends NewsletterBlockType = NewsletterBlockType> {
  id: T;
  label: string;
  defaults: () => Extract<NewsletterBlock, { type: T }>;
  EditComponent: React.FC<{
    block: Extract<NewsletterBlock, { type: T }>;
    onChange: (next: Extract<NewsletterBlock, { type: T }>) => void;
  }>;
  RenderComponent: React.FC<{ block: Extract<NewsletterBlock, { type: T }>; isPreview?: boolean }>;
}

export type NewsletterBlocksRegistry = {
  [K in NewsletterBlockType]: BlockRegistryItem<K>;
};

// Shared small editors to keep implementation compact
const TextInput: React.FC<{
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  textarea?: boolean;
}> = ({ label, value, onChange, textarea }) => (
  <label className="block mb-3">
    <span className="block text-sm text-muted-foreground mb-1">{label}</span>
    {textarea ? (
      <textarea className="w-full border rounded-md p-2 bg-background" value={value || ''} onChange={(e) => onChange(e.target.value)} />
    ) : (
      <input className="w-full border rounded-md p-2 bg-background" value={value || ''} onChange={(e) => onChange(e.target.value)} />
    )}
  </label>
);

const LinkInput: React.FC<{ label: string; value?: string; onChange: (v?: string) => void }> = ({ label, value, onChange }) => (
  <TextInput label={label} value={value || ''} onChange={(v) => onChange(v || undefined)} />
);

// Simple renderers using email-friendly containers (max-width 600px)
const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ maxWidth: 600, margin: '0 auto' }}>{children}</div>
);

const HeroRender: React.FC<{ block: Extract<NewsletterBlock, { type: 'hero' }> }> = ({ block }) => (
  <Container>
    {block.imageUrl && (
      <img src={block.imageUrl} alt={block.title || 'Hero'} style={{ width: '100%', display: 'block' }} />
    )}
    <h1 className="text-2xl font-bold mt-4">{block.title}</h1>
    {block.subtitle && <p className="text-muted-foreground mt-2">{block.subtitle}</p>}
    {block.ctaText && block.ctaUrl && (
      <div className="mt-4">
        <a href={block.ctaUrl} className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground">
          {block.ctaText}
        </a>
      </div>
    )}
  </Container>
);

const TextRender: React.FC<{ block: Extract<NewsletterBlock, { type: 'text' }> }> = ({ block }) => (
  <Container>
    {block.heading && <h2 className="text-xl font-semibold mb-2">{block.heading}</h2>}
    <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: block.body }} />
  </Container>
);

const ImageRender: React.FC<{ block: Extract<NewsletterBlock, { type: 'image' }> }> = ({ block }) => (
  <Container>
    {block.href ? (
      <a href={block.href}><img src={block.imageUrl} alt={block.alt || ''} style={{ width: '100%', display: 'block' }} /></a>
    ) : (
      <img src={block.imageUrl} alt={block.alt || ''} style={{ width: '100%', display: 'block' }} />
    )}
  </Container>
);

const DividerRender: React.FC<{ block: Extract<NewsletterBlock, { type: 'divider' }> }> = ({ block }) => (
  <Container>
    <hr style={{ border: 0, borderTop: `${block.thickness ?? 1}px solid ${block.color || 'hsl(var(--muted-foreground))'}` }} />
  </Container>
);

const CTARender: React.FC<{ block: Extract<NewsletterBlock, { type: 'cta' }> }> = ({ block }) => (
  <Container>
    <div className={block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : ''}>
      <a href={block.url} className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground">
        {block.text}
      </a>
    </div>
  </Container>
);

const PromoRender: React.FC<{ block: Extract<NewsletterBlock, { type: 'promoBand' }> }> = ({ block }) => (
  <div className="w-full" style={{ background: 'hsl(var(--muted))' }}>
    <Container>
      <div className="flex items-center justify-between py-4">
        <span className="font-medium">{block.text}</span>
        {block.ctaText && block.ctaUrl && (
          <a href={block.ctaUrl} className="inline-block px-3 py-1 rounded-md bg-primary text-primary-foreground">
            {block.ctaText}
          </a>
        )}
      </div>
    </Container>
  </div>
);

const SocialRender: React.FC<{ block: Extract<NewsletterBlock, { type: 'socialLinks' }> }> = ({ block }) => (
  <Container>
    <div className="flex items-center gap-4 justify-center py-4">
      {block.links.map((l, i) => (
        <a key={i} href={l.url} className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
          {l.platform}
        </a>
      ))}
    </div>
  </Container>
);

const FooterRender: React.FC<{ block: Extract<NewsletterBlock, { type: 'footer' }> }> = ({ block }) => (
  <Container>
    <div className="text-xs text-muted-foreground py-6">
      {block.text && <p className="mb-2">{block.text}</p>}
      {block.address && <p className="mb-2">{block.address}</p>}
      {block.unsubscribeUrl && (
        <p>
          <a href={block.unsubscribeUrl} className="underline">Unsubscribe</a>
        </p>
      )}
    </div>
  </Container>
);

// Editors (kept simple to cover main fields). Use MediaSelectorImage where images are needed.
const HeroEdit: BlockRegistryItem<'hero'>['EditComponent'] = ({ block, onChange }) => (
  <div className="space-y-3">
    <TextInput label="Title" value={block.title} onChange={(v) => onChange({ ...block, title: v })} />
    <TextInput label="Subtitle" value={block.subtitle} onChange={(v) => onChange({ ...block, subtitle: v })} />
    <div>
      <span className="block text-sm text-muted-foreground mb-1">Hero Image</span>
      <MediaSelectorImage src={block.imageUrl} onChange={(url) => onChange({ ...block, imageUrl: url })} contentContext="newsletter-hero" />
    </div>
    <TextInput label="CTA Text" value={block.ctaText || ''} onChange={(v) => onChange({ ...block, ctaText: v })} />
    <LinkInput label="CTA URL" value={block.ctaUrl} onChange={(v) => onChange({ ...block, ctaUrl: v })} />
  </div>
);

const TextEdit: BlockRegistryItem<'text'>['EditComponent'] = ({ block, onChange }) => (
  <div className="space-y-3">
    <TextInput label="Heading" value={block.heading || ''} onChange={(v) => onChange({ ...block, heading: v })} />
    <TextInput label="Body (HTML allowed)" value={block.body} onChange={(v) => onChange({ ...block, body: v })} textarea />
  </div>
);

const ImageEdit: BlockRegistryItem<'image'>['EditComponent'] = ({ block, onChange }) => (
  <div className="space-y-3">
    <div>
      <span className="block text-sm text-muted-foreground mb-1">Image</span>
      <MediaSelectorImage src={block.imageUrl} onChange={(url) => onChange({ ...block, imageUrl: url })} contentContext="newsletter-image" />
    </div>
    <TextInput label="Alt text" value={block.alt || ''} onChange={(v) => onChange({ ...block, alt: v })} />
    <LinkInput label="Link URL" value={block.href} onChange={(v) => onChange({ ...block, href: v })} />
  </div>
);

const DividerEdit: BlockRegistryItem<'divider'>['EditComponent'] = ({ block, onChange }) => (
  <div className="flex gap-3">
    <TextInput label="Thickness" value={String(block.thickness ?? 1)} onChange={(v) => onChange({ ...block, thickness: Number(v) || 1 })} />
    <TextInput label="Color" value={block.color || ''} onChange={(v) => onChange({ ...block, color: v })} />
  </div>
);

const CTAEdit: BlockRegistryItem<'cta'>['EditComponent'] = ({ block, onChange }) => (
  <div className="space-y-3">
    <TextInput label="Text" value={block.text} onChange={(v) => onChange({ ...block, text: v })} />
    <LinkInput label="URL" value={block.url} onChange={(v) => onChange({ ...block, url: v || '' })} />
  </div>
);

const PromoEdit: BlockRegistryItem<'promoBand'>['EditComponent'] = ({ block, onChange }) => (
  <div className="space-y-3">
    <TextInput label="Text" value={block.text} onChange={(v) => onChange({ ...block, text: v })} />
    <TextInput label="CTA Text" value={block.ctaText || ''} onChange={(v) => onChange({ ...block, ctaText: v })} />
    <LinkInput label="CTA URL" value={block.ctaUrl} onChange={(v) => onChange({ ...block, ctaUrl: v })} />
  </div>
);

const SocialEdit: BlockRegistryItem<'socialLinks'>['EditComponent'] = ({ block, onChange }) => (
  <div className="space-y-2">
    {(block.links || []).map((l, i) => (
      <div key={i} className="grid grid-cols-2 gap-2">
        <TextInput label="Platform" value={l.platform} onChange={(v) => {
          const links = [...block.links];
          links[i] = { ...l, platform: v as any };
          onChange({ ...block, links });
        }} />
        <TextInput label="URL" value={l.url} onChange={(v) => {
          const links = [...block.links];
          links[i] = { ...l, url: v };
          onChange({ ...block, links });
        }} />
      </div>
    ))}
    <button type="button" className="text-primary text-sm" onClick={() => onChange({ ...block, links: [...(block.links || []), { platform: 'instagram', url: '' }] })}>+ Add link</button>
  </div>
);

const FooterEdit: BlockRegistryItem<'footer'>['EditComponent'] = ({ block, onChange }) => (
  <div className="space-y-3">
    <TextInput label="Footer text" value={block.text || ''} onChange={(v) => onChange({ ...block, text: v })} />
    <TextInput label="Address" value={block.address || ''} onChange={(v) => onChange({ ...block, address: v })} />
    <LinkInput label="Unsubscribe URL" value={block.unsubscribeUrl} onChange={(v) => onChange({ ...block, unsubscribeUrl: v })} />
  </div>
);

// Defaults
const id = () => crypto.randomUUID();

export const registry: NewsletterBlocksRegistry = {
  hero: {
    id: 'hero',
    label: 'Hero',
    defaults: () => ({ id: id(), type: 'hero', title: 'Welcome to Our Newsletter', subtitle: 'Seasonal highlights and tips', imageUrl: '', ctaText: 'Shop Now', ctaUrl: '#' }),
    EditComponent: HeroEdit,
    RenderComponent: ({ block }) => <HeroRender block={block} />
  },
  text: {
    id: 'text',
    label: 'Text',
    defaults: () => ({ id: id(), type: 'text', heading: 'Section', body: 'Add your content here...', align: 'left' }),
    EditComponent: TextEdit,
    RenderComponent: ({ block }) => <TextRender block={block} />
  },
  image: {
    id: 'image',
    label: 'Image',
    defaults: () => ({ id: id(), type: 'image', imageUrl: '', alt: '', align: 'center' }),
    EditComponent: ImageEdit,
    RenderComponent: ({ block }) => <ImageRender block={block} />
  },
  twoColumn: {
    id: 'twoColumn',
    label: 'Two Column',
    defaults: () => ({ id: id(), type: 'twoColumn', left: { id: id(), type: 'text', body: 'Left column...' } as any, right: { id: id(), type: 'text', body: 'Right column...' } as any }),
    EditComponent: ({ block, onChange }) => (
      <div className="grid md:grid-cols-2 gap-4">
        {/* Very simple nested editors */}
        <div>
          <div className="text-sm font-medium mb-2">Left</div>
          {/* @ts-ignore - allow basic swap to text/image quickly */}
          <TextEdit block={(block.left.type === 'text' ? block.left : { ...block.left, type: 'text', body: '' }) as any} onChange={(left) => onChange({ ...block, left } as any)} />
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Right</div>
          {/* @ts-ignore */}
          <TextEdit block={(block.right.type === 'text' ? block.right : { ...block.right, type: 'text', body: '' }) as any} onChange={(right) => onChange({ ...block, right } as any)} />
        </div>
      </div>
    ),
    RenderComponent: ({ block }) => (
      <Container>
        <div className="grid md:grid-cols-2 gap-6">
          {/* @ts-ignore */}
          <TextRender block={(block.left.type === 'text' ? block.left : { ...block.left, type: 'text', body: '' }) as any} />
          {/* @ts-ignore */}
          <TextRender block={(block.right.type === 'text' ? block.right : { ...block.right, type: 'text', body: '' }) as any} />
        </div>
      </Container>
    )
  },
  articleList: {
    id: 'articleList',
    label: 'Article Cards',
    defaults: () => ({ id: id(), type: 'articleList', items: [{ title: 'Story 1', excerpt: 'Short excerpt...', imageUrl: '' }, { title: 'Story 2', excerpt: 'Short excerpt...', imageUrl: '' }], columns: 2 }),
    EditComponent: ({ block, onChange }) => (
      <div className="space-y-3">
        {(block.items || []).map((it, idx) => (
          <div key={idx} className="grid md:grid-cols-3 gap-2 items-end">
            <div className="md:col-span-1">
              <span className="block text-sm text-muted-foreground mb-1">Image</span>
              <MediaSelectorImage src={it.imageUrl} onChange={(url) => {
                const items = [...block.items];
                items[idx] = { ...it, imageUrl: url };
                onChange({ ...block, items });
              }} contentContext="newsletter-article" />
            </div>
            <div className="md:col-span-2 grid gap-2">
              <TextInput label="Title" value={it.title} onChange={(v) => { const items = [...block.items]; items[idx] = { ...it, title: v }; onChange({ ...block, items }); }} />
              <TextInput label="Excerpt" value={it.excerpt || ''} onChange={(v) => { const items = [...block.items]; items[idx] = { ...it, excerpt: v }; onChange({ ...block, items }); }} />
              <LinkInput label="Link" value={it.href} onChange={(v) => { const items = [...block.items]; items[idx] = { ...it, href: v }; onChange({ ...block, items }); }} />
            </div>
          </div>
        ))}
        <button type="button" className="text-primary text-sm" onClick={() => onChange({ ...block, items: [...block.items, { title: 'New story', excerpt: '', imageUrl: '' }] })}>+ Add article</button>
      </div>
    ),
    RenderComponent: ({ block }) => (
      <Container>
        <div className={`grid gap-4 ${block.columns === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {block.items.map((it, i) => (
            <div key={i} className="border rounded-md overflow-hidden">
              {it.imageUrl && <img src={it.imageUrl} alt={it.title} className="w-full h-40 object-cover" />}
              <div className="p-4">
                <div className="font-medium mb-1">{it.title}</div>
                {it.excerpt && <div className="text-sm text-muted-foreground mb-2">{it.excerpt}</div>}
                {it.href && <a href={it.href} className="text-primary underline-offset-4 hover:underline text-sm">Read more</a>}
              </div>
            </div>
          ))}
        </div>
      </Container>
    )
  },
  gallery: {
    id: 'gallery',
    label: 'Gallery',
    defaults: () => ({ id: id(), type: 'gallery', images: [], columns: 3 }),
    EditComponent: ({ block, onChange }) => (
      <div className="space-y-3">
        {(block.images || []).map((it, idx) => (
          <div key={idx} className="grid md:grid-cols-2 gap-2">
            <div>
              <span className="block text-sm text-muted-foreground mb-1">Image</span>
              <MediaSelectorImage src={it.imageUrl} onChange={(url) => { const images = [...block.images]; images[idx] = { ...it, imageUrl: url }; onChange({ ...block, images }); }} contentContext="newsletter-gallery" />
            </div>
            <div className="grid gap-2">
              <TextInput label="Alt" value={it.alt || ''} onChange={(v) => { const images = [...block.images]; images[idx] = { ...it, alt: v }; onChange({ ...block, images }); }} />
              <LinkInput label="Link" value={it.href} onChange={(v) => { const images = [...block.images]; images[idx] = { ...it, href: v }; onChange({ ...block, images }); }} />
            </div>
          </div>
        ))}
        <button type="button" className="text-primary text-sm" onClick={() => onChange({ ...block, images: [...block.images, { imageUrl: '' }] })}>+ Add image</button>
      </div>
    ),
    RenderComponent: ({ block }) => (
      <Container>
        <div className={`grid gap-2 ${block.columns === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          {block.images.map((it, i) => (
            <div key={i}>
              {it.href ? (
                <a href={it.href}><img src={it.imageUrl} alt={it.alt || ''} className="w-full h-40 object-cover rounded" /></a>
              ) : (
                <img src={it.imageUrl} alt={it.alt || ''} className="w-full h-40 object-cover rounded" />
              )}
            </div>
          ))}
        </div>
      </Container>
    )
  },
  promoBand: {
    id: 'promoBand',
    label: 'Promo',
    defaults: () => ({ id: id(), type: 'promoBand', text: 'Limited-time offer!', ctaText: 'Shop now', ctaUrl: '#' }),
    EditComponent: PromoEdit,
    RenderComponent: ({ block }) => <PromoRender block={block} />
  },
  cta: {
    id: 'cta',
    label: 'Button',
    defaults: () => ({ id: id(), type: 'cta', text: 'Click here', url: '#', align: 'center' }),
    EditComponent: CTAEdit,
    RenderComponent: ({ block }) => <CTARender block={block} />
  },
  divider: {
    id: 'divider',
    label: 'Divider',
    defaults: () => ({ id: id(), type: 'divider', thickness: 1, color: 'hsl(var(--muted-foreground))' }),
    EditComponent: DividerEdit,
    RenderComponent: ({ block }) => <DividerRender block={block} />
  },
  quote: {
    id: 'quote',
    label: 'Quote',
    defaults: () => ({ id: id(), type: 'quote', text: '“Gardening is the art that uses flowers and plants as paint”', author: 'Elizabeth Murray' }),
    EditComponent: ({ block, onChange }) => (
      <div className="space-y-3">
        <TextInput label="Quote" value={block.text} onChange={(v) => onChange({ ...block, text: v })} textarea />
        <TextInput label="Author" value={block.author || ''} onChange={(v) => onChange({ ...block, author: v })} />
      </div>
    ),
    RenderComponent: ({ block }) => (
      <Container>
        <blockquote className="italic text-center py-6">
          {block.text}
          {block.author && <footer className="text-sm mt-2 text-muted-foreground">— {block.author}</footer>}
        </blockquote>
      </Container>
    )
  },
  socialLinks: {
    id: 'socialLinks',
    label: 'Social',
    defaults: () => ({ id: id(), type: 'socialLinks', links: [] }),
    EditComponent: SocialEdit,
    RenderComponent: ({ block }) => <SocialRender block={block} />
  },
  footer: {
    id: 'footer',
    label: 'Footer',
    defaults: () => ({ id: id(), type: 'footer', text: 'You are receiving this email because you subscribed to updates.', address: '', unsubscribeUrl: '#' }),
    EditComponent: FooterEdit,
    RenderComponent: ({ block }) => <FooterRender block={block} />
  }
};

export type { NewsletterBlock as TNewsletterBlock };
