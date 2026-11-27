# Bloom newsletter generation audit

**Date:** 2026-11-27

**Scope:** every AI path that generates or regenerates newsletter or email content in this repo (`JonDMorrison/brandsinblooms`), plus Supabase project `udldmkqwnxhdeztyqcau`. No runtime code was changed.

**How it was checked:**

- I read the code and traced callers.
- I built an import graph from `src/main.tsx` that skips test files, to decide which code is reachable.
- I ran read-only SQL against production.
- I queried `function_edge_logs` for 2026-10-28 to 2026-11-27, one 24-hour window per day, 31 windows in total.
- Nothing ran in a browser.

**Legend:**

- **LIVE** means production code reaches the call site and it is wired to a UI control or a cron job.
- **DEAD** means no import chain from `src/main.tsx` reaches it, or its only importer is a test.

---

## 1. Summary

1. **Only one AI engine writes Studio `contentBlocks` that customers actually receive: `generate-theme-newsletter`.**
   - It was called 7 times in 30 days.
   - It is the only generator with a strict JSON schema, URL allow-listing and validation retries.
   - It returns blocks to the browser. Studio autosave then persists them to `crm_campaigns.metadata.contentBlocks`.
2. **bloom-assist is the busiest AI function, but it has never created a newsletter.**
   - It was called 281 times with 6 errors in 30 days.
   - Its `create_campaign` tool can insert `metadata.contentBlocks` through the deterministic Botanical template.
   - No `crm_campaigns` row has `origin` starting `ai:bloom_template`.
3. **Every other generator returns loose text** (strings, YAML, a single block object or idea lists), or it is dead, retired or broken.
   - 10 of the 19 functions examined had **zero invocations** in 30 days.
4. **Every model call is OpenAI direct** (`api.openai.com/v1/chat/completions`, `OPENAI_API_KEY`). No shared AI helper is used by any email generator.
5. **The reference newsletter's design does not come from tenant brand data.**
   - Lacoste's `company_profiles` brand colours are still the app defaults, and no logo is stored.
   - The reference's palette, logo and images were set by hand. The images are on `cdn.bloomsuite.app` (BloomSites CMS storage).
6. **Recommendation:** make `generate-theme-newsletter` the single newsletter engine. Widen it to the block types and design rules in sections 3 and 4. Point the bloom-assist and idea paths at it, and retire the rest (section 6).

---

## 2. Inventory of generation paths

### 2.1 Invocations in the last 30 days

The counts come from `function_edge_logs` for 2026-10-28 to 2026-11-27, matched on `request.pathname`.

| Function | OK | Errors | Notes |
|---|---|---|---|
| bloom-assist | 281 | 6 | Chat agent (Ask Bloom and `/bloom`) |
| generate-theme-newsletter | 7 | 0 | 2026-11-24 (5) and 2026-11-25 (2) |
| generate-newsletter-ideas | 6 | 0 | 2026-11-18 (2) and 2026-11-26 (4) |
| generate-email-content | 3 | 0 | 2026-11-06 (1) and 2026-11-20 (2) |
| auto-generate-weekly-campaigns | 0 | 4 | Each Monday at 16:00 UTC (11-02, 11-09, 11-16, 11-23) |
| receive-website-newsletter | 2 | 0 | Website sign-up form intake, not AI. It matched the name filter. |
| All others below | 0 | 0 | No invocation in 31 daily windows |

The four auto-generate-weekly-campaigns errors were all HTTP 500, called from `pg_net`. The 2026-11-23 run logged `Failed to fetch tenant settings: Could not find a relationship between 'users' and 'subscriptions' in the schema cache` (index.ts:43). Its cron job was unscheduled later that day by `supabase/migrations/20261123165623_weekly_theme_images.sql:70-79`. There is no `auto-generate%` job in `cron.job` now.

The functions with zero invocations are:

- generate-newsletter, generate-structured-newsletter, generate-cohesive-newsletter
- generate-campaign-content, generate_campaign_content
- regenerate-content-block, regenerate-email-content
- generate-content, generate-plan-email, generate-multichannel-content
- optimize-content, generate-weekly-themes

### 2.2 Campaigns these paths produced

The data comes from `crm_campaigns.origin`.

| Origin | Rows | Last 30 days | With blocks |
|---|---|---|---|
| `weekly_theme:master` (theme newsletter) | 2 | 2 | 2 |
| `ai:newsletter_idea` (AI idea picked in NewsletterPicker) | 1 | 1 | 1 |
| `ai:bloom_template:*` (bloom-assist Botanical) | **0** | 0 | 0 |
| `null` (legacy or manual) | 172 | 26 | 73 |
| `blank:`, `saved_template:*`, `duplicate:*`, `review:*` | 20 | 9 | 16 |

### 2.3 Per-function detail

All paths are relative to `supabase/functions/` unless they start with `src/`.

#### generate-theme-newsletter — LIVE (the engine candidate)

- **Called by:**
  - `src/lib/studio/themeNewsletter.ts:150`, through `useThemeNewsletterGeneration`.
  - The UI triggers are **"Start from this week's theme"** on `/newsletters/new` (`src/pages/NewsletterNewPage.tsx:534`, via `useStartThemeNewsletter`) and **"Rewrite with AI"** in the Studio top bar on `/crm/campaigns/:id/studio` (`StudioTopBar.tsx:849`, drafts only).
  - No cron job calls it.
- **Model:** OpenAI, `THEME_NEWSLETTER_MODEL` or the default `gpt-4.1` (index.ts:31, :733).
  - Uses `response_format: json_schema` with `strict: true` (index.ts:344-367, :438-441).
  - `temperature 0.7`, `max_tokens 1800`, up to 2 attempts.
- **Prompt:** `buildSystemPrompt` at index.ts:369-383 and `buildUserPrompt` at :385-417.
  - The prompt asks for 3–5 blocks: a hero image, a plain-text intro, an image-text tip, up to 2 website product or event items, and exactly one CTA.
  - It may use only the URLs and item IDs supplied in the context.
