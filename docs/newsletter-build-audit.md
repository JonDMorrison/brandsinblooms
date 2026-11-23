# Newsletter Build Audit

Date: 2026-11-23. Scope: read-only audit of how email newsletters (`crm_campaigns`) get built in BloomSuite. Repo `brandsinblooms` at `e8b5d80`; Supabase project `udldmkqwnxhdeztyqcau`. No code or data was changed. Row counts are live as of the audit date.

## Summary

- Every email campaign is written by one shared client writer (`persistCampaignRecord`). It never records where the content came from. `template_id` is null on all 233 rows because no code path ever produces a value for it. It is a free-text column with no foreign key, and is only copied during duplicate.
- "Start from this week's theme" exists only as text. `/newsletters/new` seeds a draft from the global `master_campaign_templates` table (title, theme, content ideas). It ignores the tenant's own weekly `campaigns` rows, and no theme has an image. `campaign_blocks` is not linked to weekly themes at all: all 2,387 rows belong to `crm_campaigns`, or to campaign ids that no longer exist.
- There is one renderer, `src/lib/studio/emailHtmlGenerator.ts`. Studio, preview, test sends and live sends all use it. Image cropping relies on CSS `object-fit`, which Gmail, Outlook desktop and Yahoo ignore. Sent mail also forces a 240px crop height on mobile that Studio does not show.
- `metadata.smsMessage` holds full email HTML on exactly 5 campaigns, all unsent drafts. The cause is a fallback in `extractSmsMessage` that loads `content` when `smsMessage` is missing; Studio autosave then saves that value. The SMS send pipeline never reads this field. Risk is low for these 5 rows. A related channel bug is rated high (see section 6).
- Usage over the last 180 days: 109 campaigns. Origin cannot be recovered for 70 of them, because Studio stamps every block `source: "manual"`. Only 5 are provable duplicates and 1 is a title match to a weekly theme. Since 2026-03 no campaign with blocks has come from a weekly theme, a saved template or a persona template in any way the data can show.

---

## 1. Entry points that create a `crm_campaigns` email row

The shared writer is `persistCampaignRecord` in `src/lib/crm/campaignDraftPersistence.ts:676-923`. Its wrapper is `persistCampaignDraft` in `src/lib/crm/campaignEditor.ts:503-555`.

**`content`** (`:691-699`) is `renderDraftPreviewHtml(contentBlocks)`, falling back to `legacyContentHtml` and then to an empty-draft HTML page. It is a rendered snapshot only and is not authoritative at send time (see section 5).

**`metadata`**: `buildCampaignMetadata` (`:534-551`) writes `{...existing, campaignType, replyTo, smsMessage, includeAllCustomers, additionalCustomerIds, sourceSegmentId, sourcePersonaId, contentBlocks}`. `ensureFooterBlockCompliance` always adds a footer block.

**Never written:** `template_id`, `source_campaign_id`, `synced_from`, `delivery_method`.

**`campaign_blocks` mirror:** after each save the writer deletes and re-inserts the rows (`:582-627`), with `source = block.source || "manual"`. Studio save stamps every block `source: "manual"` (`src/pages/crm/CampaignStudioPage.tsx:318-340`), which overwrites any earlier provenance.

