// BloomSites rows for the Lacoste link (CRM tenant 8f4edec9 -> site
// f599e50e, custom domain lacostegardencentre.com), copied from production
// on 2026-11-27. Used by the bloomsites bridge tests, which serve them
// through a fake fetch: CI cannot reach BloomSites.

export const LACOSTE_TENANT_ID = "8f4edec9-98dc-4b1e-9e24-a2994c5f482d";
export const LACOSTE_SITE_ID = "f599e50e-4245-43d2-954c-e5b05777ec22";
export const LACOSTE_ORIGIN = "https://lacostegardencentre.com";
export const BLOOMSITES_REST_URL = "https://isvcjikzheswgvpkfpfr.supabase.co";
/** "Now" for the tests: between the past and future Lacoste event dates. */
export const FIXTURE_NOW = new Date("2026-11-27T05:00:00Z");

const CDN = `https://cdn.bloomsuite.app/${LACOSTE_SITE_ID}`;

export const LACOSTE_SITE = {
  id: LACOSTE_SITE_ID,
  name: "Lacoste Garden Centre",
  logo_url: `${CDN}/images/logo_1786393598023_vkim7v.png`,
  logo_cdn_url: null,
  theme_settings: {
    logo: { url: `${CDN}/images/logo_1786393598023_vkim7v.png`, displayType: "logo" },
    colors: {
      text: "#000000",
      muted: "#5F6258",
      accent: "#CBDF82",
      primary: "#545F34",
      secondary: "#D3E8C1",
      background: "#FFFFFF",
      buttonPrimaryPalette: "accent",
    },
    typography: { bodyFont: "Evergreen", bodyWeight: "400", headingFont: "Evergreen", headingWeight: "700" },
    brandGuide: { typography: { brandBody: "Proxima Nova", brandHeading: "Raustila" } },
  },
};

export const CHRISTMAS_TREES_COLLECTION = {
  id: "094fd5e2-aa44-42c4-bbd7-4a69f95dff75",
  slug: "christmas-trees",
  name: "Christmas Trees",
};

export const CHRISTMAS_TREE_MEMBERS = [
  "3e5693d2-ace3-4f42-b3d5-37e3f07236a6",
  "d7bbee4d-3e4b-4ecb-8a5c-62ece52e5fd6",
  "a8650248-a694-46fd-b9d0-c5a56dfe9658",
  "262186a5-b758-48d4-87c9-d4cdfda1bd95",
  "84688055-b49c-4add-94ca-f692630153f5",
  "161d451a-a708-4320-891e-99997dfffe14",
  "2bc085d7-c657-4326-a1a9-2d736febfdb5",
  "8539aad7-da49-4f07-9fde-dcd2042960e6",
  "35c89058-d189-4b5d-8650-6c83034cd63b",
  "51d88966-8fc1-4d40-999b-aceda8122f2d",
].map((product_id, index) => ({ product_id, sort_order: index + 1 }));

function catalogProduct(id: string, title: string, slug: string, price: number, storageImage: string) {
  return {
    id,
    siteId: LACOSTE_SITE_ID,
    type: "product",
    title,
    description: `${title} artificial Christmas tree.`,
    imageUrl: `${BLOOMSITES_REST_URL}/storage/v1/object/public/product-images/${LACOSTE_SITE_ID}/christmas-20261023/${storageImage}`,
    publicUrl: `${LACOSTE_ORIGIN}/products/${slug}`,
    ctaLabel: "Shop product",
    updatedAt: "2026-11-20T00:00:00Z",
    price,
    currency: null,
  };
}

/** Catalogue items (only products the storefront shows publicly). */
export const CATALOG_PRODUCTS = [
  catalogProduct("d7bbee4d-3e4b-4ecb-8a5c-62ece52e5fd6", "7.5 ft Grandis Fir", "7-5-ft-grandis-fir-artificial-christmas-tree-155047", 799.95, "155047.webp"),
  catalogProduct("262186a5-b758-48d4-87c9-d4cdfda1bd95", "7.5 ft Norway Spruce", "7-5-ft-norway-spruce-artificial-christmas-tree-155049", 699.95, "155049.webp"),
  catalogProduct("8539aad7-da49-4f07-9fde-dcd2042960e6", "7.5 ft Freiburg Pine", "7-5-ft-freiburg-pine-artificial-christmas-tree-155053", 599.95, "155053.webp"),
  catalogProduct("51d88966-8fc1-4d40-999b-aceda8122f2d", "6 ft Andalo Fir", "6-ft-andalo-fir-artificial-christmas-tree-155055", 399.95, "155055.webp"),
];

export const PRODUCT_STOCK = CATALOG_PRODUCTS.map((p) => ({ id: p.id, in_stock: true }));

