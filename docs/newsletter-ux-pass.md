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
