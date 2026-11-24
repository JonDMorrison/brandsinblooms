# TypeScript typecheck baseline

Command: `npx tsc -p tsconfig.app.json --noEmit` (strict is off; `noImplicitAny` is off).

## What was wrong

Before this change, `tsc` reported **97 errors, all syntax errors** (TS1005, TS1128, TS1472,
TS1135, ...) in 37 files. When a program has syntax errors, `tsc` stops there and does not run
semantic checking, so the project typecheck caught nothing. That is how undefined identifiers
such as `ReferenceError: Sheet is not defined` reached production.

The tsconfig was not the cause. All 37 files contained broken code, mostly left over from bad
merges or half-applied edits. Vite never complained because **none of the 37 files is reachable
from `src/main.tsx` or from any test**. The bundler only parses modules the app imports.

## How reachability was determined

A script built the import graph with the TypeScript compiler API (`ts.preProcessFile` for
static and dynamic `import()`, plus `vi.mock(...)` specifiers, resolved with
`ts.resolveModuleName` using `moduleResolution: bundler` and the `@/*` alias). It scanned
`src/`, `__tests__/`, `e2e/`, `tests/`, `scripts/` and the root `*.config.*` files, then
computed what is reachable from:

- the app entry `src/main.tsx` (which `index.html` loads), and
- every vitest/playwright entry (`*.test.*`, `*.spec.*`, `__tests__/`, `e2e/`, `tests/`, `src/test/setup.ts`).

For all 37 files, the result was either unimported or imported only by other dead files. A
basename grep across `src`, `e2e`, `tests`, `scripts`, `supabase` and `.github` found no other
references. The only hits were unrelated files that share a name, such as
`crm/settings/DomainConnectWizard.tsx` and `pages/admin/AdminDashboard.tsx`.

## Files deleted (70)

**The 37 syntactically broken files** (all dead):

```
src/components/Homepage.tsx
src/components/content-sidebar/ContentApproval.tsx
src/components/content-sidebar/newsletter/NewsletterHelpers.ts
src/components/content-sidebar/newsletter/OptimizedNewsletterDisplay.tsx
src/components/content/useReviewQueue.ts
src/components/crm/blocks/HeaderBlockEditor.tsx
src/components/crm/blocks/TextBlockEditor.tsx
src/components/crm/personas/PersonaSelector.tsx
src/components/dashboard/CurrentCampaignSection.tsx
src/components/dashboard/DashboardContent.tsx
src/components/dashboard/current-campaign/CurrentCampaignSection.tsx
src/components/dashboard/current-campaign/useCurrentCampaignSection.ts
src/components/dashboard/seasonal-holidays/SeasonalHolidaysCard.tsx
src/components/domains/DomainConnectWizard.tsx
src/components/homepage/CleanupUtils.ts
src/components/homepage/ReadyToPostCard.tsx
src/components/homepage/TaskCreationUtils.ts
src/components/homepage/WeeklyThemeCarousel.tsx
src/components/homepage/WeeklyThemeSection.tsx
src/components/homepage/ready-to-post/CompactImageCarousel.tsx
src/components/integrations/square/SquareReauthorizationGuide.tsx
src/components/new-dashboard/ImageGallery.tsx
src/components/new-dashboard/SmartTimeRibbon.tsx
src/components/newsletter/NewsletterDisplay.tsx
src/hooks/useAdminData.ts
src/hooks/useAdminUsers.ts
src/hooks/useCanvaAuth.ts
src/hooks/useFocusThemes.ts
src/hooks/usePostConnectionFlow.ts
src/providers/OverlayManager.tsx
src/scripts/regenerateWorldVegetarianNewsletter.ts
src/utils/enhancedNewsletterToCrmConverter.ts
src/utils/imageVerification.ts
src/utils/newsletterCrmSyncTest.ts
src/utils/newsletterSyncToCRM.ts
src/utils/sendToCRM.ts
src/utils/tenantValidation.ts
```

**33 dead files that imported them.** These are the upward closure within the dead set.
Keeping them would have left unresolved imports (TS2307).

