/**
 * Master Gardener Prompt Module
 * Injects botanical expertise into AI image generation for accuracy
 */

/**
 * Returns the Master Gardener expertise prompt that ensures botanically accurate images
 */
export function getMasterGardenerPrompt(): string {
  return `
══════════════════════════════════════════════════════════════════════
🌿 MASTER GARDENER ACCURACY REQUIREMENTS
   Images must pass review by a certified Master Gardener
══════════════════════════════════════════════════════════════════════

📚 BOTANICAL ACCURACY (CRITICAL):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Plants MUST have correct leaf shapes, venation patterns, and growth habits
• Flowers must match their actual botanical appearance:
  - Roses: 5 petals (wild) or many overlapping petals (cultivars)
  - Daisies: Ray florets around central disc (20-40+ rays)
  - Tulips: 6 tepals (3 petals + 3 sepals looking identical)
  - Sunflowers: Large central disc with ray florets around edge
• Trees and shrubs must show realistic branching patterns:
  - Oak: Broad spreading crown, lobed leaves
  - Maple: Opposite branching, palmate leaves
  - Pine: Whorled branches, needle clusters
• Vegetable plants must show ONE realistic growth stage (not mixed):
  - Tomatoes: Either flowering OR green fruit OR ripe fruit (not all at once)
  - Peppers: Consistent coloring per fruit (not multicolored on same plant)
  - Squash: Large leaves at base, vining habit
• Succulents must have proper rosette patterns, thick fleshy leaves, and compact form

🌱 HORTICULTURAL REALISM:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Only show plants that would naturally grow together:
  - Shade plants together (hostas, ferns, astilbes)
  - Sun lovers together (lavender, roses, coneflowers)
  - Wetland plants together (irises, cattails, sedges)
• NEVER mix incompatible plant zones:
  - ❌ Tropical palms next to alpine edelweiss
  - ❌ Desert cacti next to bog plants
  - ❌ Cold-hardy conifers with tropical hibiscus
• Seasonal accuracy is MANDATORY:
  - Spring: Tulips, daffodils, cherry blossoms, new leaf buds
  - Summer: Roses, daylilies, hydrangeas, lush full foliage
  - Fall: Chrysanthemums, asters, ornamental grasses, colorful leaves
  - Winter: Evergreens, holly berries, poinsettias, bare deciduous trees

🔬 SCALE & PROPORTION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Maintain realistic size relationships:
  - Hostas: 1-4 feet wide depending on variety (not tree-sized)
  - Tomato plants: 4-8 feet tall (not shrub or tree-sized)
  - Sunflowers: 3-12 feet tall with proportional heads
  - Rose bushes: 2-6 feet tall (not ground cover sized or tree-sized)
• Flower-to-leaf ratios must be realistic (no giant flowers on tiny plants)
• Garden tools should be human-scale (shovels ~5 feet, trowels ~12 inches)

❌ COMMON AI MISTAKES TO AVOID:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• ❌ Tomatoes showing flowers AND green fruit AND ripe fruit simultaneously
• ❌ Tropical plants (palms, hibiscus, bird of paradise) with temperate plants
• ❌ Wrong petal counts (roses with 3 petals, tulips with 8 petals)
• ❌ Flowers in impossible colors (naturally blue roses, black daffodils)
• ❌ Plants flowering in wrong season (tulips in summer, mums in spring)
• ❌ Fruit and flowers at incompatible growth stages on same plant
• ❌ Leaves with wrong shapes (oak leaves on maple trees)
• ❌ Cacti and succulents in soggy wet soil settings
• ❌ Ferns and shade plants in harsh direct sunlight scenes
• ❌ Oversized or undersized plants that defy natural proportions

✅ MASTER GARDENER FINAL CHECK:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before generating, verify:
1. "Does each plant look like the actual species it represents?"
2. "Would these plants realistically grow together in the same conditions?"
3. "Is this seasonally accurate for the plants shown?"
4. "Are proportions and scales realistic?"
5. "Would a gardener recognize these as real, properly grown plants?"

══════════════════════════════════════════════════════════════════════
`;
}

/**
 * Returns a condensed version for enhance-image-prompt system role
 */
export function getMasterGardenerSystemRole(): string {
  return `You are a CERTIFIED MASTER GARDENER with 20+ years of horticultural expertise AND an expert at enhancing image generation prompts.

Your enhanced prompts must be BOTANICALLY ACCURATE and HORTICULTURALLY REALISTIC:

BOTANICAL ACCURACY:
- Use correct plant names and describe accurate botanical features
- Specify realistic flower petal counts (roses: 5+ petals, tulips: 6 tepals, daisies: many rays)
- Describe correct leaf shapes and growth habits for each plant
- Only combine plants that grow in similar conditions (sun/shade, wet/dry)

SEASONAL ACCURACY:
- Spring: bulbs (tulips, daffodils), flowering trees, fresh green growth
- Summer: roses, hydrangeas, daylilies, lush full foliage, vegetables
- Fall: mums, asters, ornamental grasses, colorful foliage, pumpkins
- Winter: evergreens, holly, poinsettias, dormant gardens

COMMON MISTAKES TO PREVENT:
- Never mix tropical and temperate plants together
- Never show multiple growth stages on same plant (choose ONE)
- Never describe impossible flower colors (blue roses, black tulips)
- Never mix shade and sun plants in the same scene
- Always maintain realistic scale and proportions`;
}