- **Context it reads:**
  - `company_profiles` (voice)
  - `campaigns` and `master_campaign_templates` by week (the theme)
  - `campaigns.theme_images` (photos)
  - `crm_connected_websites`, then `https://bloomsites.app/api/connected-content/catalog` (12 products and 12 events per site, index.ts:183-208)
- **Output:** `{ok, subjectLine, previewText, contentBlocks[], theme, context, model, attempts, tokens, latencyMs}`.
  - Blocks come from `toStudioContent` (:620-660), in this order: `newsletter-header{tagline}`, `full-width-image{imageUrl,imageAlt}`, `plain-text{body}`, `image-text{headline,body,imageUrl,imageAlt}`.
  - Website items become `image-text` with `subheading`, `buttonText`, `buttonUrl` and `connectedContent` (:585-617). After them come `call-to-action{headline,body,buttonText,buttonUrl}` and a closing `footer`.
  - The blocks have no `id`, `order` or `layout`.
- **Maps to `metadata.contentBlocks`:** yes, indirectly.
  - `hydrateThemeNewsletterBlocks` (`src/lib/studio/themeNewsletter.ts:170-199`) starts each block from `createStudioBlock` brand defaults.
  - It copies the string fields, forces `layout:"centered-hero"` and `layoutPreset:"cta-centered-hero"` on CTAs, and sets `order`.
  - `studio.replaceContent` then runs, and Studio autosave writes the result through `persistCampaignDraft` → `buildCampaignMetadata` (`src/lib/crm/campaignDraftPersistence.ts:594-610, :932`).
  - The function itself writes nothing to the database.
- **Limits:**
  - The browser guard rejects any type outside the six above (`themeNewsletter.ts:23-30`).
  - Website events become `image-text`, not `event`.
  - There is no `product-card` or `product-gallery` type.
  - There is no deterministic fallback; the function returns 503 or 422.

#### bloom-assist — LIVE (chat), but never used to build a newsletter

- **Called by:** browser `fetch` calls in `src/providers/AskBloomProvider.tsx:1624`, `:2584`, `src/hooks/bloom/useBloomMessageMutations.ts:311`, `:384`, and `src/hooks/askBloom/useAskBloomStreaming.ts:2395`. These are Ask Bloom and `/bloom`.
- **Model:** OpenAI. `selectModel()` (`bloom-assist/model-router.ts:48-91`) picks per turn: `gpt-4o-mini`, `gpt-4o` (the default), or `gpt-4.1-2025-04-14` for content and image intents.
- **Prompt:** `bloom-assist/prompts/base-system-prompt.ts`. This is a general assistant prompt, not a newsletter prompt.
- **Newsletter output:**
  - The `create_campaign` tool, given a `template_id` and `newsletter_brief`, inserts `crm_campaigns` (`tools/implementations/campaign-mutations.ts:1001-1092`).
  - The blocks come from deterministic code: `buildBotanicalEditorial` (`src/lib/studio/botanicalEditorial.ts:38-119`).
  - The block types are `newsletter-header`, `email-safe-hero` (`layout:"editorial-panel"`), `plain-text`, `full-width-image`, `call-to-action`, `image-gallery` (`row-2`), `divider` and `footer`, each with `id`, `order` and `layout`.
  - It also writes `content` HTML from `generateEmailHtml` and sets `origin = "ai:bloom_template:<id>"`.
  - Production has 0 such rows.
- **Delegation:**
  - The `generate_content` tool forwards to `generate-email-content`, `generate-subject-lines`, `generate-sms` and `generate-social-content`. The last is a retired stub that always returns HTTP 410 (`content-generation.ts:834`).
  - The `model` label it reports for delegated work is hard-coded (`content-generation.ts:615-625`).

#### generate-newsletter-ideas — LIVE

- **Called by:** `src/hooks/useNewsletterIdeas.ts:187`, from the "Generate" button in `NewsletterPicker` on `/newsletters` and `/newsletters/new`.
- **Model:** OpenAI `gpt-4o-mini` (index.ts:48).
- **Prompt:** index.ts:52-72.
- **Output:** `{ideas[{id,title,description,category:"ai-generated",templateBlocks[],heroQuery,estimatedReadTime}]}`. The `templateBlocks` are not validated.
- **Maps to contentBlocks:** only after the user picks an idea.
  - `src/lib/studio/newsletterIdeaSeed.ts` seeds a campaign and stamps it `origin = ai:newsletter_idea` (:87).
  - One such campaign exists.

#### generate-email-content — LIVE only through bloom-assist

- **Browser callers:** `ShortenAllBlocksButton.tsx:83`, `ContentIntegrationSidebar.tsx:221` and `usePersonaAwareGeneration.ts`. All three are DEAD.
- **Live caller:** bloom-assist `content-generation.ts:873`, for `email_body` and `product_description`.
- **Model:** `gpt-4o-mini` (index.ts:267).
- **Prompt:** index.ts:219-258. It includes hard-coded hydrangea, rose and fall subtopics at :86-156.
- **Output:** one block, `{title, content, cta_text, cta_url}`. On a parse failure it falls back to `cta_url:"#"`.
- **contentBlocks:** no.
- **Auth:** it only checks that a header is present (:18-21).

#### generate-structured-newsletter and generate-content — LIVE (calendar holiday "Generate")

- **Called by:**
  - `src/components/homepage/HolidayGenerationService.ts:62`, which calls `generate-content` for instagram, facebook, blog and video.
  - `src/components/homepage/StructuredNewsletterService.ts:32`, which calls `generate-structured-newsletter` for the newsletter.
  - The trigger is the holiday "Generate" button on `/calendar`.
- **Models:**
  - `generate-structured-newsletter`: `gpt-4o`, forced tool call (index.ts:354).
  - `generate-content`: `gpt-4o-mini`, 4–5 parallel attempts (`openai-client.ts:153`).
- **Prompts:**
  - `generate-structured-newsletter`: index.ts:107-424.
  - `generate-content`: `prompt-builder.ts:4-303`, or the caller's `customPrompt`.