```
src/components/ContentSidebar.tsx
src/components/admin/AdminDashboard.tsx            (not pages/admin/AdminDashboard.tsx, which is live)
src/components/admin/NewsletterThemingTestButton.tsx
src/components/admin/RegenerateNewsletterButton.tsx
src/components/canva/CanvaEditor.tsx
src/components/content-sidebar/ImageSuggestionPanel.tsx
src/components/content/ReviewQueue.tsx
src/components/content/ReviewQueueCard.tsx
src/components/dashboard/ContentGenerationControl.tsx
src/components/dashboard/ContentPreviewSection.tsx
src/components/dashboard/DashboardGrid.tsx
src/components/dashboard/UnifiedDashboardGrid.tsx
src/components/dashboard/current-campaign/AccordionTaskItem.tsx
src/components/dashboard/current-campaign/CampaignContent.tsx
src/components/dashboard/current-campaign/CampaignContentList.tsx
src/components/dashboard/current-campaign/EnhancedAccordionTaskItem.tsx
src/components/dashboard/current-campaign/TaskItem.tsx
src/components/dashboard/current-campaign/TaskItemContent.tsx
src/components/dashboard/seasonal-holidays/EnhancedSeasonalHolidaysCard.tsx
src/components/focus/FocusCard.tsx
src/components/focus/FocusCarousel.tsx
src/components/focus/FocusFilterSheet.tsx
src/components/homepage/CampaignAutoManager.ts
src/components/homepage/ContentReviewDialog.tsx
src/components/homepage/NewsletterPreviewCard.tsx
src/components/homepage/NextStepBanner.tsx
src/components/homepage/TaskManagementUtils.ts
src/components/homepage/ready-to-post/ImprovedReadyToPostItem.tsx
src/components/integrations/IntegrationHub.tsx
src/components/integrations/SquareIntegration.tsx
src/components/newsletter/NewsletterSyncButton.tsx
src/components/ui-legacy/image-carousel.tsx
src/scripts/testNewsletterThemingFix.ts
```

No live file needed a syntax fix, so no file was stopped on.

**Not deleted (follow-up candidate):** about 80 more files are now orphaned. They are dead,
parse cleanly, and were imported only by the deleted files. Examples are
`components/content-sidebar/*`, `components/dashboard/seasonal-holidays/*` and several
`ui-legacy/*` widgets. A separate dead-code PR can remove them. Some of them still produce
semantic errors, such as imports of the deleted `@/components/ui/*`.

## True semantic baseline (after this change)

`npx tsc -p tsconfig.app.json --noEmit` now runs full semantic checking:
**653 errors in 269 files** (0 syntax errors).

Where the errors are, based on the import graph:

| Scope | Errors |
| --- | ---: |
| Reachable from the app (`src/main.tsx`) | 406 |
| Reachable only from tests | 157 |
| Dead code (unreachable) | 90 |

Environment notes:

- **xlsx:** 10 errors are `Cannot find module 'xlsx'`, because xlsx was not installable in
  the sandbox that produced this baseline. With xlsx installed, expect about 10 fewer errors
  in total, plus or minus a few downstream errors.
- **Deno code:** 43 errors are in `supabase/functions/**`. That is Deno code pulled into the
  program by `src` imports: `npm:` specifiers, the `Deno` global and URL imports.

### By error code

| Code | Count | Meaning |
| --- | ---: | --- |
| TS2322 | 161 | type not assignable |
| TS2345 | 150 | argument not assignable |
| TS2769 | 80 | no overload matches |
| TS2339 | 73 | property does not exist |
| TS2550 | 31 | property needs newer `lib` (e.g. `Array.prototype.at`, `Object.hasOwn`, `replaceAll`) |
| TS2307 | 28 | cannot find module (xlsx, Deno `npm:` specifiers, deleted `@/components/ui/*` in dead files) |
| TS2304 | 19 | cannot find name (all remaining are in dead/test-only files or the Deno global; see below) |
| TS2551 | 16 | property does not exist, did you mean |
| TS2352 | 16 | conversion may be a mistake |
| TS2589 | 11 | type instantiation excessively deep |
| TS1355 | 9 | `as const` on non-literal |
| other | 59 | 22 other codes, 7 or fewer each |

### Top 15 files

| Errors | File |
| ---: | --- |
| 40 | src/__tests__/IntegrationDetailPage.ga4-import.test.tsx |
| 33 | src/pages/crm/CRMCampaignEditorPage.tsx |
| 16 | src/hooks/askBloom/useAskBloomConversation.ts |
| 15 | src/pages/crm/CampaignStudioPage.tsx |
| 12 | src/hooks/useIntegrationDetailData.ts |
| 11 | src/components/sms/SMSCampaignWizard.tsx |
| 10 | src/pages/integrations/IntegrationDetailPage.tsx |
| 10 | src/__tests__/auth-login-hooks-order.test.tsx |
| 9 | src/components/crm/studio/BlockPropertiesPanel.test.tsx |
| 8 | supabase/functions/_shared/bloom-support/engineering.ts |
| 8 | src/pages/crm/CRMCampaignRecipientDetailPage.tsx |
| 8 | src/pages/PublishPage.tsx |
| 8 | src/components/joy/JoyButton.tsx |
| 8 | src/components/crm/customer-intelligence/IdealCustomerTypeExportPanel.tsx |
| 8 | src/components/calendar/calendarEventPresentation.tsx |