| # | Path | Route / entry | Component / function | Edge fn | Tables read | Fields written on `crm_campaigns` |
|---|---|---|---|---|---|---|
| 1 | Blank / from scratch | `/crm/campaigns/new` (`App.tsx:1032`), `/newsletters/builder` (`:1144`); links from `NewsletterNewPage.tsx:502`, `CRMCampaignsPage.tsx:1132/1399/1706`, `NewslettersPage.tsx:375` | `CRMCampaignEditorPage.tsx:1337-1351` (blank intent = newsletter-header + plain-text). Autosave runs `CampaignEditorContext.tsx:1130-1160` → `runDraftSave` → `persistCampaignDraft` (`:975`) | none | none | Shared writer. `contentBlocks` = editor blocks; `smsMessage` `""`; `template_id`/`source_campaign_id` null |
| 2 | Weekly theme | `/newsletters/new` (`App.tsx:1135`) idea cards (`NewsletterNewPage.tsx:410-428`); `NewsletterPicker.tsx:153-170` | Navigates to `/crm/campaigns/new?type=newsletter&flow=template-picker&templateId=weekly-theme-N&templateBlocks=…`. Seeded by `resolveNewsletterIdeaDraftSeed` (`src/lib/studio/newsletterIdeaSeed.ts:775-829`), then autosaved | none | `master_campaign_templates` (`useNewsletterIdeas.ts:37-42`). Does not read `campaigns` or `campaign_blocks` | Shared writer. Text-only blocks (hero, plain-text, synthetic CTA, footer). `templateId` stays in the URL and is never saved |
| 3 | Saved template | `/crm/campaigns/new`, `/crm/campaigns/:id/edit` | `handleApplySavedTemplate` (`CRMCampaignEditorPage.tsx:1365-1391`) → `updateContent({contentBlocks: layout_json})` | none | `saved_campaign_templates` (`useSavedTemplates.ts:75`; scoped by `user_id` only, not tenant) | Shared writer. Template id held in React state only |
| 4 | Seasonal / holiday intent template | IntentPicker in the editor | `applyTemplateToCampaign` (`CRMCampaignEditorPage.tsx:1278-1293`), `handleSelectIntent` (`:1337-1363`) | none | Code constant `CAMPAIGN_TEMPLATES` (`src/lib/studio/campaignTemplates.ts:408`). Not the `holiday_templates` table | Shared writer. `template.id` not saved |
| 4b | `holiday_templates` table | none | none | `update-holiday-calendar` (caller unreachable) | `holiday_templates` | **Never creates a campaign.** Holiday generation writes `content_tasks` (`HolidayGenerationService.ts:198`) |
| 4c | Persona template | none | `CampaignSuggestions.tsx:58` (imported nowhere) | none | `crm_persona_campaign_templates` | **Never creates a campaign.** `metadata.sourcePersonaId` comes from the `?persona=` URL param, not this table |
| 5a | Duplicate | `/crm/campaigns` row action (`CRMCampaignsPage.tsx:822-835`), locked view (`CampaignLockedView.tsx:621-630`), report (`CRMCampaignReport.tsx:1185`), command palette (`CommandPalette.tsx:1113-1124`) | `useCampaignCloning.cloneCampaign` (`src/hooks/useCampaignCloning.ts:66-120`) | none | `crm_campaigns`, `campaign_blocks` | `content` copied; `source_campaign_id` = original; `template_id` copied (always null); `metadata` = full copy (**including `smsMessage`**) plus `cloned_from` and `cloned_at`; `contentBlocks` with header dates refreshed. `campaign_blocks` copied verbatim with `source:'cloned'`, without the date refresh |
| 5b | Calendar duplicate | `/calendar` (`CalendarViewNext.tsx:486-492`) | `useNewsletterCalendar.duplicateNewsletter` (`src/hooks/useNewsletterCalendar.ts:228-252`) | none | `crm_campaigns` | **No `content`, no `metadata`, no `source_campaign_id`.** The copy has no body (bug) |
| 5c | Bloom `clone_campaign` | `/bloom` chat | `campaign-mutations.ts:1388-1457` | `bloom-assist` | `crm_campaigns`, `campaign_blocks` | `source_campaign_id`, `template_id` copied, metadata copied plus `cloned_from` |
| 6a | From my website (Connected content "Promote") | `/crm/connected-content` (`App.tsx:800`) | `ConnectedContentPage.tsx:121-152` → `persistCampaignDraft`, then `/crm/campaigns/:id/studio` | `connected-content` (catalog only) | Website catalog via edge function | Shared writer. Block carries `connectedContent{siteId,itemId,publicUrl,…}` (`src/lib/connectedContent.ts:93-104`). `smsMessage` `""` for email |
| 6b | Connected content review replacement | ConnectedEmailReview inside the locked view | RPC `replace_connected_email_draft` (`supabase/migrations/20261122080000_replace_connected_email_draft.sql:49-61`) via `connectedEmailReview.ts:60` | none (SQL) | `crm_campaigns` | `source_campaign_id` = reviewed campaign; `metadata.reviewedFromCampaignId`, `connectedContentSources`, `contentBlocks`. **No `smsMessage` key**, so the HTML fallback fires on the next edit (see section 6) |
| 7 | Import data / spreadsheet | Studio BlockLibrary button (`BlockLibrary.tsx:658-674`) → `DataImportDialog` → `src/lib/studio/newsletter/dataImport.ts:232+` | — | none (browser `read-excel-file`) | uploaded file | **Never inserts.** Adds blocks to an existing campaign (UPDATE via Studio save). No source marker |
| 8a | AI newsletter ideas | `/newsletters/new` | `useNewsletterIdeas.ts:186` → same seed as path 2 | `generate-newsletter-ideas` | none | Same as path 2. AI idea id is not saved |
| 8b | Weekly auto-draft cron | pg_cron job 57, `0 16 * * 1`, active; last run 2026-11-23 "succeeded" | `supabase/functions/auto-generate-weekly-campaigns/index.ts:169-193` | itself | `campaigns`, `content_tasks`, personas | Would write `synced_from = campaigns.id`, `metadata.auto_generated`, no `content`, no `contentBlocks`. **Zero rows exist with `synced_from` or `auto_generated`**: the cron fires but produces nothing |
| 9 | Bloom `create_campaign` | `/bloom` chat, resource form (`resourceFormRegistry.ts:461-463`) | `createCampaignExecution` (`campaign-mutations.ts:1000-1086`) | `bloom-assist` | `crm_campaigns`, Botanical templates | `content` = template content or `"<p>Draft campaign content will be added later.</p>"`; Botanical template writes `metadata.templateId` (camelCase) and `templateVersion`, not the column; `smsMessage` `""`. No `campaign_blocks` mirror |
| 10 | Calendar quick-add / "Schedule Newsletter" | `/calendar` (`App.tsx:715`) | `CalendarViewNext.tsx:308-362`; `CalendarNewsletterDialog.tsx:113-161` | none | `crm_campaigns` | Shared writer, `status:'scheduled'`, `contentBlocks: []`, which becomes footer only. The dialog passes `existingRecord?.smsMessage`, which inherits the HTML fallback |
| 11 | Automations | server | `run-automations/index.ts:403-414` | `run-automations` | automation config | `{tenant_id, name, subject_line, content, status:'sent'}`. No metadata |