- **Outputs:**
  - `generate-structured-newsletter` returns `{yamlContent, theme, focus, overviewKeywords}`. Its blocks exist only inside the YAML text.
  - `generate-content` returns `{content, imageQuery, generationAttempts, validationPassed}`.
- **contentBlocks:** no. The browser inserts both outputs into **`content_tasks`** (`HolidayGenerationService.ts:198-202`).
- **Usage and side effects:**
  - Neither was invoked in 30 days.
  - `generate-content` writes `company_profiles.company_name` with the service role (index.ts:77-80).

#### generate-weekly-themes — LIVE, but not AI

- **Called by:** onboarding at `/onboarding/manual` (`CompanyProfileCreator.ts:309`) and the `/calendar` backfill button (`BackfillCampaigns.tsx:177`).
- **No LLM call:** `OPENAI_API_KEY` is read and never used. Themes come from a hard-coded list or `master_campaign_templates`.
- **Writes:** none itself. Its callers insert `campaigns` rows, which are the theme source for generate-theme-newsletter.
- **Auth:** `verify_jwt = false` and no in-handler auth.

#### DEAD, retired or never called

| Function | Status | Model | Output | Last caller |
|---|---|---|---|---|
| generate-newsletter | DEAD (`ContentGenerationServices.ts:80` has only unreachable importers) | `gpt-4o-mini` (index.ts:148). The `gpt-4o` copy in `openai-client.ts` has no importer. | `{content, campaign}` string | none live |
| generate-cohesive-newsletter | Never called (0 references in `src`) | `gpt-4o-mini` | `{content, sections:4}` | none |
| regenerate-email-content | DEAD (`src/utils/aiContentRegenerator.ts:41`, 0 importers) | `gpt-4o-mini` | `{regenerated_content, subject_variations, …}` | none |
| regenerate-content-block | DEAD (`aiContentRegenerator.ts:80`) | `gpt-4o-mini` | `{regenerated_block, variations, performance_prediction}` | none |
| generate-plan-email | DEAD (`emailContentService.ts:152`; `/plan` redirects) | `gpt-4o-mini`, with a template fallback | `{subject, preheader, body(HTML), …}` | none |
| generate-multichannel-content | DEAD (`useContentGenerationOrchestrator.ts:560`; only test importers) | `gpt-4o-mini` | writes `draft_snapshots` | none |
| auto-generate-weekly-campaigns | Broken; cron removed 2026-11-23 | `gpt-4o-mini` (subject and preheader only) | inserts `crm_campaigns` with no content or blocks | `CampaignAutomationSettings.tsx` (DEAD) |
| generate-campaign-content, generate_campaign_content, optimize-content, generate-social-content | Retired 3-line stubs; always return HTTP 410 (`_shared/retiredSocialFeature.ts`) | none | `{code:"FEATURE_RETIRED"}` | bloom-assist still calls generate-social-content |
| generate-holiday-content | Does not exist (no folder, 0 references). Holiday content is the browser `HolidayGenerationService.ts`. | — | — | — |
| update-holiday-calendar | Not AI (date maths into `holidays`) | none | — | `useHolidayCalendarUpdate.ts` (DEAD) |
| content-generation-cache | Not AI (in-memory cache) | none | — | none |
| generate-subject-lines | LIVE helper (bloom-assist, `NewsletterInboxReview.tsx`) | `gpt-4.1-2025-04-14` | `{subjectLines, suggestions[{subject,preview}]}` | — |

### 2.4 Security observations

None of these were changed.

- **Header-only auth with a body-supplied user:**
  - generate-newsletter, generate-structured-newsletter, generate-cohesive-newsletter and generate-email-content only check that an Authorization header exists, then use the service-role client.
  - All but generate-email-content take `userId` from the request body.
  - generate-content does the same and also writes `company_profiles`.
  - Platform `verify_jwt` is their only token check.
- **No auth:** generate-weekly-themes has `verify_jwt = false` and checks nothing in the handler.
- **Unscoped lookup:** `HolidayGenerationService.ts:138-149` has an unscoped `tenants … limit(1)` fallback. From the calendar it is unreachable, because `useSeasonalHolidays.ts:155-162` throws first when there is no tenant.

---

## 3. The contentBlocks schema in use today

### 3.1 Where it is defined and rendered

- **Canonical type:** `StudioBlock` (`src/types/studioBlocks.ts:117-374`).
- **As-saved shape:** `SavedCampaignBlock` (`src/lib/crm/campaignDraftPersistence.ts:45-56`). This is StudioBlock plus the legacy aliases `title, content, altText, ctaText, ctaUrl, quote, author, subtitle, issueNumber, publishDate`.
- **One renderer for every surface:** `src/lib/studio/emailHtmlGenerator.ts` (`renderNewsletterBlock` :2327-2509, `generateEmailHtml`).
  - Studio canvas, Preview & Test, the campaign-editor preview card, the stored `crm_campaigns.content` HTML, send, test send, render-email-preview and the bloom-assist template all use it.
  - The server imports it directly (`_shared/campaignEmailSource.ts:2-7`).
  - The 16 per-type React renderers in `src/components/crm/studio/blocks/*Renderer.tsx` have no importers.
- **Dispatch order:**
  1. `renderExtendedBlock` (`newsletter/renderExtensions.ts:471-787`) handles `product-card, product-gallery, image-gallery, coupon, preheader, headline, html, youtube, navigation, button-group, text-columns, data-table, chart, survey, event, plant-care, blog, announcement`.
  2. `renderLegacyBlock` (`emailHtmlGenerator.ts:2277-2325`) handles the rest.
  3. Unknown types render as plain text.
  - Because of that order, the legacy coupon, image-gallery and product-gallery renderers never run.
- **Body assembly** (`renderStudioBlocksToEmailHtml` :2578-2623):
  - Drops footers, which are rendered separately.
  - Filters by `audience`.
  - With `emptyBlocks:"skip"`, drops empty blocks.
  - Wraps each block in `div.email-block.email-block-<type>`.
  - Inserts a `blockGap` spacer between blocks, except next to a divider or spacer.

### 3.2 Block types (30) and the fields the renderer reads

