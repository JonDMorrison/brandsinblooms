import { TNewsletterBlock, registry } from '../../blocks/registry';

export function getMagazineA(): TNewsletterBlock[] {
  return [
    registry.hero.defaults(),
    registry.articleList.defaults(),
    registry.twoColumn.defaults(),
    registry.promoBand.defaults(),
    registry.footer.defaults(),
  ];
}
