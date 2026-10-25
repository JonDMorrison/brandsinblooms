import topics from '../../../content/product-guide-topics.json';

type ProductId = keyof typeof topics;
// URL input is untrusted. Only catalogue keys become an editable inquiry;
// no URL field determines price, permission, order state or automatic sending.
export function productGuideContext(params: URLSearchParams) {
  const product = params.get('product');
  if (!product || !Object.prototype.hasOwnProperty.call(topics, product)) return null;
  const data = topics[product as ProductId];
  const features: Record<string, string> = data.features;
  const comparisons: Record<string, string> = data.comparisons;
  const requested = [...new Set([params.get('guide'), ...(params.get('topics') || '').split(',')])]
    .filter((slug): slug is string => Boolean(slug && Object.prototype.hasOwnProperty.call(features, slug)))
    .slice(0, 6).map(slug => features[slug]);
  const comparisonKey = params.get('comparison') || '';
  const comparison = Object.prototype.hasOwnProperty.call(comparisons, comparisonKey) ? comparisons[comparisonKey] : '';
  const message = [`I'd like to explore ${data.name} for our garden centre.`,
    requested.length ? `Please include these topics in the demonstration:\n${requested.map(title => `• ${title}`).join('\n')}` : '',
    comparison ? `I'd also like to discuss how this fits alongside or compares with ${comparison}.` : '',
    'Please help us review the setup and confirm which workflows fit our store.'].filter(Boolean).join('\n\n');
  return { name: data.name, message };
}