export const PRODUCT_IMAGES = [
  { product_id: "d7bbee4d-3e4b-4ecb-8a5c-62ece52e5fd6", url: `${CDN}/images/products/d7bbee4d-3e4b-4ecb-8a5c-62ece52e5fd6/Grandis_Fir_1792773318161_9973m9.jpg`, cdn_url: `${CDN}/images/products/d7bbee4d-3e4b-4ecb-8a5c-62ece52e5fd6/Grandis_Fir_1792773318161_9973m9.jpg`, is_primary: true, position: 0 },
  { product_id: "262186a5-b758-48d4-87c9-d4cdfda1bd95", url: `${CDN}/images/products/262186a5-b758-48d4-87c9-d4cdfda1bd95/Norway_Spruce_1792773254038_luh17o.jpg`, cdn_url: `${CDN}/images/products/262186a5-b758-48d4-87c9-d4cdfda1bd95/Norway_Spruce_1792773254038_luh17o.jpg`, is_primary: true, position: 0 },
  { product_id: "8539aad7-da49-4f07-9fde-dcd2042960e6", url: `${CDN}/images/products/8539aad7-da49-4f07-9fde-dcd2042960e6/Freiberg_Pine_1792868998252_d2ipy.jpg`, cdn_url: `${CDN}/images/products/8539aad7-da49-4f07-9fde-dcd2042960e6/Freiberg_Pine_1792868998252_d2ipy.jpg`, is_primary: true, position: 0 },
  { product_id: "51d88966-8fc1-4d40-999b-aceda8122f2d", url: `${CDN}/images/products/51d88966-8fc1-4d40-999b-aceda8122f2d/Andalo_Fir_1792773984745_qa7go.jpg`, cdn_url: `${CDN}/images/products/51d88966-8fc1-4d40-999b-aceda8122f2d/Andalo_Fir_1792773984745_qa7go.jpg`, is_primary: true, position: 0 },
];

const ADDRESS = "2787 St. Mary’s Road, Winnipeg, MB R2N 4A6";

export const EVENTS = [
  { id: "f7f15f8d-7d38-4825-88a9-14dfe623bc59", title: "Jingle and Mingle", slug: "jingle-and-mingle", start_datetime: "2026-11-12T23:00:00+00:00", location: ADDRESS, venue_name: "Lacoste Garden Centre", timezone: "Etc/GMT+5" },
  { id: "069c8e11-e41f-42cb-890c-5fb3f2b40470", title: "Planter Parties", slug: "holiday-planter-workshops", start_datetime: "2026-11-18T23:00:00+00:00", location: ADDRESS, venue_name: "Lacoste Garden Centre", timezone: "Etc/GMT+5" },
  { id: "07ea99df-beed-4b39-b751-35da9070631f", title: "Santa Photos", slug: "santa-photos", start_datetime: "2026-11-21T15:00:00+00:00", location: ADDRESS, venue_name: "Lacoste Garden Centre", timezone: "Etc/GMT+5" },
  { id: "c92db1f2-a84d-4871-b78f-8359f7d7d281", title: "Centrepiece Workshops", slug: "holiday-centrepiece-workshops", start_datetime: "2026-12-09T23:00:00+00:00", location: ADDRESS, venue_name: "Lacoste Garden Centre", timezone: "Etc/GMT+5" },
];

const occ = (event_id: string, start: string) => ({ event_id, start_datetime: start, location: ADDRESS });

export const EVENT_OCCURRENCES = [
  occ("f7f15f8d-7d38-4825-88a9-14dfe623bc59", "2026-11-12T23:00:00+00:00"),
  occ("069c8e11-e41f-42cb-890c-5fb3f2b40470", "2026-11-18T23:00:00+00:00"),
  occ("069c8e11-e41f-42cb-890c-5fb3f2b40470", "2026-11-26T23:00:00+00:00"),
  occ("069c8e11-e41f-42cb-890c-5fb3f2b40470", "2026-11-27T23:00:00+00:00"),
  occ("069c8e11-e41f-42cb-890c-5fb3f2b40470", "2026-12-02T23:00:00+00:00"),
  occ("07ea99df-beed-4b39-b751-35da9070631f", "2026-11-21T15:00:00+00:00"),
  occ("07ea99df-beed-4b39-b751-35da9070631f", "2026-11-28T15:00:00+00:00"),
  occ("07ea99df-beed-4b39-b751-35da9070631f", "2026-12-13T15:00:00+00:00"),
  occ("c92db1f2-a84d-4871-b78f-8359f7d7d281", "2026-12-09T23:00:00+00:00"),
  occ("c92db1f2-a84d-4871-b78f-8359f7d7d281", "2026-12-11T23:00:00+00:00"),
];

export const EVENT_MEDIA = [
  { event_id: "07ea99df-beed-4b39-b751-35da9070631f", media_url: `${CDN}/images/Santa_2025_2_1792681128093_5nrp7b.jpg`, sort_order: 0 },
  { event_id: "c92db1f2-a84d-4871-b78f-8359f7d7d281", media_url: `${CDN}/images/30698C72_DDEE_44F1_B_1792680889749_r0bygc.png`, sort_order: 0 },
  { event_id: "f7f15f8d-7d38-4825-88a9-14dfe623bc59", media_url: `${CDN}/images/Jingle_and_Mingle_Ev_1792869424362_beyjnk.jpg`, sort_order: 0 },
];