**Dead or unreachable inserters:**
- `syncNewsletterToCRM` (`src/utils/newsletterSyncToCRM.ts:336-355`). It also omits `tenant_id`.
- `useNewsletterCalendar.createNewsletter`
- `NewsletterSchedulingModal`
- `saveCampaignAsDraft` (`crmCampaignService.ts:67-145`), which in practice never inserts
- `admin-manage-tenant create_campaign` (no UI)
- `PostToCRMButton`, which points at a route that does not exist

## 2. Origin tracking

**Why `template_id` is always null:**
- The column is `text` with no foreign key (`supabase/migrations/20251206003536_…sql:5`).
- The shared writer never sets it.
- Template identity lives in the URL (`templateId=weekly-theme-N`) or in React state (`selectedSavedTemplateId`, `template.id`) and is dropped on save.
- The only writes are copies during duplicate (`useCampaignCloning.ts:81`, `campaign-mutations.ts:1421`), which copy null.
- Bloom writes `metadata.templateId` instead of the column.
- Block-level `source` cannot recover origin either, because Studio overwrites it to `"manual"`.

**Proposal (not implemented).** Add one column, `crm_campaigns.origin text`, set once at insert and never overwritten by later saves:

| Value | Set by |
|---|---|
| `blank` | Blank intent / scratch |
| `weekly_theme:<campaigns.id>` | Theme seed (pass the tenant `campaigns.id`; fall back to `master:<week>` until the seed is tenant-aware) |
| `saved_template:<saved_campaign_templates.id>` | `handleApplySavedTemplate` |
| `starter_template:<CAMPAIGN_TEMPLATES id>` | Intent picker (static templates; covers "holiday" today) |
| `holiday:<holiday_templates.id>` | Reserved; no path today |
| `persona:<crm_persona_campaign_templates.id>` | Reserved; no path today |
| `duplicate:<source id>` | Every clone, including the calendar duplicate and Bloom |
| `review:<source id>` | `replace_connected_email_draft` |
| `website_import` | Connected-content promote (item id is already on the block) |
| `ai` / `ai:bloom_template:<id>` | Bloom `create_campaign`, AI idea seed |
| `calendar` | Calendar quick-add / dialog |
| `automation` | `run-automations` |