Every field is optional in the type. "Required" means the block outputs nothing without it.

**Shared text and button fields** (`renderTextContent` :886-927, `renderButton` :928-968, `renderNewsletterButton` `renderExtensions.ts:70-96`):

- Text: `tagLabel`, `headline`, `subheading`, `body` (sanitised HTML), `textColor`, `textAlign`.
- Button text and link: `buttonText` (required for a button), `buttonUrl`.
- Button styling: `buttonStyle` (filled | outlined | ghost | link), `buttonColor`, `buttonTextColor`, `buttonRounded`, `buttonSize` (sm | md | lg), `buttonAlign`, `fullWidthButton`, `useBrandButtonColor`.

**Shared image fields:** `imageUrl`, `imageAlt`, `imageFit`, `imageHeight`, `imageRatio`, `imageFocalX/Y`, `borderRadius`, `linkUrl`, `appearance.imagePadding`, `appearance.imageMargin`, `appearance.verticalAlign`.

**Content blocks:**

| Type | Fields read beyond the shared ones |
|---|---|
| `newsletter-header` | `layout`, `backgroundColor`, `verticalPadding`, `subheading`/`tagline`, `dateLabel`, `showDividerBelow`/`showDivider`, `dividerBelowColor`, `logoUrl`, `logoSize` (24..320), `logoShape`, `logoAlignment`, `headerBannerUrl` |
| `email-safe-hero` | `heroStyle` (solid, gradient, image-overlay, image-bottom), `gradientFrom/To`, `overlayColor`, `overlayOpacity`, `layout` (only `editorial-panel` is read), `appearance.padding` |
| `graphic-hero` | `imageUrl` (required), `insetPadding`/`imagePadding`, `maxHeight`, `showTextOverlay`, `showCaptionBar`, `showButton`, `showOverlay`, `overlayGradientDirection`, `textPosition`, `captionBarColor`, `showShadow`. `layout` is not read. |
| `full-width-image` | `imageUrl` (required), `insetPadding`, `imageRatio`/`maxHeight`, `croppedImageUrl`/`croppedImageKey`, `showShadow`, `caption`, `showCaption`, `captionColor`, `captionAlignment`. `layout` is not read. |
| `image-text` | `layout`/`layoutPreset`, `contentPadding` (24), `columnSplit` (30/70 … 70/30), `overlayColor`, `overlayOpacity`, `imageLinkEnabled` |
| `plain-text` | `body`, `contentPadding` (28), `fontSize` (sm, md, lg), `lineHeight`, `fontWeightPreset`, `layout` (only `side-accent` and `boxed` are read), `accentColor`. `headline` is **not** rendered. |
| `headline` | `headline`, `headingLevel` |
| `preheader` | `body`; also used as the fallback preview text |
| `quote` | `quoteText`/`body`, `authorName`, `authorTitle`, `authorImageUrl`, `showAuthorImage`, `authorAvatarSize`, `accentColor`, `contentPadding`, `fontStyle`, `quoteMarkSize`, `layout`. An empty quote prints a placeholder in sent mail (:1514-1517). |
| `event` | `showImage`, `imagePosition` (left, right, top), `eventStartDate`, `eventStartTime`, `eventDate` (legacy free text), `eventFeeType` (unspecified, free, donation, paid), `eventFeeAmount`, `eventLocation`, `tagLabel`, `showButton` (`renderEventCard`, `renderExtensions.ts:256-309`) |
| `blog`, `announcement` | `showImage`, `tagLabel`, `eventDate`, `eventLocation`, `showButton`, `imagePosition` |
| `plant-care` | `careLight`, `careWater`, `careSoil`, `careHardiness`, `careSeason`, `careTips`, `careSource`, `careLayout` (beside, compact, feature), `accentColor` |
| `product-card` | `productName`, `productSubtitle`, `productPrice`, `originalPrice`, `productDescription`, `badges[]`/`badgeText`/`badgeColor`/`badgeTextColor`, `showBadges`, `badgePosition`, `imagePosition`, `layout`, `showBorder`/`showCardBorder`, `cardBorderRadius` |
| `product-gallery` | `galleryProducts[]` (`imageUrl, name, altName, linkUrl, price, originalPrice, description, badgeText, badgeColor, badgeTextColor, buttonText, buttonUrl`), `gridColumns` (1..4), `cardGap`, `showPrices`, `showOriginalPrice`, `showDescription`, `showCtaButtons`, `cardBackgroundColor`, `layout` |
| `image-gallery` | `galleryImages[]` (`url` required, `alt, caption, linkUrl`), `gridGap`, `gridColumns`, `layout`/`layoutPreset` |
| `coupon` | `couponOffer` (bogo, 25, 50, price, percent, amount, buy-x-get-one, multi-buy, tiered) and its amount fields, `couponConditions`, `couponExpiry`, `couponBarcode`, `couponBarcodeImageUrl`, `couponBarcodeFormat`, `couponBorder`, `couponScissors`, `couponImageSide`, `couponColumnSplit` |
| `call-to-action` | `layout`, `verticalPadding` (32), `showSecondaryLink`, `secondaryLinkText`, `secondaryLinkUrl`, `linkColor`. An unlinked button is allowed. |

**Layout and data blocks:**

| Type | Fields read beyond the shared ones |
|---|---|
| `navigation`, `button-group` | `links[]` (`label, url, color, textColor`; up to 5 for navigation, 3 for a group), `layoutPreset` (`nav-*`) |
| `text-columns` | `textColumns[]` (up to 3) |
| `data-table` | `tableHeaders[]`, `tableRows[][]`, `tableCaption` |
| `chart` | `chartData[{label,value}]`, `chartUnit`, `accentColor` |
| `survey` | `links[]` (up to 6) |
| `youtube` | `videoUrl` (required), `imageUrl` (thumbnail) |
| `html` | `customHtml` (sanitised) |
| `social-follow` | `socialLinks[]`, `socialLinkOrder`, `socialLabel`, `iconSize`, `iconSpacing`, `iconStyle`, `iconColorMode`, `customIconColor`, `layout` |
| `divider` | `paddingTop/Bottom`, `lineWidth`, `lineThickness`, `lineStyle` (solid, dashed, dotted), `lineColor`, `layout` (only `ornamental` is read), `ornamentSymbol`, `ornamentColor` |
| `spacer` | `spacerHeight`, `backgroundColor` |
| `footer` | `layout`, `backgroundColor`, `textColor`, `linkColor`, `verticalPadding`, `businessName`, `address`, `complianceText`, `copyright`/`copyrightText`, `logoUrl`, `logoSize`, `logoWidthPercent`, `logoAlignment`, `showManagePreferences`, `showWebsiteLink`, `websiteUrl`, `footerSocialLinks[]`, `showSocialInFooter`, `footerIconStyle`, `footerIconColor`, `showFooterPhone`, `showFooterEmail`, **`newsletterSettings`** (see 3.4) |

