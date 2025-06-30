/**
 * Extracts meaningful keywords from raw text for image searching with garden center context
 * @param raw - The raw text content to extract keywords from
 * @param fallback - Default keyword to use if no valid keywords found
 * @returns Space-separated keywords enhanced with garden center context
 */
export const extractKeywords = (raw: string, fallback = 'garden center plants'): string => {
  if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
    return fallback;
  }

  // Define garden center related terms for better context
  const gardenCenterTerms = {
    plants: /\b(plant|flower|bloom|seed|seedling|herb|vegetable|tree|shrub|fern|succulent|orchid|rose|lily|tulip|daisy|sunflower|marigold|petunia|impatiens|begonia|geranium|pansy|violet|iris|daffodil|crocus|hyacinth|azalea|rhododendron|hydrangea|camellia|jasmine|lavender|rosemary|basil|mint|thyme|oregano|sage|parsley|cilantro|chives|tomato|pepper|cucumber|lettuce|spinach|kale|cabbage|broccoli|carrot|radish|onion|garlic|potato|bean|pea|corn|squash|pumpkin|melon|strawberry|grape|apple|orange|lemon|lime|peach|cherry|plum|fig|avocado|banana|mango|pineapple|palm|pine|oak|maple|birch|willow|elm|poplar|cedar|fir|spruce|juniper|cypress|yew|boxwood|holly|ivy|moss|lichen|algae|fungus|mushroom|toadstool|spore|pollen|nectar|sap|resin|bark|root|stem|leaf|branch|twig|trunk|canopy|foliage|bud|shoot|cutting|graft|clone|hybrid|cultivar|variety|species|genus|family|kingdom|phylum|class|order)\b/gi,
    tools: /\b(tool|shovel|spade|rake|hoe|trowel|pruner|shear|scissor|clipper|saw|knife|blade|handle|grip|wheelbarrow|cart|bucket|pot|container|planter|basket|tray|saucer|stake|cage|trellis|fence|gate|path|walkway|stone|rock|gravel|mulch|compost|fertilizer|nutrient|soil|dirt|earth|clay|sand|loam|humus|manure|lime|sulfur|nitrogen|phosphorus|potassium|calcium|magnesium|iron|zinc|copper|boron|molybdenum|pH|acid|alkaline|neutral|water|irrigation|sprinkler|hose|nozzle|timer|valve|pipe|fitting|pump|filter|drain|gutter|downspout|rain|storm|flood|drought|frost|freeze|thaw|melt|ice|snow|hail|wind|breeze|gust|calm|still|humid|dry|wet|moist|damp|soggy|saturated|wilted|drooped|yellowed|browned|spotted|diseased|infected|infested|pest|bug|insect|aphid|spider|mite|thrip|whitefly|scale|mealybug|caterpillar|grub|worm|slug|snail|rodent|bird|deer|rabbit|squirrel|chipmunk|mole|vole|gopher|groundhog|raccoon|opossum|skunk|fox|coyote|bear|snake|lizard|frog|toad|turtle|fish|bee|wasp|hornet|ant|fly|mosquito|gnat|midge|termite|cockroach|beetle|weevil|borer|miner|leafhopper|planthopper|cicada|cricket|grasshopper|locust|moth|butterfly|dragonfly|damselfly|mayfly|caddisfly|stonefly|lacewing|ladybug|praying mantis|stick insect|walking stick|leaf insect|assassin bug|stink bug|shield bug|seed bug|lace bug|plant bug|mirid|capsid|blind bug|flower bug|minute pirate bug|big-eyed bug|damsel bug|nabid|reduviid|wheel bug|ambush bug|thread-legged bug|stiletto fly|thick-headed fly|bee fly|hover fly|syrphid|flower fly|dance fly|long-legged fly|thick-headed fly|stiletto fly|robber fly|asilid|horse fly|deer fly|black fly|sand fly|biting midge|gall midge|fungus gnat|sciarid|dark-winged fungus gnat|bibionid|march fly|love bug|crane fly|tipulid|phantom midge|chaoborid|mosquito|culicid|biting midge|ceratopogonid|black fly|simuliid|sand fly|psychodid|moth fly|drain fly|owl midge|dixid|meniscus midge|thaumaleidae|solitary midge|deuterophlebiidae|mountain midge)\b/gi,
    care: /\b(care|water|watering|irrigation|fertilize|fertilizer|prune|pruning|trim|trimming|cut|cutting|transplant|transplanting|repot|repotting|mulch|mulching|weed|weeding|pest|disease|treatment|spray|dust|granule|organic|natural|chemical|synthetic|prevention|control|management|maintenance|schedule|timing|season|spring|summer|fall|autumn|winter|dormant|active|growth|blooming|flowering|fruiting|harvest|harvesting|picking|gathering|storing|preserving|canning|freezing|drying|curing|processing|preparing|cooking|eating|tasting|enjoying|sharing|giving|selling|marketing|advertising|promoting|displaying|arranging|decorating|landscaping|designing|planning|installing|building|constructing|creating|making|crafting|art|beauty|color|texture|form|shape|size|height|width|depth|length|weight|volume|density|hardiness|tolerance|resistance|susceptibility|adaptability|flexibility|durability|longevity|lifespan|age|maturity|youth|vigor|health|wellness|fitness|strength|weakness|stress|strain|pressure|tension|compression|expansion|contraction|movement|motion|stillness|rest|sleep|dormancy|hibernation|estivation|migration|dispersal|spread|propagation|reproduction|breeding|mating|pollination|fertilization|germination|sprouting|emergence|establishment|colonization|invasion|naturalization|domestication|cultivation|agriculture|horticulture|forestry|botany|ecology|biology|chemistry|physics|geology|meteorology|climatology|geography|cartography|surveying|mapping|measurement|monitoring|observation|recording|documentation|research|study|experiment|test|trial|evaluation|assessment|analysis|interpretation|conclusion|recommendation|advice|guidance|instruction|education|training|learning|teaching|sharing|communication|collaboration|cooperation|partnership|relationship|community|society|culture|tradition|heritage|history|evolution|development|progress|advancement|improvement|innovation|invention|discovery|exploration|adventure|journey|travel|destination|location|place|site|area|region\b/gi
  };

  // Lowercase and clean the text
  const cleaned = raw
    .toLowerCase()
    .replace(/[#*_`~\[\]()]/g, ' ')  // Remove markdown characters
    .replace(/[^\w\s]/g, ' ')        // Remove punctuation, keep words and spaces
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .trim();

  console.log('[KEYWORDS] Cleaned content:', cleaned.substring(0, 100));

  // Find garden center related terms
  const foundTerms = new Set<string>();
  
  // Check for plant-related terms
  const plantMatches = cleaned.match(gardenCenterTerms.plants);
  if (plantMatches) {
    plantMatches.slice(0, 2).forEach(term => foundTerms.add(term));
  }
  
  // Check for tool-related terms
  const toolMatches = cleaned.match(gardenCenterTerms.tools);
  if (toolMatches) {
    toolMatches.slice(0, 1).forEach(term => foundTerms.add(term));
  }
  
  // Check for care-related terms
  const careMatches = cleaned.match(gardenCenterTerms.care);
  if (careMatches) {
    careMatches.slice(0, 1).forEach(term => foundTerms.add(term));
  }

  console.log('[KEYWORDS] Found garden center terms:', Array.from(foundTerms));

  // If we found relevant terms, use them
  if (foundTerms.size > 0) {
    const result = Array.from(foundTerms).join(' ') + ' garden center';
    console.log('[KEYWORDS] Using found terms with context:', result);
    return result;
  }

  // Fallback to generic keyword extraction
  const tokens = cleaned
    .split(/\s+/)
    .filter(token => {
      // Only keep alphabetic tokens with 3+ characters, excluding common words
      return /^[a-z]+$/.test(token) && 
             token.length >= 3 && 
             !['your', 'this', 'that', 'they', 'them', 'their', 'here', 'there', 'when', 'what', 'where', 'how', 'why', 'who', 'will', 'have', 'been', 'with', 'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'throughout', 'alongside', 'within', 'could', 'would', 'should', 'might', 'must', 'can', 'may', 'shall', 'will', 'do', 'does', 'did', 'has', 'had', 'was', 'were', 'are', 'is', 'am', 'be', 'being', 'been', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'whose', 'that', 'this', 'these', 'those', 'some', 'any', 'all', 'each', 'every', 'both', 'either', 'neither', 'many', 'much', 'few', 'little', 'more', 'most', 'less', 'least', 'very', 'quite', 'rather', 'too', 'so', 'such', 'just', 'only', 'even', 'also', 'still', 'yet', 'already', 'now', 'then', 'soon', 'later', 'again', 'once', 'twice', 'often', 'always', 'never', 'sometimes', 'usually', 'generally', 'particularly', 'especially', 'specifically', 'exactly', 'precisely', 'approximately', 'roughly', 'about', 'around', 'near', 'close', 'far', 'away', 'here', 'there', 'everywhere', 'anywhere', 'somewhere', 'nowhere'].includes(token);
    })
    .slice(0, 2); // Take first 2 valid tokens

  // Return enhanced tokens or fallback
  if (tokens.length > 0) {
    const result = tokens.join(' ') + ' garden center plants';
    console.log('[KEYWORDS] Using fallback tokens with garden center context:', result);
    return result;
  }

  console.log('[KEYWORDS] Using default fallback:', fallback);
  return fallback;
};