## Real runtime bugs found and fixed

Once semantic checking ran, it exposed these errors in **live** code. The first five are
runtime crashes of the "Sheet is not defined" kind.

| File:line (before fix) | Error | Runtime effect | Fix |
| --- | --- | --- | --- |
| `src/components/crm/AudienceSelector.tsx:79,89` | TS2448 `tenant` used before declaration | `ReferenceError: Cannot access 'tenant' before initialization` on **every render** of the audience selector (automation builder / flow canvas) | Moved `const { tenant } = useTenant()` above the query that reads it |
| `src/components/bloom/BloomStreamingMessage.tsx:430` | TS2304 `BlockRenderer` | `ReferenceError` while a Bloom research-mode reply streams (research progress block) | Added the missing import from `@/components/bloom/blocks/BlockRenderer` |
| `src/hooks/useMailchimpSyncLogs.ts:414` | TS2304 `batchStats` | `ReferenceError` building the timeline for a pending, not-yet-started Mailchimp import job | Derive `batchStats` from `row.batch_stats` in `buildTimeline` (same as `normalizeEntry`) |
| `src/pages/admin/AdminCostsPage.tsx:529` | TS2552 `Skeleton` | `ReferenceError` while the "Top 10 Resource Consumers" card loads | Use the imported `JoySkeleton` |
| `src/pages/admin/AdminCostsPage.tsx:571` | TS2304 `i` | `ReferenceError` once top tenants are loaded. A skeleton had been pasted where the tenant name belonged | Render `{tenant.tenant_name}` |
| `src/pages/integrations/square/CallbackPage.tsx:40` | TS2304 `errorDescription` | On an OAuth `?error=` return, a `ReferenceError` was caught by the generic handler, and the user saw a generic failure instead of the provider's message | Read `error_description` from the search params (same as the Lightspeed callback) |

Type-only fixes (no runtime effect, because the types are erased):

- `src/pages/crm/CRMCampaignsPage.tsx:154,163`: the missing `type CampaignStatus` import was added.
- `src/hooks/bloom/useBloomMessageMutations.ts:297`: the missing `type BloomTaskJsonObject` import was added.
- `src/components/crm/ai-image-studio/AIImageStudioConversation.tsx`: the component import and
  the type import were both named `AIImageStudioMessage` (TS2300 plus 11 TS2749). The component
  import is now aliased as `AIImageStudioMessageView`.

Remaining TS2304/TS2448 errors that were **not** fixed, because they are not reachable from the app:

- `src/components/content/task-item/TaskContent.tsx:80` `hasValidContent`. Reachable only from
  `src/__tests__/content-generation-ux.test.tsx` through `ManualContentGenerator`, and the
  intended definition is unclear.
- Dead files: `components/dashboard/FirstTimeUserWelcome.tsx`, `components/homepage/NewCampaignDialog.tsx`,
  `hooks/usePublishFlow.ts`, `lib/location/integrationTest.ts`, `pages/integrations/clover/CallbackPage.tsx`
  (not routed), `utils/newsletterToCrmConverter.ts`, `utils/seasonalAlignment.ts`.
- `Deno` global in `supabase/functions/**`. This is expected, because that code is not browser code.

## CI

No workflow in `.github/workflows` runs `tsc` on the app (`bloom-support.yml` only type-checks
Deno functions). This change cannot turn CI red.

## Recommended ratchet

1. Add `"typecheck": "tsc -p tsconfig.app.json --noEmit"` to `package.json`.
2. Add a small CI step that runs it, counts `error TS` lines, and **fails only if the count
   exceeds a committed baseline** (start at 653, or about 643 in CI where xlsx is installed;
   take the CI number from the first run). Lower the baseline whenever a PR reduces the count.
3. Make a **zero-tolerance gate for TS2304, TS2552 and TS2448** (undefined or TDZ identifiers)
   in files reachable from the app. These errors are runtime crashes, not style issues.
4. Consider excluding `supabase/functions/**` from the app program, or adding a Deno types shim,
   so that the baseline reflects browser code only.
5. Delete the roughly 80 remaining orphaned files in a follow-up dead-code PR.