Plumbing:
- Add an `origin` input to `persistCampaignRecord`, written only on insert.
- Have the editor read it from URL or location state at seed time.
- Either drop `template_id` or make it a typed reference. `origin` makes it redundant.
- Stop Studio from overwriting `block.source`, or add `block.origin` so block-level provenance survives (needed for "pulled individual blocks from a theme").

## 3. Content sources

| Table | Rows | Last update | Live reader (UI) | Reachable from studio today | Status |
|---|---|---|---|---|---|
| `master_campaign_templates` | 52 | 2025-08-20 | `useNewsletterIdeas.ts:38` (`/newsletters/new`, `/newsletters`); `useWeeklyThemes.ts:206` (`/calendar` Schedule Theme) | Yes, text-only seed via `/newsletters/new`. Not in the editor's IntentPicker | Live. No image column |
| `campaigns` (weekly themes) | 2,233 (41 tenants; 2,085 `auto_generated_52_weeks`) | 2026-10-27 | `/calendar` (`dataFilters.ts:69`, `useWeeklyThemes.ts:190`); cron | **No.** Calendar "Open campaign" goes to `/crm/campaigns` with no seed | **Orphaned for the studio**: rich reader on the calendar, no path into a newsletter |
| `campaign_blocks` | 2,387 (909 rows on 180 live `crm_campaigns`; 1,478 rows on 445 campaign ids that exist in neither table) | 2026-11-23 | Mirror of `crm_campaigns` blocks: `campaignEditor.ts:353`, send path `_shared/campaignEmailSource.ts:241` | N/A: it is the studio's own backup store, not a source | **Zero rows belong to weekly `campaigns`.** No FK, so deleted campaigns leave orphan rows |
| `saved_campaign_templates` | 3 (3 tenants, all `usage_count` 0) | 2026-11-17 | `useSavedTemplates.ts:75` (IntentPicker "My templates") | Yes | Live, barely used; scoped by user, not tenant |
| `holiday_templates` | 19 (all active) | 2025-06-18 | none in `src/`; edge `update-holiday-calendar` (caller unreachable, no cron) | No | **Orphaned** |
| `crm_persona_campaign_templates` | 9 | 2025-07-16 | `CampaignSuggestions.tsx:58` (imported nowhere) | No | **Orphaned** |
| `crm_saved_blocks` | 0 | — | `useSavedNewsletterBlocks.ts:33` (Studio BlockLibrary) | Yes | Live, empty |
| `saved_blocks` | 0 | — | UI readers orphaned; `search-entities` edge function | No | Orphaned, empty |
| `content_blocks`, `content_templates`, `campaign_block_versions` | 0 each | — | hooks orphaned | No | **Dead** |
| `content_tasks` | 495 | 2026-05-16 | orphaned (`newsletterSyncToCRM`, ContentGenerationContext); cron reads `ai_output` | No | Orphaned; `source_content_task_id` is 0 on all campaigns |
| `CAMPAIGN_TEMPLATES` (code constant) | n/a | n/a | IntentPicker | Yes | Live; the only built-in starters |
| `global_image_gallery` / `global-ai-images` | n/a | n/a | `AIImageStudioMediaBrowser.tsx:824` | Yes (image picker) | Live; no theme or week tag; query has no explicit tenant filter |

## 4. Weekly themes

**How themes reach a tenant:**
- `master_campaign_templates` (global, 52 rows) is **not** what populates tenant `campaigns`.
- Onboarding (`src/components/onboarding/CompanyProfileCreator.ts:247-337`) inserts one placeholder row (`onboarding_immediate`). It then calls `generate-weekly-themes` with `generateAll52Weeks:true`. That branch returns a **hard-coded** list (`generate-weekly-themes/index.ts:29-176, 207-221`) and never reads the master table.
- Calendar backfill (`BackfillCampaigns.tsx:162`) does the same.
- The master table is copied into tenant rows only by:
  - the calendar "Schedule Theme" dialog (`CalendarViewNext.tsx:402-424`). Its handler is typed `theme: any` and reads fields the `WeeklyTheme` object does not have, so `theme`, `description` and `prompt` land as null.
  - two one-off SQL backfills in 2025-08.
- The RPC `copy_master_templates_to_campaigns` is referenced, but its definition is not in the migrations and its only caller is unreachable.
- Week numbering is mixed: ISO in `useWeeklyThemes` and `dateUtils`, non-ISO in onboarding and the cron.