**Common fields on every block:** `id`, `type`, `label`, `order`, `visible`, `source`, `backgroundColor`, `appearance`, `audience`. `connectedContent` (`studioBlocks.ts:174-187`) is provenance only; the renderer does not read it.

### 3.3 `layout` and `layoutPreset` values

**Precedence:** `layout` wins wherever both are read. `layoutPreset` is only a fallback. Applying a preset writes `layoutPreset` plus every field in the preset, including `layout` (`BlockPropertiesPanel.tsx:620-633`).

**`layout` values the renderer branches on:**

| Block | Values |
|---|---|
| newsletter-header | `classic` (default), `centered`, `minimal`, `banner` |
| email-safe-hero | `editorial-panel` (with `heroStyle:"image-overlay"`) |
| image-text | `image-left` (default), `image-right`, `image-top`, `minimal-card`, `image-overlay` |
| plain-text | `side-accent`, `boxed` |
| quote | `classic` (default), `large-centered`, `avatar-card` |
| product-card | `centered`, `minimal`, `image-top`, `image-right`; image left by default |
| product-gallery | `feature-product` |
| image-gallery | `feature-grid`, `grid-4`, `grid-6`; otherwise `gridColumns` decides |
| call-to-action | `centered-hero` (default), `banner`, `split`, `inline-button-only` |
| social-follow | `vertical-list`, `label-row` |
| divider | `ornamental` |
| footer | `standard-dark` (default), `light-minimal`, `centered-branded` |

**`layoutPreset` values the renderer reads** (only when `layout` is unset):

- `image-text-right`, `image-text-top`, `image-text-overlay`, `image-text-minimal`
- `quote-centered`, `quote-avatar`
- `gallery-feature-grid`
- `footer-light-minimal`, `footer-centered-branded`
- `nav-*`, `nav-pills`

**Preset keys in `src/lib/studio/layoutPresets.ts`** (each writes the `layout` shown):

| Group | Presets |
|---|---|
| hero | `hero-dark-center`, `hero-gradient-warm`, `hero-image-overlay`, `hero-image-bottom`, `hero-light-minimal`, `hero-brand-green` (no `layout`; they set `heroStyle`) |
| graphic-hero | `graphic-full-bleed`, `graphic-rounded-card`, `graphic-text-overlay`, `graphic-caption-bar`, `graphic-framed-shadow` (**layout inert**) |
| full-width-image | `image-full-width` (full-bleed), `image-rounded`, `image-padded-rounded`, `image-caption` (**layout inert**) |
| newsletter-header | `newsletter-classic`, `newsletter-centered`, `newsletter-minimal`, `newsletter-banner` |
| image-text | `image-text-left`, `image-text-right`, `image-text-top`, `image-text-overlay`, `image-text-minimal` |
| plain-text | `plain-standard` (inert), `plain-centered` (inert), `plain-boxed`, `plain-accent` |
| quote | `quote-classic`, `quote-centered`, `quote-avatar` |
| product-card | `product-standard` (inert), `product-centered`, `product-minimal` |
| image-gallery | `gallery-grid-3` (falls to `gridColumns`), `gallery-grid-4`, `gallery-grid-6`, `gallery-feature-grid` |
| product-gallery | `product-gallery-standard` (inert), `product-gallery-three-column` (inert), `product-gallery-feature` |
| call-to-action | `cta-centered-hero`, `cta-banner`, `cta-inline-button`, `cta-split`, `cta-stacked-double` (inert; renders as centered-hero) |
| social-follow | `social-icon-row` (inert), `social-label-row`, `social-vertical-list` |
| divider | `divider-simple`, `divider-dashed`, `divider-dotted` (inert; `lineStyle` does the work), `divider-ornamental` |
| spacer | `spacer-tight`, `spacer-standard`, `spacer-airy`, `spacer-large` (inert; `spacerHeight` is 16, 32, 48 or 64) |
| navigation | `nav-left`, `nav-centered`, `nav-right`, `nav-pills` |
| footer | `footer-standard-dark`, `footer-light-minimal`, `footer-centered-branded` |

"Inert" means the renderer never reads that `layout` value. The visual result comes from the preset's other fields.

**Schema defects found:**

- `blockFactory.ts:476-477` and `:491-492` default new galleries to `layout:"row-3"` with preset keys `gallery-row-3` and `product-gallery-row-3`. Neither key exists in `layoutPresets.ts`, and no renderer branches on `row-3`.
- `editorEmptyBlocks.ts:242` reads `layout === "horizontal"` and `layoutPreset === "product-horizontal"`. Neither value exists.
- The reference newsletter's `full-width-image` block carries `layout:"full-bleed"`, which is inert.

### 3.4 Global settings, appearance and brand theme

- **`NewsletterSettings`** (`src/types/newsletterDesign.ts:45-82`) is stored **on the footer block** as `footer.newsletterSettings`. Defaults (`settings.ts:83-121`):
  - `width` 640 (480..800)
  - `backgroundColor` `#ece8de`
  - `contentBackgroundColor` `#fbfaf6`
  - `blockGap` 12 (0..96)
  - `fontFamily`, `allowedFonts`, `assetLocations`, `defaults: BlockAppearance`
  - The flags `emptyBlocks:"skip"`, `mobileImageHeight:"natural"`, `contrastGuard:true` and `mobileFooterAlign:"left"`
