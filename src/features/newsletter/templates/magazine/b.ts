import { TNewsletterBlock, registry } from '../../blocks/registry';

export function getMagazineB(): TNewsletterBlock[] {
  const testimonial: TNewsletterBlock = { id: crypto.randomUUID(), type: 'quote', text: 'Our plants transformed my backyard!', author: 'Happy Customer' } as any;
  return [
    registry.text.defaults(), // Feature story (use text with long body)
    { ...registry.articleList.defaults(), items: [
      { title: 'Card 1', excerpt: 'Quick tip...', imageUrl: '' },
      { title: 'Card 2', excerpt: 'Quick tip...', imageUrl: '' },
      { title: 'Card 3', excerpt: 'Quick tip...', imageUrl: '' }
    ], columns: 3 } as any,
    testimonial,
    registry.socialLinks.defaults(),
    registry.footer.defaults(),
  ];
}
