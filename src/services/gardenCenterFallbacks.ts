/**
 * Curated garden center fallback images and lightweight placeholder assets.
 */

interface FallbackImage {
  id: string;
  thumb_url: string;
  download_url: string;
  alt: string;
  photographer: string;
  category: string;
}

function createImageDataUrl(
  title: string,
  subtitle: string,
  startColor: string,
  endColor: string,
  width: number,
  height: number,
) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${startColor}" />
          <stop offset="100%" stop-color="${endColor}" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" rx="24" fill="url(#bg)" />
      <circle cx="${Math.round(width * 0.18)}" cy="${Math.round(height * 0.2)}" r="${Math.round(width * 0.08)}" fill="rgba(255,255,255,0.16)" />
      <circle cx="${Math.round(width * 0.82)}" cy="${Math.round(height * 0.22)}" r="${Math.round(width * 0.06)}" fill="rgba(255,255,255,0.14)" />
      <path d="M0 ${Math.round(height * 0.74)} C ${Math.round(width * 0.2)} ${Math.round(height * 0.62)}, ${Math.round(width * 0.42)} ${Math.round(height * 0.88)}, ${Math.round(width * 0.6)} ${Math.round(height * 0.76)} S ${Math.round(width * 0.86)} ${Math.round(height * 0.62)}, ${width} ${Math.round(height * 0.74)} L ${width} ${height} L 0 ${height} Z" fill="rgba(255,255,255,0.12)" />
      <text x="48" y="${Math.round(height * 0.56)}" fill="#ffffff" font-family="ui-sans-serif, system-ui, sans-serif" font-size="${Math.max(28, Math.round(width * 0.05))}" font-weight="700">${title}</text>
      <text x="48" y="${Math.round(height * 0.66)}" fill="rgba(255,255,255,0.82)" font-family="ui-sans-serif, system-ui, sans-serif" font-size="${Math.max(18, Math.round(width * 0.028))}">${subtitle}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const GARDEN_CENTER_FALLBACKS: FallbackImage[] = [
  {
    id: "plants-colorful-display",
    thumb_url: createImageDataUrl(
      "Seasonal Blooms",
      "Curated garden color story",
      "#3d8b6d",
      "#79c28b",
      400,
      400,
    ),
    download_url: createImageDataUrl(
      "Seasonal Blooms",
      "Curated garden color story",
      "#3d8b6d",
      "#79c28b",
      1200,
      800,
    ),
    alt: "Beautiful colorful flowers in garden center display",
    photographer: "BloomSuite Studio",
    category: "plants",
  },
  {
    id: "greenhouse-plants",
    thumb_url: createImageDataUrl(
      "Greenhouse Rows",
      "Indoor plant merchandising",
      "#486a4a",
      "#8dc27d",
      400,
      400,
    ),
    download_url: createImageDataUrl(
      "Greenhouse Rows",
      "Indoor plant merchandising",
      "#486a4a",
      "#8dc27d",
      1200,
      800,
    ),
    alt: "Greenhouse interior with rows of potted plants",
    photographer: "BloomSuite Studio",
    category: "greenhouse",
  },
  {
    id: "garden-tools",
    thumb_url: createImageDataUrl(
      "Garden Tools",
      "Merchandising essentials",
      "#785a3d",
      "#d0a35b",
      400,
      400,
    ),
    download_url: createImageDataUrl(
      "Garden Tools",
      "Merchandising essentials",
      "#785a3d",
      "#d0a35b",
      1200,
      800,
    ),
    alt: "Professional gardening tools and equipment",
    photographer: "BloomSuite Studio",
    category: "tools",
  },
  {
    id: "herb-garden",
    thumb_url: createImageDataUrl(
      "Edible Garden",
      "Fresh herbs and kitchen greens",
      "#2e6a57",
      "#89c9b0",
      400,
      400,
    ),
    download_url: createImageDataUrl(
      "Edible Garden",
      "Fresh herbs and kitchen greens",
      "#2e6a57",
      "#89c9b0",
      1200,
      800,
    ),
    alt: "Fresh herbs and vegetables in garden center",
    photographer: "BloomSuite Studio",
    category: "herbs",
  },
  {
    id: "landscape-garden",
    thumb_url: createImageDataUrl(
      "Landscape View",
      "Outdoor design inspiration",
      "#345f77",
      "#8db2c8",
      400,
      400,
    ),
    download_url: createImageDataUrl(
      "Landscape View",
      "Outdoor design inspiration",
      "#345f77",
      "#8db2c8",
      1200,
      800,
    ),
    alt: "Beautiful landscape garden with trees and plants",
    photographer: "BloomSuite Studio",
    category: "landscape",
  },
];

/**
 * Get relevant fallback images based on query content
 */
export const getRelevantFallbacks = (
  query: string,
  count = 4,
): FallbackImage[] => {
  const lowerQuery = query.toLowerCase();

  // Categorize query to get most relevant images first
  const queryCategories = {
    plants: /\b(plant|flower|bloom|seed|colorful|display|nursery)\b/i,
    greenhouse: /\b(greenhouse|indoor|interior|potted|container)\b/i,
    tools: /\b(tool|equipment|shovel|rake|gardening|supplies)\b/i,
    herbs: /\b(herb|vegetable|organic|fresh|edible|food)\b/i,
    landscape: /\b(landscape|garden|outdoor|tree|design|nature)\b/i,
  };

  // Find best matching categories
  const matches = Object.entries(queryCategories)
    .filter(([_, regex]) => regex.test(lowerQuery))
    .map(([category]) => category);
  // Get images starting with most relevant categories
  let selectedImages: FallbackImage[] = [];

  // First, add images from matching categories
  for (const category of matches) {
    const categoryImages = GARDEN_CENTER_FALLBACKS.filter(
      (img) => img.category === category,
    );
    selectedImages.push(...categoryImages);
  }

  // Fill remaining slots with other garden center images
  const remainingImages = GARDEN_CENTER_FALLBACKS.filter(
    (img) => !selectedImages.find((selected) => selected.id === img.id),
  );
  selectedImages.push(...remainingImages);

  // Return exactly the requested count, shuffled for variety
  const result = selectedImages.slice(0, count);
  return result;
};

/**
 * Convert fallback images to the expected format
 */
export const formatFallbackImages = (
  fallbacks: FallbackImage[],
  query: string,
) => {
  return fallbacks.map((img) => ({
    id: `fallback-${img.id}`,
    thumb_url: img.thumb_url,
    download_url: img.download_url,
    alt: `${img.alt} - ${query}`,
    photographer: img.photographer,
    query: query,
    source: "curated",
  }));
};