- **`BlockAppearance`** (`newsletterDesign.ts:25-44`):
  - `margin` and `padding` (per edge)
  - `border {style, width 0..12, color, radius 0..48}`
  - `text[role] {size, weight, lineHeight, color, fontFamily}` for the roles `h1-h6, heading, subheading, body, price, smallPrint, button, label`
  - `background`, `linkColor`, `linkDecoration`, `imagePadding`, `imageMargin`, `verticalAlign`, `buttonPaddingX/Y`
  - Applied by `applyBlockAppearance` (`renderExtensions.ts:788-847`).
- **Brand theme** is `StudioDesignSystem`.
  - The browser builds it with `buildStudioDesignSystem`. The server builds it with `_shared/resolveDesignSystem.ts:153`, from `company_profiles.brand_primary/secondary/accent/text_color`, the font ids, `feature_flags.company_logo_url`, `feature_flags.footer_colors`, social URLs and `footer_legal_text`.
  - Brand button colours apply when a block has no explicit button colours (:2393-2415).
- **Not read by any email renderer:** `metadata.theme` and `emailStyles`.
- **Normalisation:**
  - Studio load (`CampaignStudioPage.tsx:125-269`) maps legacy types (`header→email-safe-hero`, `text→plain-text`, `image→full-width-image`, `button/cta→call-to-action`, `product→product-card`) and fills aliases. Unknown types become `plain-text`.
  - The server does the same in `_shared/campaignEmailSource.ts:102-187`, but passes unknown types through unchanged.
  - `ContentPreviewCard` normalises only legacy image galleries (`campaignEditor.ts:335-359`), so a stored legacy `"product"` block renders differently there.
  - The `crm_campaigns.content` HTML stored at save is rendered with no design system (`campaignDraftPersistence.ts:511`), so it has no brand fonts or brand button colours.

---

## 4. Design rules from the reference newsletter

**Source:** `crm_campaigns` id `e3dfee2c-ee38-4149-8c32-d08d788094e5`, tenant `8f4edec9-98dc-4b1e-9e24-a2994c5f482d` (Lacoste Garden Centre).

- Name: "Lacoste Christmas — trees & events — redesigned".
- Status: draft, created 2026-10-31.
- `origin` is null, and every block has `source:"manual"`.
- 10 blocks.

### 4.1 Section order

| # | Type | Layout | Role | Background |
|---|---|---|---|---|
| 0 | `newsletter-header` | `classic` | Logo, store name, seasonal tagline, divider | `#fbfaf6` |
| 1 | `full-width-image` | `full-bleed` (inert) | Hero photo, `imageFit:"cover"` | `#fbfaf6` |
| 2 | `call-to-action` | `centered-hero` | Intro headline, one-sentence body, primary button | `#f6f2e8` |
| 3 | `event` | image left | **Feature item**, inverted dark card (trees) | `#263d2d` |
| 4 | `event` | image left | Event 1 | `#ffffff` |
| 5 | `event` | image right | Event 2 | `#f6f2e8` |
| 6 | `event` | image left | Event 3 | `#ffffff` |
| 7 | `event` | image right | Event 4 | `#f6f2e8` |
| 8 | `call-to-action` | `centered-hero` | Closing headline, all-events button | `#263d2d` |
| 9 | `footer` | `standard-dark` | Logo, address, compliance, unsubscribe and preferences | `#1f3326` |

The pattern is: header → hero → intro CTA → one dark feature card → 3–5 light item cards → dark closing CTA → dark footer.

### 4.2 Background sequence

The sequence is `#fbfaf6` → `#fbfaf6` → `#f6f2e8` → **`#263d2d`** → `#ffffff` → `#f6f2e8` → `#ffffff` → `#f6f2e8` → **`#263d2d`** → **`#1f3326`**.

- Light item cards alternate white (`#ffffff`) and cream (`#f6f2e8`).
- Dark green bands the item list: the feature card opens it and the closing CTA ends it.
- The footer is a deeper green.
- The email canvas is `#ece8de` and the content column is `#fbfaf6`. Both come from footer `newsletterSettings`.

### 4.3 Colour tokens

| Token | Value | Used for |
|---|---|---|
| ink / primary | `#263d2d` | All body and heading text on light blocks, dark-band backgrounds, button fill on light blocks |
| footer | `#1f3326` | Footer background |
| cream | `#f6f2e8` | Alternating light background |
| paper | `#fbfaf6` | Header, hero and content background |
| canvas | `#ece8de` | Outer email background |
| white | `#ffffff` | Alternating light background, and text on dark blocks |
| on-dark button | `#fffaf1` | Button fill on dark blocks, with `#263d2d` text |
| hairline | `#e2ddcf` | 1px card border on light event cards |
| footer link | `#e8efe9` | Footer links |

**Button rule:** a dark block gets a light button (`#fffaf1` on `#263d2d`). A light block gets a dark button (`#263d2d` with `#ffffff` text).

- Every button sets `buttonRounded:true`.
- The closing CTA sets `useBrandButtonColor:false`. The other CTAs and event cards leave it unset; because they set explicit button colours, the brand colour does not override them.

**These tokens are not the tenant's stored brand.** Lacoste's `company_profiles` has `brand_primary_color #22c55e`, `secondary #1e40af`, `accent #f59e0b` and `text #1f2937`, which are the app defaults. No font ids are set. `feature_flags.company_logo_url` is null.

### 4.4 Radius, borders and padding

| Element | Values |
|---|---|
| Event cards | `appearance.border.radius 16`. Light cards: `border.width 1`, colour `#e2ddcf`. Dark feature card: `border.width 0`. |
| Event card padding | `appearance.padding` `20 / 24 / 20 / 24` (top, right, bottom, left) |
| CTA blocks | `verticalPadding 36`, `textAlign center` |
| Header | `verticalPadding 16`, `logoSize 56`, `showDivider true` |
| Footer | `verticalPadding 28`, `logoSize 56` |
| Between blocks | `blockGap 12` |
| Email | `width 640` |
| Buttons | Rounded pill (`buttonRounded:true`, which gives 999px in the legacy renderer and 8px in `renderNewsletterButton`) |