**`campaign_blocks`:** never populated for weekly themes. Its RLS joins `crm_campaigns`, and 0 of its rows reference a `campaigns.id`. In practice a weekly theme is a title, a theme string, a description and a prompt. It has no blocks.

**Images:**
- No theme has an image, at any level.
- `master_campaign_templates` and `campaigns` have no image column.
- The legacy per-task Unsplash picker (`fetch-and-assign-images` → `content_tasks.image_url`) is unreachable.
- `useNewsletterIdeas.ts:87-91` computes a `heroQuery` per idea that nothing uses.
- AI images go to the `global-ai-images` bucket and `global_image_gallery` with no week or theme link.
- Image hosts in `campaign_blocks` (all studio-authored): Unsplash 106, `campaign-images` 65, `content-assets` 44, `global-ai-images` 28, and a relative `newsletter-fallback.jpg` placeholder 28. That placeholder is stripped from sent mail by `emailImageUrl.ts:111`.

**Can a tenant pull a weekly theme into the studio?**
- **As a starting point:** yes, but text only. `/newsletters/new` gives a draft whose `image-text` blocks fall back to plain text because there is no image URL. It is not offered in the editor's IntentPicker or on the calendar, and the draft keeps no link back to the theme.
- **As individual blocks:** no. BlockLibrary has no theme source, and the media browser has no theme or week filter.

**Missing for "use this week's theme and images":**
1. A tenant-aware seed that reads the tenant's `campaigns` row for the current ISO week (and its edits), not the global master.
2. Clean theme data:
   - onboarding and backfill should use the master list instead of the hard-coded one
   - fix the `handleThemeSchedule` field mapping
   - use one week-number function everywhere
3. Images per theme: a curated `image_url` set on `master_campaign_templates`, or per-tenant generated images tagged with `week_number` / `campaign_id` in `global_image_gallery`. Then the seed fills `imageUrl` on hero, image-text and full-width-image blocks.
4. Provenance on the draft (`origin = weekly_theme:<id>`, `synced_from`), so the calendar can show "email built" and link to it.
5. Entry points:
   - a "This week's theme" card in IntentPicker
   - "Create email from this theme" in the calendar theme dialog
   - "Insert from this week's theme" in BlockLibrary
   - a week filter in the media browser
6. A decision on cron job 57 (`auto-generate-weekly-campaigns`). It runs every Monday and currently yields nothing; if it ever succeeds it would create empty drafts. Retire it, or rebuild it on the same seed builder.

## 5. Rendering

**One renderer:** `generateEmailHtml` / `renderNewsletterBlock` in `src/lib/studio/emailHtmlGenerator.ts` (dispatch `:2157`; extended types in `newsletter/renderExtensions.ts:271`).

Server callers:
- `_shared/emailRenderer.ts:314-324` → `_shared/campaignEmailSource.ts:201-225`
- Used by `send-email-campaign` (`:2128, :2170`), `process-email-send-queue`, `send-test-email-v2`, `render-email-preview` and the automation senders.

Client callers:
- Studio canvas (`SharedEmailBlockPreview.tsx:75`)
- `StudioPreviewDialog.tsx:153`
- `ContentPreviewCard.tsx:122`
- the draft `content` snapshot (`campaignDraftPersistence.ts:467`)

**Source precedence at send** (`campaignEmailSource.ts:256-326`): `campaign_blocks` rows, then `metadata.contentBlocks`, then JSON inside `content`, then raw `content` HTML.

The editor reads in the opposite order: `metadata.contentBlocks` first, then `campaign_blocks` (`campaignEditor.ts:438-442`). The mirror sync swallows errors (`campaignDraftPersistence.ts:908-913`). Duplicate refreshes header dates in metadata but copies `campaign_blocks` stale (`useCampaignCloning.ts:86-97` vs `:125-136`). In both cases the email sent can differ from what Studio shows. **Risk: medium.**

**Dead code:** the per-type `src/components/crm/studio/blocks/*Renderer.tsx` components and `renderDraftBlock` (`campaignDraftPersistence.ts:182-452`).

**Block types:**
- In use in `crm_campaigns` (count of blocks): image-text 128, footer 121, divider 96, plain-text 79, email-safe-hero 55, newsletter-header 54, call-to-action 50, full-width-image 21, image-gallery 17, quote 12, graphic-hero 9, spacer 8, button 7, event 6, headline 5, social-follow 5, coupon 2, preheader 2, product-gallery 2, text 2, navigation 1, text-columns 1, product-card 1.
- One campaign (`d4cb1e15…`) has 9 raw `campaign_blocks` rows (with `block_type` and no `type`) stored as `contentBlocks`.

