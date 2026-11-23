# Newsletter UX pass

Branch `claude/newsletter-ux-pass`, from `main` at `e8b5d80`. Test tenant: Greenfield Garden Centre (`3eade43c-2e5a-4ad0-80fb-500e3d7afbd4`).

Overlapping in-flight branch: `claude/jolly-turing-jn9ylf` (PR #606), which implements `docs/newsletter-build-audit.md`. It already covers:
- the calendar duplicate creating a copy with no body (part of #5)
- weekly theme images (needed by #16)

Separate in-flight work with no overlap: PR #605, Care Guide Studio (its own renderer).

## Flow map (written before any edits)

| Step | Route (`src/App.tsx`) | Page | Notes |
|---|---|---|---|
| Dashboard | `/dashboard` | `src/pages/BloomSuiteDashboard.tsx` | "Create an email" quick action goes to `/newsletters/new`. The "Reachable customers" card comes from `useTenantAudienceHealth`. |
| Create a Newsletter | `/newsletters/new` | `src/pages/NewsletterNewPage.tsx` | "Open blank editor" goes to `/crm/campaigns/new?type=newsletter`. "Pick an Idea" opens `NewsletterPicker`, then `NewsletterLayoutPicker`, then the editor with `location.state.newsletterIdea`. |
| Setup form | `/crm/campaigns/new`, `/crm/campaigns/:id/edit`, `/crm/campaigns/:id` | `src/pages/crm/CRMCampaignEditorPage.tsx` inside `CampaignEditorProvider` | Steps: 1 Campaign details, 2 Subject & preview, a separate "Preview" accordion, 3 Audience, 4 Design your newsletter, 5 Actions (Send now / Schedule). Final dialog: `CampaignSendConfirmation`. |
| Design Studio | `/crm/campaigns/:id/studio` (full screen) | `src/pages/crm/CampaignStudioPage.tsx` | `StudioTopBar` (52px row), `BlockLibrary`, `StudioCanvas`, `BlockPropertiesPanel`, `StudioBottomBar`. |
| Preview & Test | modal | `src/components/crm/studio/StudioPreviewDialog.tsx` | Renders with `generateEmailHtml({audience:{previewAll:true}})`. Test send uses `send-test-email-v2`. |
| Review & Send | `/crm/campaigns/:id/edit?step=review` | setup form | Studio's "Review & Send", back arrow and close button all run `handleExit`, which flushes saves and navigates here. With `step=review` the page shows `CampaignBlockerRow` and opens Audience. |

### Where state lives

**Setup form: `CampaignEditorContext`**
- Holds one `CampaignEditorState`: name, type, subject, preheader, sender, reply-to, segments, personas, include-all, extra people, audience count, `contentBlocks`, smsMessage, schedule, dirty and autosave state.
- Seeded from the URL and `location.state`. An existing draft loads with `fetchCampaignEditorRecord`.
- Autosaves every 3s through `persistCampaignDraft` → `persistCampaignRecord`.

**Studio: `useStudioState` plus page refs**
- Owns block history (undo/redo), selection, device, name, status, subject, preview text and sender.
- Newsletter "Design & spacing" settings are stored on the footer block (`newsletterSettings`).
- The page keeps `campaignRecordRef`, `savedFingerprintRef` and `saveStatus`, and autosaves every 3s through `persistCampaignDraft`.
- Audience, schedule and reply-to are copied through from the loaded record without being edited.

**Hand-off.** There is no shared memory between the two. The setup form saves and then navigates to Studio (`resolveStudioDraftId`). Studio flushes its saves and navigates back with `?step=review`, and the setup form reloads from the database.

**One renderer.** `src/lib/studio/emailHtmlGenerator.ts` (`generateEmailHtml`) produces the Studio canvas, previews, the draft `content` snapshot, test sends and live sends. Sending loads it through `supabase/functions/_shared/campaignEmailSource.ts`.

## Report

### #1 Audience counts: done (UI), with a STOP on the send path

**Which column the send path uses.** `send-email-campaign` reads `crm_customers.email_opt_in`, never `email_consent`.
- It excludes only `email_opt_in = false` (`.not("email_opt_in","is",false)`), so NULL consent is included. Today no live customer has NULL.
- It drops empty and `@noemail.local` addresses.
- It then filters through `canSendEmailBatch`, which checks the tenant `suppression_list`, the global suppression list and, when an environment flag is set, role-based addresses.
- **It does not read `crm_customers.suppressed`.**

**Shared function** `public.email_reachability_summary(tenant, customer_ids)` (migration `20261123171243`). The dashboard and the Audience step both call it, and the buckets are exclusive in this order:
1. asked us to stop
2. can't be sent to: `crm_customers.suppressed`, tenant or global suppression, hard bounce, or an invalid address
3. said yes
4. waiting

**Verification SQL** (same CASE as the function, run as service role):

```sql
select set_config('request.jwt.claims','{"role":"service_role"}', true);
select * from public.email_reachability_summary('3eade43c-2e5a-4ad0-80fb-500e3d7afbd4');
-- total 9500 | reachable 0 | waiting 0 | stopped 0 | unsendable 9500
select * from public.email_reachability_summary('19c15e83-017c-418b-9668-c8a78db496bd'); -- Flowerhouse
-- total 270 | reachable 244 | waiting 1 | stopped 21 | unsendable 4   (244+1+21+4 = 270)
```

The UI now shows Greenfield: Said yes 0, Waiting 0, Asked us to stop 0, Can't be sent to 9,500, total 9,500. The dashboard shows 0 reachable. Both values come from the function rows above. The mapping is unit-tested in `src/hooks/__tests__/useTenantAudienceHealth.test.ts`.

**STOP: the send path does not match the shared definition, and Jon needs to decide which one changes.** "Match the send path exactly" and "Greenfield must show 0 reachable" cannot both be true today, because sending ignores the `suppressed` flag. These customers have `suppressed = true` and `email_opt_in` not false and no suppression-list row, so a send to "all customers" would still include them:

| Tenant | Flag-suppressed but sendable | `suppressed_reason` |
|---|---|---|
| `13b62ff0-4dc0-4451-a851-bb142a25ea62` | 89,656 | No email opens in 180 days |
| `3eade43c-…` Greenfield | 7,600 | demo_synthetic_data (addresses at `greenfield-demo.example.invalid`) |
| `36bd97b6-2564-465b-b2a6-1369a07f2546` | 336 | No email opens in 180 days |
| `0a626809-…` Brands in Blooms | 6 | (none) |

Decision needed:
- **(a)** The send path honours `crm_customers.suppressed`. Those customers stop receiving email, including 89,656 inactive contacts at one tenant.
- **(b)** The UI follows the send path and treats the flag as advisory. Greenfield would then show 7,600 reachable.

The UI currently does (a), as your ground truth asks. The send path is unchanged.

### #8 Campaign name and empty drafts

**Delete query.** Migration `20261123174042` adds `public.delete_stale_empty_campaign_drafts(tenant, dry_run default true)`, callable by service role only. A draft is deleted only when all of these hold:
- status is draft, never scheduled or sent
- subject is empty
- no block has text, an image or a button (headers, dividers, spacers and the footer don't count)
- not edited for 24 hours
- no copy or push message points at it, and it isn't under website review

**Row counts before running.**
- Test tenant: 0 rows (dry run 0). It has 16 drafts without a subject, but all were edited today. 12 of those are footer-only and will qualify after 24 hours.
- Other tenants: 24 rows would qualify. These were **not** touched.

**Run on the test tenant:** `select * from delete_stale_empty_campaign_drafts('3eade43c-…', false)` deleted 0 rows.

**Decision needed (not a blocker).** The function is not on a schedule. Running it automatically for every tenant needs your OK, because 24 drafts on other tenants would go on the first run.

### #14 Brand defaults: done, with a STOP on one sub-item

**Done:**
- The blank canvas is built from the tenant's design system. The header shows the store name and logo.
- New footers use the logo, the brand primary as background with contrasting text, and `company_profiles.company_email`.
  - That is the business email. For Greenfield it is `mail@northfieldgardens.ca`, not the login `jon@…`.
- New buttons use the brand primary.
- Colour pickers list brand swatches first, then None, black and white.
- The render-time fallback footer is unchanged, so stored and sent campaigns re-render the same.

**STOP: Greenfield's "brand primary" is `#22c55e`.** That is the value stored in `company_profiles.brand_primary_color`, with secondary `#1e40af` and accent `#f59e0b`. Those are the colour-settings page defaults, apparently saved as real values. The Studio code has no `#22c55e` default of its own.

Decision needed: should the untouched defaults (`#22c55e` / `#1e40af` / `#f59e0b`) be treated as "not set" and replaced by a neutral BloomSuite palette? Or should the tenant's colours be fixed in Settings? No tenant data was changed.

### #25 Mobile image height: done in Studio, with a STOP on the sent rule

**The sent rule.** `emailHtmlGenerator.ts` (`@media only screen and (max-width: 599px)`) forces every cropped image to `height:240px !important`. That covers `.responsive-crop-image` on Image blocks, Image + Text blocks other than 9:16, and product cards. Width goes to 100%, and the crop relies on `object-fit:cover` set inline.

**Done.** The Studio canvas is now a CSS container (`studio-email`). Image and Image + Text renderers apply the same 240px height below 600px, so phone (375) and tablet (480) views match the sent email.
- Measured at 375 and 480: Studio 240/240 and sent 240/240.
- At 640: Studio 400/222 vs sent 400/213, the same as before this change.
- Screenshot: `newsletter-ux-pass/mobile-parity-375.png`.

**STOP: the sent rule is questionable.** The fixed 240px height distorts photos in clients that ignore `object-fit`: many Outlook builds, and some Android Gmail renderings. There, a 3:2 photo is squashed instead of cropped. Changing it would change the output of already-sent campaigns, so it was left alone.

Decision needed: keep 240px, or switch the mobile rule to `height:auto` behind a new opt-in setting stamped only on new drafts (the same gating as #2's `emptyBlocks`)?

### #26 Preview & Test: done
- The left rail is replaced by one top bar: Preview / Send test toggle, device buttons and the inbox line.
- The test-recipient row appears under the bar only on Send test.
- Measured at 1320x881: the preview area grew from 712px to 938px wide.
- Screenshots: `preview-1320.png`, `preview-test-1320.png`.

### #28 Campaign list: done
- **Type filter: merged.** Every newsletter built today is stored as an email campaign. `channel = "newsletter"` only marks older rows synced from the legacy newsletter tool, so "Newsletter" and "Email" are now one "Email" type. Old `?type=newsletter` links resolve to Email.
- **Empty drafts.** A draft with no subject and no block a reader would see shows "Empty draft" (same `hasContentBlocks` rule as #2 and #8).
- **Pluralisation.** "1 campaign - 1 active send".
- **Widths at 1320.** The table fits the shell content area with no truncated headers or values (`scrollWidth` checked on every cell). Open and click rate columns now appear from 1536px (`xl`).
  - At 1320 they no longer push Date under the sticky Actions column.
  - The rates are still in the campaign report and insights.
- Screenshot: `campaign-list-1320.png`.

### #16 Image source picker: done, theme tab is a placeholder
- The Image block's photo field now has five tabs: My images, Products, This week's theme, Upload, Paste link.
  - **My images:** opens the existing tenant media library (`AIImageStudio` on its `my-images` tab).
  - **Products:** searches the connected website's products through the authenticated `connected-content` function. Titles have sizes stripped and the full title is kept for alt text.
  - **Upload** and **Paste link:** the existing controls.
- Generate with AI is a secondary plain button under the tabs.
- Verified in the DOM at panel width (320px): picking a product sets the block's image URL, the current photo stays visible on every tab, and no tab label is clipped. Screenshot: `image-source-products.png`.
- **This week's theme** is a placeholder. Weekly theme images exist only on PR #606 (`claude/jolly-turing-jn9ylf`), which is not merged. Wire this tab to its theme image list once it lands.

## Item status

| # | Status | Commit | Evidence |
|---|---|---|---|
| 0 | Done | `a6efaa95b` | Flow map above, written before edits |
| 1 | Done (UI), **STOP** on send path | `d73e62e31`, `8d7df73d5` | SQL vs UI: Greenfield 9500 / 0 / 0 / 0 / 9500 (re-run at the end of the pass); unit tests |
| 2 | Done | `3fd8e2f96` | Renderer tests; empty-blocks notice in step 5 and the send dialog |
| 3 | Done | `2486f7a47` | `toolbar-1200/1280/1320/1440.png`; one 52px row, nothing clipped |
| 4 | Done | `a359b81f2` | Harness: "Open blank editor" creates a draft and lands on `/crm/campaigns/:id/studio` |
| 5 | Done; calendar duplicate skipped (covered by PR #606) | `450aee930` | Copy dialog harness screenshot |
| 6 | Done; team-sharing **STOP** | `1c9106905`, `e6792654a` | Tenant-scoped query and key; test updated |
| 7 | Done | `156a6e9eb` | `layout-cards.png`, `flow-2-layout-cards.png` |
| 8 | Done; schedule needs OK | `ef1238d44` | Delete query and counts in the #8 section; test tenant deleted 0 |
| 9 | Done | `5da4db1f5` | `flow-3-setup-form.png` (steps 1–5, preview inside step 2) |
| 10 | Done | `6ee1a0072`, `d6b66cd7c` | Checklist with Fix buttons; disabled-state test |
| 11 | Done | `c01306c8e` | Ask Bloom trigger removed from the setup page |
| 12 | Done | `f3a5481b5` | Prompt and UI tests |
| 13 | Done | `b90600d01` | Outlined buttons with icons (`audience-step.png`) |
| 14 | Done; **STOP** on `#22c55e` | `0c2c76393` | Tests; fallback footer unchanged |
| 15 | Done (warning only) | `52905f3fb` | `findIdentityMismatches` tests; no tenant data changed |
| 16 | Done; theme tab placeholder | `b170475a5` | `image-source-products.png` |
| 17 | Done | `906699383` | `placeInsertedBlocks` tests |
| 18 | Done; price needs API | `b0b3be913` | Tests. The connected-content catalog returns no price, so the price line shows only when the API adds it |
| 19 | Done | `d0114c0fe` | Canvas harness |
| 20 | Done | `5efe75c12` | `mergeLookFields` tests |
| 21 | Done | `9bf6448bb` | Canvas harness: toolbar above the block |
| 22 | Done | `1c803554a` | Preset grid harness |
| 23 | Done | `e8c0ab83f` | Dialog shows the shared save state; no separate Save |
| 24 | Done | `8506bb3f9` | Tests updated for removed duplicates |
| 25 | Done (Studio); **STOP** on the sent rule | `417beb316` | 240/240 parity at 375 and 480 |
| 26 | Done | `891a1eb3d` | Preview area 712 → 938px |
| 27 | Done | `7101d81dd` | Skeleton harness |
| 28 | Done (types merged) | `b22dd024b` | `campaign-list-1320.png`, no truncated cells |

## Phase 7 verification

- **Typecheck** (`tsc -p tsconfig.app.json`): 97 errors, all present on `main` before this branch. None are in files this pass added.
- **Lint.** The repo-wide `eslint .` reports 2,777 errors on the existing baseline. I compared every file this branch touches against the branch point: no file gained an error (`settings.ts` had 4 before and 4 after; new files have 0).
- **Full suite** (`vitest run`): 3,248 passed, 4 skipped.
  - The only failing files are 3 suites that import `xlsx`: `ideal-workbook`, `programme-service` and `spreadsheetLimits`.
  - They fail because this container cannot download `xlsx` from cdn.sheetjs.com, not because of the code.
  - One older assertion on the send button predated #10 and was updated in `d6b66cd7c`.
- **Tests for #1, #2, #8, #17, #20:**
  - #1: `useTenantAudienceHealth.test.ts`
  - #2: `newsletterFeatures.test.ts`, including "re-renders campaigns without the flag exactly as before"
  - #8: `campaignWriterContext.test.ts`
  - #17: `useStudioState.test.tsx`
  - #20: `newsletterFeatures.test.ts`
- **Sent campaigns re-render identically.** I took 3 sent campaigns, using their stored `metadata.contentBlocks`, subject and preview text:
  - `b7241f42` (The Flowerhouse, sent 2026-11-20)
  - `f8c2fa90` (sent 2026-11-17)
  - `b2e7170e` (sent 2026-11-12)

  I rendered them with `generateEmailHtml` from the branch point (`main`) and from this branch, in send mode and in preview mode. All 6 outputs are byte-identical:

  | Campaign | Length | SHA-256 (first 16) |
  |---|---|---|
  | b7241f42 | 19,764 | e10052ceff6e4d3e |
  | f8c2fa90 | 21,607 | 51ee256962f61723 |
  | b2e7170e | 22,220 | 5bf66e59f91240b6 |

  `b7241f42` contains an Image + Text block with no image and a gallery slot with no URL, which exercises the #2 empty-block gate. It renders unchanged because sent campaigns don't carry `emptyBlocks: "skip"`.
- **Screenshots at 1320x881** (`docs/newsletter-ux-pass/flow-1…7`): Create a Newsletter, layout cards, setup form, Studio canvas, Studio toolbar, Preview & Test, campaign list.
  - These come from a Vite harness that mounts the real page components, with Supabase calls stubbed.
  - A logged-in run of the live app was not possible from this container: it has no browser session for Jon's account, and signing in as a customer is not allowed.
  - Live verification is still owed on: the dashboard reachable card, and the Audience step for Greenfield.
- **No real campaign** was sent, scheduled or test-sent. No customer or tenant data was changed. The only write was the #8 delete function on the test tenant, which removed 0 rows.

## Phase 8 plan: one builder

**Goal.** Build an email in one place, Studio, instead of the setup form, then Studio, then back to the setup form.

**Routes affected** (`src/App.tsx`):
- `/crm/campaigns/:id/studio` becomes the only builder for email.
- `/crm/campaigns/new?type=newsletter` already creates a draft and opens Studio (#4).
- `/crm/campaigns/:campaignId/edit` and `/crm/campaigns/:campaignId` for email drafts redirect to `/crm/campaigns/:id/studio?panel=send`. `?step=review` maps to `panel=send`.
- The setup form stays for SMS, which has no Studio, and for the locked and active-send views (`LockedView`, `ActiveSendView`).
- `sidebarNavigation.ts` titles follow the redirect.

**UI.** Studio gets a right-side "Send" panel next to the block properties panel, with four sections:
1. Subject & preview: the #12 suggestions and the #23 autosaving dialog content.
2. Audience: the #1 reachability numbers and the #13 controls.
3. Sender & checks: the #10 blocker checklist and the #15 warnings.
4. Send or schedule: `CampaignSendConfirmation` unchanged.

The existing step components move as-is; they are already section components inside `CRMCampaignEditorPage`.

**State migration.** Today two stores hand off through the database:
- `CampaignEditorContext` (audience, schedule, sender, reply-to)
- `useStudioState` (blocks, subject, preview, sender)

The plan:
- Mount `CampaignEditorProvider` around Studio, seeded from the same `fetchCampaignEditorRecord`.
- Make `useStudioState` own only blocks, selection and history.
- Run one autosave loop through `persistCampaignDraft` instead of two 3-second loops that can overwrite each other's fields. Today Studio copies audience and schedule through untouched, which is the main source of stale-overwrite risk.

**Draft migration risk: low.** There is no schema change. Drafts already live in `crm_campaigns`, with `metadata.contentBlocks` and the `campaign_blocks` mirror.

The risks are behavioural:
- **Open drafts during deploy.** Someone has the old setup form open when the redirect ships. The fingerprint check in `persistCampaignDraft` already rejects stale saves; keep it.
- **Campaigns mid-review** (`send_blocked_reason`, website review) must still open the locked view.
- **Saved bookmarks** to `/edit` keep working through the redirect.
- **SMS** keeps the old form.

**Effort.** About 2–3 weeks for one engineer:
- Send panel and moving the sections: 1 week
- Single state and autosave: 3–4 days
- Redirects, navigation titles, locked and active-send paths: 2 days
- Tests and live QA on the test tenant: 3 days

## Decisions needed from Jon

1. **#1 send path.** Should sending honour `crm_customers.suppressed`?
   - Yes: 89,656 inactive contacts at tenant `13b62ff0…` stop receiving email.
   - No: the UI goes back to counting flag-suppressed contacts as reachable, and Greenfield would show 7,600.
   - The UI currently honours the flag. The send path does not.
2. **#14 colours.** Greenfield's stored `#22c55e` / `#1e40af` / `#f59e0b` are the settings page defaults. Should those untouched defaults be treated as "not set" and fall back to a neutral palette, or should the tenant's colours be fixed in Settings?
3. **#25.** Keep the 240px mobile crop for sent email, or move new drafts to `height:auto` behind an opt-in flag?
4. **#8.** Run `delete_stale_empty_campaign_drafts` on a schedule for all tenants? 24 drafts on other tenants would be removed on the first run.
5. **#6.** Team-shared templates (`tenant_id IS NULL`, made by another user in the tenant) need an RLS change to be visible to teammates. That is a permissions change, so it was not made.
6. **#18.** The connected-content catalog does not return product prices. Adding price to the website API turns on the price line that #18 already renders.