### 4.5 Image alternation

- The hero is a full-bleed `cover` photo with no text over it.
- Event cards use `imagePosition` **left, left, right, left, right**.
  - The dark feature card and the first light card are both left.
  - From there the side alternates: left, right, left, right.
  - The generalised rule is that the feature card goes left and the light cards then zigzag, starting with left.
- Every content block except the two CTAs carries one image.
- Every image has descriptive `imageAlt` text.
- All images are on `cdn.bloomsuite.app/f599e50e-…/images/…`. One is a product image (`…/images/products/<id>/Grandis_Fir_….jpg`).
- The hero reuses the "Jingle and Mingle" event photo.

### 4.6 Copy length per block

Word counts were measured from the stored HTML with tags stripped.

| Block | Headline words | Body words (characters) | Button words |
|---|---|---|---|
| Header | 3 (store name) plus tagline "Christmas at Lacoste" (3) | — | — |
| Intro CTA | 4 | 14 (114) | 3 |
| Feature event | 7 | 18 (109) | 3 |
| Event cards | 2–3 | 12–14 (81–88) | 2 ("View details") |
| Closing CTA | 4 | 11 (65) | 4 |

The rules that follow from this:

- Headlines are 2–7 words.
- Bodies are a single sentence of 11–18 words, about 65–115 characters, in one `<p>`.
- Buttons are 2–4 words.
- Event cards add `eventDate` as free text ("Thursday, November 12", "Multiple dates from November 18"), and `eventLocation` "Lacoste Garden Centre · Winnipeg".
- The feature card uses `eventDate` as a kicker ("Fresh-cut favourite") with an empty location.

### 4.7 Link targets

- Every button goes to the tenant's own website (`https://lacostegardencentre.com`).
- Category links go to `/collections/christmas-trees` (intro CTA and feature card).
- Event links go to `/events/<slug>`: `jingle-and-mingle`, `holiday-planter-workshops`, `santa-photos`, `holiday-centrepiece-workshops`.
- The index link goes to `/events` (closing CTA).
- There are no third-party links and no `#` placeholders.
- The footer has `websiteUrl`, `showWebsiteLink`, `showUnsubscribe` and `showManagePreferences` all on. Social links are all disabled (`showSocialInFooter:false`).

### 4.8 Other metadata

- `subject_line`: "A little Christmas magic is waiting at Lacoste" (8 words).
- `preheader_text`: one sentence of 11 words.
- `metadata` keys: `replyTo, smsMessage, campaignType, contentBlocks, sourcePersonaId, sourceSegmentId, includeAllCustomers, additionalCustomerIds`.
- The stored `content` HTML is 28,688 characters.

---

## 5. Tenant data Bloom could pull assets from

| Asset | Where it lives | State in production (2026-11-27) | Who reads it today |
|---|---|---|---|
| **Products** | `public.products` (`tenant_id, name, price, compare_at_price, category, slug, source, external_data`) | 10,421 rows across 5 tenants: Patio Gardens 9,295 (Lightspeed), Down to Earth 1,100 (Square), Northfield 24 (demo), plus 1 each for two others. **Lacoste: 0.** `shopify_products` and `lightspeed_products` have 0 rows for Lacoste. | Not read by any newsletter generator |
| **Product images** | `public.product_images` (`image_url, thumbnail_url, alt_text, is_primary`) | **0 rows.** Images exist only inside `products.external_data`: 6,569 Lightspeed and 635 Square products carry an image URL there. The `product-images` storage bucket exists. | None |
| **Website products and events** | BloomSites catalogue, via `crm_connected_websites` → `https://bloomsites.app/api/connected-content/catalog?type=products\|events` (the `connected-content` function and `generate-theme-newsletter/index.ts:183-208`) | **1 connected site: Northfield** (`northfieldgardens.ca`, active). Lacoste has no connected site. | generate-theme-newsletter (12 products and 12 events per site); Studio connected-content picker |
| **Events in the CRM** | No CRM events table. `holidays` (from update-holiday-calendar) and `calendar_import_rows` hold planning data, not store events. | — | Holiday flow (`content_tasks`) |
| **CDN images** | `cdn.bloomsuite.app/<cms-site-id>/images/…` is BloomSites storage. The reference uses site `f599e50e-4245-43d2-954c-e5b05777ec22`. | That site's database (BloomSites Supabase `cohodpvgpvjsghuwlyfc`) returned "not accessible" to MCP during this audit, so its catalogue was not inspected. In the CRM, 2 campaigns (both Lacoste) reference this CDN prefix. | Hand-placed in the reference |
| **CRM image stores** | Buckets `content-assets`, `campaign-images`, `company-assets`, `ai-generated-images`, `global-ai-images`, `assets` (all public). Table `content_assets` (315 rows, user-scoped). `global_image_gallery` (2,036 rows, shared stock). `campaigns.theme_images` (weekly theme photos). | — | generate-theme-newsletter reads `campaigns.theme_images` |
| **Brand colours** | `company_profiles.brand_primary/secondary/accent/text_color`, keyed by `user_id` | Lacoste still has the defaults (`#22c55e/#1e40af/#f59e0b/#1f2937`) | `resolveDesignSystem` (send), `buildStudioDesignSystem` (Studio) |
| **Fonts** | `company_profiles.selected/headline/subheading/body/button_font_id` | Lacoste: all null | Design system |
| **Logo** | `company_profiles.feature_flags.company_logo_url` (`src/hooks/useCompanyInfo.ts:157`); there is no logo column anywhere in the CRM schema | Lacoste: null. The reference logo is a BloomSites CDN URL typed into the header and footer. | Design system and footer |
| **Social, address, legal** | `company_profiles` `*_url`, `street_address…`, `footer_legal_text`, `feature_flags.footer_colors` | — | Footer through the design system |
| **Voice** | `company_profiles.brand_voice, tone_of_writing, target_audience, unique_selling_points, seasonal_focus` | — | generate-theme-newsletter prompt |

