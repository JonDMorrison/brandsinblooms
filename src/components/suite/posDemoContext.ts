import topics from '../../../content/pos-demo-topics.json';

// URL hints are editable demo preferences, never price, identity or permission inputs.
export function posDemoMessage(params: URLSearchParams): string {
  const feature = params.get('feature') ?? '';
  const compare = params.get('compare') ?? '';
  const goals = (params.get('goals') ?? '').split(',').slice(0, 4);
  const features = topics.features as Record<string, string>;
  const comparisons = topics.comparisons as Record<string, string>;
  const selected = [...new Set([feature, ...goals])]
    .filter(key => Object.prototype.hasOwnProperty.call(features, key))
    .map(key => features[key]);
  const lines = ['I would like a BloomSuite POS demonstration for my garden centre.'];
  if (Object.prototype.hasOwnProperty.call(comparisons, compare)) {
    lines.push(`I would like to compare BloomSuite POS with ${comparisons[compare]}.`);
  }
  if (selected.length) lines.push(`Please show us: ${selected.join('; ')}.`);
  lines.push('Our current POS, store locations and equipment:');
  return lines.join('\n\n').slice(0, 900);
}
