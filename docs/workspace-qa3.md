# Workspace QA pass 3: product catalogue proposal (#19)

Status: proposal only. Nothing is merged; this needs a product decision.

## Today

There are two product lists:

| | BloomSuite catalogue (`/products`) | Website catalogue (BloomSites) |
|---|---|---|
| Stored in | `public.products` (per tenant) | The BloomSites CMS, read through the `connected-content` edge function |
| Filled by | POS sync (Lightspeed, Square, Clover, VMX/CSV) and manual adds | Products the merchant publishes on their site |
| Used by | Reports, segments, inventory, Bloom answers | Campaign blocks that link to a live product page |
| Prices | POS price | Website price (can differ) |

The `/products` page now says this in one line and links to the website
products (`/crm/connected-content`). The two lists are not merged.

## Problems this causes

- A product can exist in one list and not the other, so a campaign can
  promote a product that reports never see sell, or the reverse.
- Prices and names drift between the POS and the website.
- Merchants do not know which list Bloom is reading.

## Options

1. **Keep two lists, link them (recommended first step).** Add a
   `website_product_ref` (site id + product slug) on `public.products`,
   matched by SKU first, then by name with manual confirmation. Show
   "On your website" / "Not on your website" on `/products`, and show the
   POS stock beside website products in the campaign picker. No data moves;
   either side can be unlinked.
2. **POS is the source of truth, website reads from it.** BloomSites shows
   BloomSuite products (price and stock from the POS). Simplest for
   merchants with a POS, but needs BloomSites changes and a story for
   website-only products (gift cards, workshops).
3. **One merged catalogue.** A single products table both apps write to.
   Most consistent, most work, and riskiest for live sites.

## Questions for Jon

- Which list should win when a price differs?
- Do website-only products (events, workshops) belong in reports?
- Is SKU reliable enough across POS and website to auto-link?

## Next step if option 1 is chosen

An additive migration (`products.website_product_ref jsonb`), a matching
job that only suggests links, and a review screen. No existing behaviour
changes until a merchant confirms a link.