**Takeaway:** for a tenant like Lacoste, the CRM has no assets Bloom could use to rebuild the reference automatically: no products, no product images, no connected site, no logo and default brand colours. The usable sources are the connected BloomSites catalogue, the weekly theme photos, and POS product images inside `products.external_data`.

---

## 6. Recommendation

### 6.1 One engine: `generate-theme-newsletter`

Reasons, from the evidence above:

- It is the only generator that emits Studio block types and is used in production (7 calls, 2 campaigns in 30 days).
- It already has a strict JSON schema, URL and item-ID allow-listing, banned-phrase validation and a retry.
- It already reads the theme, voice, theme photos and the connected-website catalogue.
- It already flows through the single shared renderer and Studio autosave, so there is no second persistence path.
- Its auth is correct: it checks the user JWT and `has_tenant_permission(campaign.write)`.

**Gaps to close before it can reproduce the reference** (these are follow-up milestones, not part of this audit):

1. **Block types:**
   - Allow `event`, `product-card` and `product-gallery` in `DRAFT_SCHEMA`, in `toStudioContent` and in the browser guard (`themeNewsletter.ts:23-30`).
   - Map website events to `event`, not `image-text`.
2. **Emit design fields deterministically, not from the model:**
   - Apply the section-4 rules in `toStudioContent` or `hydrateThemeNewsletterBlocks`: background sequence, button-on-dark rule, `appearance.border` and `padding`, `imagePosition` zigzag, CTA `centered-hero`, `footer.newsletterSettings`.
   - The model writes copy only.
3. **Copy limits in the schema:** headline at most 7 words, body one sentence of at most about 18 words, button 2–4 words, 3–5 item cards.
4. **Asset sources:**
   - Add POS products: read `products` plus the image inside `external_data`, scoped by `tenant_id`.
   - Add the design system for logo and colours.
   - Add a deterministic fallback for when the model fails, as CLAUDE.md requires. Today the function returns 503 or 422.
5. **Callers:**
   - bloom-assist `create_campaign` should call this engine instead of `buildBotanicalEditorial`.
   - The AI idea path should seed its campaign from this engine instead of unvalidated `templateBlocks`.

### 6.2 Keep, but not as engines

| Function | Why it stays | Depends on it |
|---|---|---|
| bloom-assist | Chat agent (281 calls) | Ask Bloom and `/bloom`. It should delegate newsletter creation to the engine. |
| generate-subject-lines | Subject and preview helper | bloom-assist, `NewsletterInboxReview.tsx` |
| generate-weekly-themes | Not AI; produces the `campaigns` theme rows the engine reads | Onboarding (`/onboarding/manual`), the `/calendar` backfill |
| update-holiday-calendar | Not AI; holiday dates | Caller is DEAD; decide separately |

### 6.3 Retire

**Retire after migrating the live caller first:**

| Function | Live caller (30-day calls) | What to do first |
|---|---|---|
| generate-newsletter-ideas | `NewsletterPicker` "Generate" (6 calls; 1 campaign) | Route idea generation to the engine, or turn ideas into briefs the engine expands |
| generate-email-content | bloom-assist `generate_content` email_body and product_description (3 calls) | Point bloom-assist at the engine for email bodies. Also fixes the header-only auth. |
| generate-structured-newsletter | Calendar holiday "Generate", newsletter channel → `content_tasks` (0 calls) | Replace the newsletter channel of the holiday flow with "start a holiday newsletter" through the engine |
| generate-content | Calendar holiday "Generate", social channels → `content_tasks` (0 calls) | The social channels belong to the retired social feature; remove them from `HolidayGenerationService`. It also writes `company_profiles` with a body `userId`. |

**Retire now (no live caller; 0 calls in 30 days):**

| Function | Notes |
|---|---|
| generate-newsletter | Dead caller in `ContentGenerationServices.ts`. Also dead `openai-client.ts`, `prompt-builder.ts`, `company-profile-handler.ts`. |
| generate-cohesive-newsletter | Never called |
| regenerate-email-content, regenerate-content-block | Only caller is the dead `aiContentRegenerator.ts` |
| generate-plan-email | Only caller is the unrouted `/plan` wizard |
| generate-multichannel-content | Only test importers; writes `draft_snapshots` |
| auto-generate-weekly-campaigns | Cron removed 2026-11-23; failed on every run; created no content |
| generate-campaign-content, generate_campaign_content, optimize-content, generate-social-content | Already 410 stubs. Delete the folders and the e2e mock (`e2e/suites/error-handling.spec.ts:17`), update the gate test (`src/__tests__/productSimplificationGate.test.ts:95-101`), and remove the bloom-assist `social_post` route (`content-generation.ts:833-871`). |
| content-generation-cache | Not AI; never called |

**Dead frontend modules that go with these:** `ContentGenerationServices.ts`, `NewsletterRegenerator.tsx`, `regenerateNewsletterContent.ts`, `usePersonaAwareGeneration.ts`, `ShortenAllBlocksButton.tsx`, `ContentIntegrationSidebar.tsx`, `aiContentRegenerator.ts`, `useHolidayCalendarUpdate.ts`, `CampaignAutomationSettings.tsx`, `emailContentService.ts`, `useContentGenerationOrchestrator.ts`, `ContentOptimizer.tsx`, `useThemeGeneration.ts`, `NoCampaignStateCard.tsx`, and the 16 `src/components/crm/studio/blocks/*Renderer.tsx` files.

### 6.4 Risks to note before any retirement

- **Deploy order:** deleting a function folder does not undeploy it. Each retired function must be removed from the Supabase project after its callers ship.
- **Holiday flow:** the calendar "Generate" button is live. Retiring generate-content or generate-structured-newsletter without changing `HolidayGenerationService.ts` breaks it.
- **Auth defects stay open until retirement or a fix:** the header-only handlers and the no-auth generate-weekly-themes (section 2.4).
- **Not verified:** the BloomSites side (site `f599e50e`, the catalogue contents for Lacoste) was not inspected, because that database was not accessible.