| Block | Preview vs sent |
|---|---|
| email-safe-hero / header | Same function. Studio shows the fallback image and placeholder copy; send drops relative URLs. The overlay variant hard-codes `background-position:center` (`:973`) and ignores the focal point |
| graphic-hero | Same. CSS background honours the focal point; Outlook VML `type="frame"` ignores focal point and fit |
| full-width-image / image | Same function; see the image notes below. Legacy `image` is normalized only on the server (`campaignEmailSource.ts:108`). The spacing wrapper (`:2290`) checks `full-width-image` only, so legacy `image` gets padding in sent mail but not in Studio |
| image-text | Same. `object-fit` / `object-position` on `<img>` (`:1297, :1313`). The `portrait-ratio-image` class has no CSS rule |
| product-card | **Diverges for legacy `type:"product"`.** Studio uses `renderProductCardBlock` (cover, 220px, focal point). The server normalizes to `product-card` and uses `picture()` (`renderExtensions.ts:82-90`: contain by default, no `object-position`) |
| product-gallery, image-gallery, coupon, quote, social-follow, divider, spacer, newsletter-header, plain-text, CTA/button, event, headline, etc. | Same |
| footer | Same; only links differ (real unsubscribe links at send) |

Applies to every block:
- Studio renders blocks without the `<head>` CSS. Its container query forces `.responsive-image{height:auto}`.
- Sent mail's media query forces `.responsive-crop-image{height:240px !important}` (`emailHtmlGenerator.ts:2436, 2471-2472`).
- **On mobile, Studio shows the full image while the sent email crops or squashes it to 240px.**

**Image handling without a real crop** (`emailHtmlGenerator.ts:1005-1016`):
- `contain = block.imageFit === "contain"`. Anything else, including an undefined value from AI, legacy or imported blocks, gets `height=maxHeight` (default 400, clamped 150–600) plus `object-fit:cover; object-position:<focal>`.
- Focal point exists (`imageFocalX`/`imageFocalY`, `src/lib/studio/imageFocalPoint.ts`, inspector `BlockPropertiesPanel.tsx:3370-3411`). It is CSS-only.
- Gmail web and app, Outlook desktop and Yahoo ignore `object-fit` and `object-position`, so the image is stretched to the fixed box instead of cropped. The 240px mobile override makes it worse.
- There is no server-side crop or transform URL (`emailImageUrl.ts` only normalizes URLs).
- The same pattern is in image-text, `picture()` and the event image (fixed 252px, focal point hard-coded 50/50).

Live exposure in `metadata.contentBlocks`:
- full-width-image: 15 of 21 `cover` with a fixed `maxHeight` (400 / 360 / 210); 7 of those set a focal point.
- image-text: 104 of 128 `cover`.
- graphic-hero: 6 `cover`.

## 6. Data integrity: HTML in `metadata.smsMessage`

**Affected rows.** Exactly 5 campaigns have a non-empty `smsMessage`, and every one of them is HTML. All are `campaignType:"email"` and all are unsent drafts.

| id | Tenant | Created | Length | Likely writer |
|---|---|---|---|---|
| `c1058453-d6a9-4c7a-9099-9c8abbde1069` | Brands in Blooms (test) | 2026-03-11 | 5,269 | Editor load fallback → save |
| `d4cb1e15-ddd7-4360-8174-1b8f8dda1bf5` | `abd28fa2…` | 2026-04-25 | 19,765 | Duplicate of `ee4a9a11…` (a legacy row with no metadata) → fallback on first edit → saved |
| `86794819-f140-4e2b-9280-6903018580e4` | Lacoste | 2026-10-31 | 18,016 | Inserted with an identical timestamp to the next row (a bulk insert, not a UI path) → fallback on edit |
| `e3dfee2c-ee38-4149-8c32-d08d788094e5` | Lacoste | 2026-10-31 | 15,783 | Same as above |
| `05979207-b797-47ca-894e-ce1927490673` | Greenfield (QA) | 2026-11-22 | 8,594 (equals `content`) | `replace_connected_email_draft` RPC (writes no `smsMessage`) → Studio autosave saved the fallback |

