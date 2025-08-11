import { TNewsletterBlock, registry } from '../../blocks/registry';

export function getMagazineC(): TNewsletterBlock[] {
  const hero = registry.hero.defaults();
  hero.subtitle = 'Fresh arrivals and garden wisdom inside';
  const longText = registry.text.defaults();
  longText.heading = 'From the Editor';
  longText.body = 'Welcome to our seasonal letter...';
  const coupon: TNewsletterBlock = { id: crypto.randomUUID(), type: 'promoBand', text: 'Save 15% with code BLOOM15', ctaText: 'Redeem', ctaUrl: '#' } as any;
  const gallery = registry.gallery.defaults();
  gallery.images = new Array(6).fill(null).map(() => ({ imageUrl: '' } as any));
  return [hero as any, longText as any, gallery as any, coupon, registry.footer.defaults()];
}
