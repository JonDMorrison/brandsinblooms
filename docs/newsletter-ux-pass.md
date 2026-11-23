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