**Root cause.** `extractSmsMessage` (`src/lib/crm/campaignEditor.ts:182-186`):
```ts
return typeof smsMessage === "string" ? smsMessage : (row.content ?? "");
```
Any row created without a string `smsMessage` loads with the email HTML in that field. The following then save it back:
- `buildCampaignMetadata` (`campaignDraftPersistence.ts:542`), which writes `smsMessage` on every save, email included
- Studio autosave (`CampaignStudioPage.tsx:874`)
- `CalendarNewsletterDialog.tsx:157`
- editor state (`CampaignEditorContext.tsx:398`)

Clones then copy it verbatim. Bloom `campaign-mutations.ts:1219-1222` can also copy `campaign.content` into `smsMessage` when it switches a campaign to SMS without new content.

Rows that will hit the same fallback on their next edit:
- the review-replacement RPC
- calendar duplicate
- automation rows
- the cron (if it ever creates rows)
- the 103 rows with no metadata blocks

**Who reads it:**
- **The SMS send pipeline does not.** `send-sms-campaign`, `sms-campaign-enqueue-worker` and `sms-queue-worker` read `crm_sms_campaigns.message`. None of them strips HTML.
- Readers that do use it:
  - the editor SMS textarea and preview (`CRMCampaignEditorPage.tsx:2230, 2662`)
  - the report SMS panel (`CRMCampaignReport.tsx:759, 1666, 909`), shown only when channel is `sms`
  - These render text nodes, so the HTML appears as literal tags.

**Risk rating:**
- **The 5 rows: low.** They are email drafts, and the field is never sent.
- **Medium:** if a user switches one of these campaigns' type to SMS (`CRMCampaignEditorPage.tsx:1649-1661`), the textarea comes pre-filled with ~16 KB of HTML. Saving writes it into `content`.
- **High (adjacent, latent) — the `crm_campaigns` SMS channel is broken:**
  - An immediate send only sets `status='queued'`, and no worker picks it up.
  - A *scheduled* one is claimed by `claim_scheduled_campaigns` (no channel filter; `20260227235900_…sql:466`), and `auto-send-campaigns/index.ts:197` passes it to `send-email-campaign`, which **sends it as an email**.
  - No `crm_campaigns` row has `campaignType:"sms"` today, so there is no live exposure.

## 7. Usage, last 180 days

There are 109 `crm_campaigns` rows created since 2026-05-27, of which 35 were sent.

Origin was inferred in this order:
1. `demo_record` flag
2. `source_campaign_id` / `metadata.cloned_from`
3. name or subject exactly matching the same tenant's weekly `campaigns.title`
4. no `contentBlocks` (legacy or non-studio insert)
5. everything else, which cannot be attributed

Two other approaches did not work:
- **Image matching against `campaign_blocks`:** it only finds the campaign's own mirror rows, because weekly themes have no blocks.
- **Block `source`:** it is `manual` (578 blocks), missing (106) or `cloned` (9). It carries no information.

| Inferred origin | Campaigns | Sent | Tenants |
|---|---|---|---|
| Studio, unattributable (blank, weekly seed, starter or saved template, website promote; cannot be told apart) | 70 | 15 | 10 |
| Demo seed (Greenfield) | 27 | 9 | 1 |
| No blocks (legacy / automation / calendar) | 6 | 2 | 2 |
| Duplicate | 5 | 3 | 2 |
| Weekly-theme title match | 1 | 0 | 1 |
| Saved template / holiday / persona / auto-draft cron | 0 provable | — | — |

Within "unattributable":
- 22 non-demo drafts are footer-only, meaning abandoned blank starts:
  - West Coast Gardens: 20 generic-named drafts, 2026-11-03..05
  - Brands in Blooms: 2
- One is a website promote (`connectedContentSources`).
- The commonest repeated layout, newsletter-header › hero › text › quote › divider › CTA › footer, appears 4 times across 3 tenants. That is consistent with the weekly-theme or starter seed.

Per tenant:

| Tenant | Total | Sent | Studio | Dup | Weekly | No blocks | Demo |
|---|---|---|---|---|---|---|---|
| Greenfield Garden Centre | 29 | 9 | 2 | 0 | 0 | 0 | 27 |
| West Coast Gardens | 27 | 2 | 23 | 0 | 0 | 4 | 0 |
| Brands in Blooms | 18 | 1 | 18 | 0 | 0 | 0 | 0 |
| The Flowerhouse | 15 | 13 | 11 | 4 | 0 | 0 | 0 |
| Burnett's Country Gardens (`baf927f2`) | 6 | 0 | 6 | 0 | 0 | 0 | 0 |
| Baltimore Valley Garden Centre | 5 | 3 | 4 | 1 | 0 | 0 | 0 |
| Arts Nursery Garden and Home | 2 | 0 | 2 | 0 | 0 | 0 | 0 |
| Jon's Testing Account | 2 | 0 | 0 | 0 | 0 | 2 | 0 |
| Lacoste Garden Centre | 2 | 0 | 2 | 0 | 0 | 0 | 0 |
| Minter Country Garden | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| Default Organization | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| Burnett's Country Gardens (`681eec6e`) | 1 | 0 | 1 | 0 | 0 | 0 | 0 |

The Flowerhouse is the only tenant with a real sending habit (13 of 15 sent), and a quarter of its campaigns are duplicates. That points to "copy last week's email" being the actual workflow, not either of the two starts this audit is about.

## 8. Recommendations (ranked)

1. **Make both starts first-class in one picker. (Feature request.)**
   - In IntentPicker and `/newsletters/new`, show two equal primary cards: "Start from this week's theme" and "Start from scratch", with templates and duplicate as secondary.
   - The theme card reads the tenant's `campaigns` row for the current ISO week (not the global master) through the existing `resolveNewsletterIdeaDraftSeed`.
   - Add the same action to the calendar theme dialog.
   - Blank should open straight into Studio with a header + text + footer scaffold, so it stops leaving footer-only abandoned drafts.
2. **Give themes images, and let blocks be pulled individually. (New requirement.)**
   - Add a curated image set per master week (an `image_url`/`images` column, or tagged `global_image_gallery` rows keyed by week), with an optional per-tenant AI image using the unused `heroQuery`.
   - The seed fills `imageUrl` on hero, image-text and full-width-image.
   - Add "This week's theme" to BlockLibrary, and a week filter to the media browser.
   - While doing this, fix the data underneath: the `handleThemeSchedule` mapping, the hard-coded onboarding list, and mixed week numbering.
   - Retire or rebuild cron job 57.
3. **Record origin at insert. (New requirement.)**
   - Add `crm_campaigns.origin` with the values in section 2, written once by `persistCampaignRecord` and by the non-shared inserters (clone, Bloom, review RPC, calendar duplicate, automations).
   - Stop Studio overwriting `block.source`.
   - Drop or repurpose `template_id`.
   - Without this, adoption of either start cannot be measured.
4. **Fix image cropping in sent mail. (Regression: sent output diverges from Studio preview.)**
   - Replace `object-fit` cropping with a real crop: Supabase Storage image transforms (`/render/image/…?width=&height=&resize=cover`) computed from the focal point, or crop on upload.
   - Treat an undefined `imageFit` as `contain`.
   - Remove the mobile `height:240px !important` override, or mirror it in Studio.
   - Unify the legacy `product` rendering path.
5. **Close the integrity gaps around the draft record. (Regression.)**
   - `extractSmsMessage`: fall back to `""`, not `content`. Clean the 5 rows.
   - Add a channel guard to `claim_scheduled_campaigns` / `send-email-campaign` so SMS-typed `crm_campaigns` rows can never send as email.
   - Make the calendar duplicate use `cloneCampaign`; it currently creates bodiless copies.
   - Make the `campaign_blocks` mirror sync fail loudly, and refresh dates in both stores when cloning.
   - Fix the duplicate `contentBlocks` key in the `writeCampaignDraftSnapshot` type (`campaignDraftPersistence.ts:931-932`).

---

### Method notes

- **Code:** traced by reading the source, with import-graph reachability from `src/main.tsx`. All file:line references are at `e8b5d80`.
- **Data:** read-only `SELECT`s via Supabase MCP on `crm_campaigns`, `campaigns`, `campaign_blocks`, the template tables, `cron.job` and `cron.job_run_details`.
- **Not verified:**
  - Email-client rendering. The client behaviour described is based on documented `object-fit` support, not live sends.
  - The cron's runtime failure reason. Edge function logs were not pulled.
  - Whether `ConnectedContentPage`'s SMS text contains HTML from website descriptions.
