# CAMPAIGN MODULE — EXHAUSTIVE CONTEXT AUDIT

This artifact is paired with the raw source annex at `docs/campaign-module-audit/source-bundle/`.

The annex contains the actual copied source code bodies for the campaign-related files inspected during this audit. This markdown is the audit ledger and finding index. No fixes, recommendations, or speculative remediation steps are included.

## PART A — CAMPAIGN EMAIL SENDING INFRASTRUCTURE

### A1. Main send execution flow

- `src/utils/crmCampaignService.ts` is the main client orchestration layer for immediate send, scheduled send, reschedule, and unschedule flows. The immediate path claims the campaign via RPC and invokes the `send-email-campaign` edge function.
- `supabase/functions/auto-send-campaigns/index.ts` is the cron/manual orchestrator for scheduled campaigns. It logs campaigns stuck in `sending` longer than 15 minutes, claims campaigns through `claim_scheduled_campaigns`, verifies ownership through `verify_campaign_claim`, optionally resets broken claims back to `scheduled`, and then invokes `send-email-campaign`.
- `supabase/functions/send-email-campaign/index.ts` is the queue-builder, not the final provider sender. It gates entry through `ensure_campaign_sending`, loads governance, intervention, and reputation state, resolves audience from campaign segments, personas, and customer queries, runs domain/quota/abuse/suppression/compliance checks, writes `tracked_links`, inserts `email_messages`, creates `email_send_jobs`, updates `crm_campaigns.status` to `queued`, and stamps `sent_at` during queue creation.
- `supabase/functions/process-email-send-queue/index.ts` is the actual delivery worker. It claims jobs through `claim_email_send_job_ids` with fallback logic, claims message rows, paces provider sends through `acquire_provider_send_slot`, sends through Resend batch endpoints, bulk-applies results, performs durable recounts, and finalizes campaigns as `sent` or `sent_with_errors`.
- The verified execution model is queue-first. Success from `send-email-campaign` means the campaign was queued, not that provider delivery has completed.
- The verified background dependency is cron-first. `auto-send-campaigns` must continue running to move scheduled campaigns into queueing, and `process-email-send-queue` must continue running to drain the queue and finalize delivery.

### A2. Edge Functions, workers, and endpoints that touch campaign email sending

- Core send, queue, recovery, and dispatch functions:
  - `supabase/functions/auto-send-campaigns/index.ts`
  - `supabase/functions/send-email-campaign/index.ts`
  - `supabase/functions/process-email-send-queue/index.ts`
  - `supabase/functions/force-send-campaign/index.ts`
  - `supabase/functions/resend-missed-recipients/index.ts`
  - `supabase/functions/recompute-campaign-metrics/index.ts`
  - `supabase/functions/campaign-recipient-bulk-actions/index.ts`
  - `supabase/functions/campaign-recipient-export/index.ts`
- Preview and test-send surfaces:
  - `supabase/functions/render-email-preview/index.ts`
  - `supabase/functions/render-email-merge-tags/index.ts`
  - `supabase/functions/send-test-email/index.ts`
  - `supabase/functions/send-test-email-v2/index.ts`
  - `supabase/functions/send-transactional-email/index.ts`
- Delivery event, click, unsubscribe, and webhook surfaces:
  - `supabase/functions/process-email-webhook-deliveries/index.ts`
  - `supabase/functions/email-tracking-webhook/index.ts`
  - `supabase/functions/backfill-provider-events/index.ts`
  - `supabase/functions/redirect-click/index.ts`
  - `supabase/functions/track-email-click/index.ts`
  - `supabase/functions/handle-unsubscribe/index.ts`
  - `supabase/functions/update-email-preference/index.ts`
- Deliverability, domain, and email-governance-adjacent surfaces that affect campaign sendability:
  - `supabase/functions/get-deliverability-status/index.ts`
  - `supabase/functions/get-warmup-status/index.ts`
  - `supabase/functions/domain-health-check/index.ts`
  - `supabase/functions/email-domain-create/index.ts`
  - `supabase/functions/email-domain-repair/index.ts`
  - `supabase/functions/email-domain-verify/index.ts`
  - `supabase/functions/verify-email-domain/index.ts`
  - `supabase/functions/provision-email-domain/index.ts`
- Campaign content, audience, or scheduling inputs that feed campaign sending:
  - `supabase/functions/generate-campaign-content/index.ts`
  - `supabase/functions/generate_campaign_content/index.ts`
  - `supabase/functions/generate-email-content/index.ts`
  - `supabase/functions/regenerate-email-content/index.ts`
  - `supabase/functions/generate-subject-lines/index.ts`
  - `supabase/functions/ai-schedule-recommendations/index.ts`
  - `supabase/functions/smart-send-timing/index.ts`
  - `supabase/functions/auto-generate-weekly-campaigns/index.ts`
  - `supabase/functions/search-entities/index.ts`
- Campaign-adjacent automation email surfaces present in the repo but outside the CRM email campaign core path:
  - `supabase/functions/run-automations/index.ts`
  - `supabase/functions/process-automation-outbox/index.ts`
  - `supabase/functions/retry-automation-email-node/index.ts`
  - `supabase/functions/send-queued-emails/index.ts`

### A3. API routes, server actions, and non-edge backend surfaces

- `app/api` routes touching campaign email sending: Not Found.
- Next.js style `'use server'` actions touching campaign email sending: Not Found.
- Repo-local server action wrappers for campaign sending outside Supabase Edge Functions and Postgres RPCs: Not Found.
- The verified backend execution surface for campaign email sending in this repo is Supabase Edge Functions plus Postgres RPCs, constraints, triggers, and cron jobs.

### A4. Background processing, queueing, cron schedules, and retry machinery

- Queue tables and worker model:
  - `send-email-campaign` inserts per-recipient `email_messages` and per-batch `email_send_jobs`.
  - `process-email-send-queue` processes at most `MAX_JOBS_PER_INVOCATION = 10` jobs per invocation.
  - The worker uses `DEFAULT_BATCH_DELAY_MS = 500`, `DEFAULT_RESEND_BATCH_SIZE = 80`, and `MAX_RESEND_BATCH_SIZE = 100`.
  - The worker preserves a 10-second timeout buffer and stops early when close to invocation timeout.
- Retry and recovery logic:
  - Job claiming uses `claim_email_send_job_ids` with fallback direct-claim logic.
  - Claim retries downgrade to `batch_size = 1` on timeout.
  - Provider rate-limited sends retry up to 3 times.
  - `ensure_jobs_for_queued_email_messages` exists to recreate missing jobs for queued messages.
  - `retry_failed_email_messages` exists to requeue failed recipient messages.
  - `resend-missed-recipients` exists as a separate recovery function for missed recipients.
- Cron schedule evidence:
  - `supabase/migrations/20260205135000_reschedule_auto_send_campaigns_every_minute.sql` reschedules `auto-send-campaigns` to run every minute.
  - `supabase/migrations/20260103180906_343af155-00f0-43e3-ad9b-0365273baf80.sql` schedules `process-email-send-queue` to run every minute.
- Cron auth failure evidence:
  - `supabase/migrations/20260425041500_fix_cron_jobs_use_service_role_key.sql` states that broken cron auth broke scheduled campaign sending and explicitly calls out `auto-send-campaigns` as "THE CRITICAL ONE — Lacey's campaign was stuck for 7 days".
- Additional background governance controls affecting campaign execution:
  - reputation recalculation
  - intervention state
  - pause/resume RPCs
  - batch-safety evaluation
  - provider slot acquisition

### A5. Database tables, RLS policies, RPCs, constraints, and triggers

- Primary campaign-send tables verified through live schema inspection or generated types:
  - `public.crm_campaigns`
  - `public.email_messages`
  - `public.email_send_jobs`
  - `public.email_send_skips`
  - `public.email_tracking_events`
  - `public.tracked_links`
  - `public.campaign_hygiene_reports`
- Audience and campaign composition support tables visible in repo migrations and types:
  - `crm_campaign_segments`
  - `crm_campaign_personas`
  - `crm_campaign_content_blocks`
  - `crm_campaign_block_versions`
- Exact RLS policy names captured for campaign-send tables:
  - `crm_campaigns`: `"Users can view their own campaigns"` in `supabase/migrations/20260205173000_crm_campaigns_owner_select_policy.sql`
  - `email_messages`: `"Users can view their tenant's email messages"` and `"Service role can manage all email messages"` in `supabase/migrations/20260205090000_email_messages_and_claiming.sql`
  - `email_send_jobs`: `"Users can view their tenant's jobs"` and `"Service role can manage all jobs"` in `supabase/migrations/20251211201237_1cfe5613-6d16-4eb3-9964-c0ce99489a5d.sql`
  - `tracked_links`: `"Users can manage tracked links for their tenant"` and `"Service role access tracked_links"` in `supabase/migrations/20260103210202_05b16f9e-801c-4000-805e-7f3343a1fb82.sql`
  - `email_send_skips`: `"Users can view their tenant skipped sends"` and `"Service can insert skipped sends"` in `supabase/migrations/20260120222223_11737d0f-5dd7-4a0e-a424-6a41d4ad0bee.sql`
  - `campaign_hygiene_reports`: `"Users can view hygiene reports for their tenant"` in `supabase/migrations/20260224113000_campaign_hygiene_reports.sql`
  - `email_tracking_events`: `"Users can view tracking events for their campaigns"` and `"System can insert tracking events"` in `supabase/migrations/20250718145627-df7f354f-0396-4572-8287-888f72917423.sql`; `"Users can view events for their campaigns"` and `"System can insert tracking events"` in `supabase/migrations/20250718201133-255466e8-9062-4531-a514-2b07a74bf331.sql`
- Verified campaign-send RPCs and DB functions present in code paths or migrations:
  - `claim_campaign_for_send`
  - `set_campaign_schedule`
  - `claim_scheduled_campaigns`
  - `verify_campaign_claim`
  - `ensure_campaign_sending`
  - `claim_email_send_jobs`
  - `claim_email_send_job_ids`
  - `ensure_jobs_for_queued_email_messages`
  - `retry_failed_email_messages`
  - `apply_email_send_results`
  - `get_campaign_email_progress`
  - `get_campaign_delivery_status`
  - `get_tenant_reputation_policy`
  - `acquire_provider_send_slot`
  - `system_pause_email_campaign_sending`
  - `pause_campaign_sending`
  - `resume_campaign_sending`
  - campaign recipient/detail/export/bulk-action RPCs from `20260320193000_campaign_recipients_page_rpc.sql`, `20260320211500_campaign_recipient_detail_rpc.sql`, and `20260320234500_campaign_recipient_operations.sql`
- Verified campaign-send-adjacent triggers:
  - `update_crm_campaigns_updated_at` on `public.crm_campaigns`
  - `update_email_messages_updated_at` on `public.email_messages`
  - `update_email_send_jobs_updated_at` on `public.email_send_jobs`
  - `update_campaign_metrics_trigger` after insert on `public.email_tracking_events`
  - `trg_update_customer_last_open` after insert on `public.email_tracking_events`
- Constraint evidence:
  - The repo migration `supabase/migrations/20260224173500_reputation_tier_enforcement_m6.sql` expands `crm_campaigns.status` to runtime states including `queued`, `partially_queued`, and `sent_with_errors`.
  - The live schema snapshot captured through Supabase MCP still reports the older `crm_campaigns.status` check of `draft`, `scheduled`, `sending`, `paused`, `sent`, and `failed`.
- Additional queue and link indexes directly relevant to send execution:
  - `uq_email_send_jobs_campaign_batch`
  - `idx_email_send_jobs_claimable`
  - `idx_tracked_links_tenant_campaign`
  - `idx_tracked_links_deterministic`

### A6. Lifecycle states and state transitions

- Campaign-level runtime states used by client, worker, and migration logic:
  - `draft`
  - `scheduled`
  - `queued`
  - `partially_queued`
  - `sending`
  - `paused`
  - `sent`
  - `sent_with_errors`
  - `failed`
- Message-level states verified from schema and worker logic:
  - `queued`
  - `sending`
  - `sent`
  - `failed`
  - `skipped`
- Queue semantics:
  - `auto-send-campaigns` advances scheduled campaigns into queue orchestration and marks them `queued` when queue build succeeds.
  - `send-email-campaign` explicitly sets `campaignStatus = 'queued'`.
  - `process-email-send-queue` finalizes campaigns as `sent` or `sent_with_errors` and can auto-finalize campaigns previously left in `sending`.
- UI visibility semantics:
  - `CRMCampaignEditorPage` enumerates all nine campaign states.
  - `CRMCampaignRecipientsPage` only renders recipients for `sent`, `sending`, and `sent_with_errors`.

### A7. Rate limits, pacing, compliance, intervention, and other send gates

- `send-email-campaign` preflight gates:
  - `ensure_campaign_sending`
  - governance and intervention state reads
  - reputation policy reads
  - audience hygiene analysis
  - domain, quota, suppression, abuse, and compliance checks
  - system pause through `system_pause_email_campaign_sending` with direct update fallback
- `send-email-campaign` batching and insert throttles:
  - `DEFAULT_BATCH_SIZE_PER_JOB = 50`
  - DB insert chunk size starts at `200`
  - chunk size halves on statement timeout down to `25`
  - `available_at` on `email_send_jobs` has a schema-cache fallback path
- `process-email-send-queue` worker gates and env controls:
  - `EMAIL_BATCH_DELAY_MS`
  - `EMAIL_SEND_CONCURRENCY`
  - `EMAIL_MESSAGE_STALE_MINUTES`
  - `RESEND_BATCH_SIZE`
  - `WORKER_ID`
  - `acquire_provider_send_slot`
  - mid-send intervention, reputation, domain-crisis, and batch-safety pause checks
- Worker code comments explicitly mark send reliability repair points:
  - `FIX: [GH2]`
  - `FIX: [GH3]`
  - `FIX: [GM3]`

### A8. Full source code inventory and annex

- Full source code annex is present in `docs/campaign-module-audit/source-bundle/`.
- The annex contains copied source for 302 files gathered during this audit.
- The annex includes the exact source bodies for campaign-relevant `src/`, `supabase/functions/`, and `supabase/migrations/` files.
- Key core files mirrored verbatim into the annex include:
  - `src/App.tsx`
  - `src/components/navigation/sidebarNavigation.ts`
  - `src/pages/crm/CRMCampaignsPage.tsx`
  - `src/pages/crm/CRMCampaignEditorPage.tsx`
  - `src/pages/crm/CRMCampaignRecipientsPage.tsx`
  - `src/pages/crm/CRMCampaignRecipientDetailPage.tsx`
  - `src/pages/crm/CRMCampaignReport.tsx`
  - `src/utils/crmCampaignService.ts`
  - `src/hooks/useCampaignEventRealtime.ts`
  - `src/lib/crm/campaignRecipientOperations.ts`
  - `src/lib/crm/emailTrackingRealtime.ts`
  - `supabase/functions/auto-send-campaigns/index.ts`
  - `supabase/functions/send-email-campaign/index.ts`
  - `supabase/functions/process-email-send-queue/index.ts`
  - `supabase/functions/force-send-campaign/index.ts`
  - `supabase/functions/resend-missed-recipients/index.ts`
  - `supabase/functions/process-email-webhook-deliveries/index.ts`
  - `supabase/functions/email-tracking-webhook/index.ts`
  - `supabase/functions/campaign-recipient-bulk-actions/index.ts`
  - `supabase/functions/campaign-recipient-export/index.ts`
  - `supabase/migrations/20260205090000_email_messages_and_claiming.sql`
  - `supabase/migrations/20260224173500_reputation_tier_enforcement_m6.sql`
  - `supabase/migrations/20260205135000_reschedule_auto_send_campaigns_every_minute.sql`
  - `supabase/migrations/20260103180906_343af155-00f0-43e3-ad9b-0365273baf80.sql`
  - `supabase/migrations/20260425041500_fix_cron_jobs_use_service_role_key.sql`
- No additional hidden API route layer or server action layer was found outside the sources already listed in this audit.

## PART B — CAMPAIGN UI & USER EXPERIENCE AUDIT

### B1. Route surfaces and entry points

- Campaign routes wired in `src/App.tsx`:
  - `/crm/campaigns`
  - `/crm/campaigns/new`
  - `/crm/campaigns/:campaignId`
  - `/crm/campaigns/:campaignId/analytics`
  - `/crm/campaigns/:campaignId/report`
  - `/crm/campaigns/:campaignId/recipients`
  - `/crm/campaigns/:campaignId/recipients/:recipientId`
  - `/dashboard/campaigns/:campaignId/recipients`
  - `/dashboard/campaigns/:campaignId/recipients/:recipientId`
  - `/crm/campaigns/blocks`
- Adjacent email-management pages that affect campaign send readiness or delivery settings:
  - `src/pages/crm/EmailSendingSettings.tsx`
  - `src/pages/admin/TenantEmailManagement.tsx`
  - `src/pages/EmailPreferences.tsx`
- Navigation entry point:
  - `src/components/navigation/sidebarNavigation.ts` registers the `Campaigns` item at `/crm/campaigns` and matches `/dashboard/campaigns`.
  - The same navigation surface places `Newsletter`, `SMS Campaigns`, and `Manage Domains` adjacent to campaign navigation.

### B2. Client pages, hooks, libraries, and utilities touching campaign email behavior

- Primary campaign pages:
  - `src/pages/crm/CRMCampaignsPage.tsx`
  - `src/pages/crm/CRMCampaignEditorPage.tsx`
  - `src/pages/crm/CRMCampaignRecipientsPage.tsx`
  - `src/pages/crm/CRMCampaignRecipientDetailPage.tsx`
  - `src/pages/crm/CRMCampaignReport.tsx`
  - `src/pages/CRMCampaignBuilderPage.tsx`
  - `src/pages/CRMCampaignCreatorPage.tsx`
- Email sending and admin support pages:
  - `src/pages/crm/EmailSendingSettings.tsx`
  - `src/pages/admin/TenantEmailManagement.tsx`
  - `src/pages/EmailPreferences.tsx`
- Hooks directly touching campaign send state, analytics, realtime, or governance visibility:
  - `src/hooks/useCampaigns.ts`
  - `src/hooks/useCampaignAnalytics.ts`
  - `src/hooks/useCampaignSending.ts`
  - `src/hooks/useCampaignEventRealtime.ts`
  - `src/hooks/useCampaignBounces.ts`
  - `src/hooks/useCampaignGovernanceVisibility.ts`
  - `src/hooks/useCampaignTemplates.ts`
  - `src/hooks/useCampaignCloning.ts`
  - `src/hooks/useCampaignAutoSave.ts`
  - `src/hooks/useCampaignBlockAutosave.ts`
  - `src/hooks/useEmailCampaignSummary.ts`
  - `src/hooks/useCRMCampaignPerformance.ts`
  - `src/hooks/crm/useOverdueCampaigns.ts`
  - `src/hooks/crm/useForceSendCampaign.ts`
  - `src/hooks/analytics/useCampaignDerivedMetrics.ts`
  - `src/hooks/analytics/useCampaignDeliveryMetrics.ts`
- Campaign/email libraries and utilities:
  - `src/utils/crmCampaignService.ts`
  - `src/utils/campaignSendingErrors.ts`
  - `src/utils/campaignCleanup.ts`
  - `src/utils/campaignTitleUtils.ts`
  - `src/utils/campaignSlugUtils.ts`
  - `src/lib/crm/campaignEditor.ts`
  - `src/lib/crm/campaignRecipientOperations.ts`
  - `src/lib/crm/emailTrackingRealtime.ts`
  - `src/lib/crm/emailConsent.ts`
  - `src/lib/campaignTemplates.ts`
  - `src/lib/compliance/EmailConsentChecker.ts`
  - `src/lib/sendTestEmail.ts`
  - `src/lib/email/emailRetryService.ts`
  - `src/lib/email/emailCompletionService.ts`
  - `src/utils/emailFooterRenderer.ts`
  - `src/utils/emailImageUrl.ts`
  - `src/utils/emailTokenProcessor.ts`

### B3. Client components and UI surfaces touching campaigns or email delivery

- Editor, schedule, lock, and send confirmation surfaces:
  - `src/components/crm/campaign-editor/CampaignEditorHeader.tsx`
  - `src/components/crm/campaign-editor/CampaignEditorContext.tsx`
  - `src/components/crm/campaign-editor/CampaignLockedView.tsx`
  - `src/components/crm/campaign-editor/CampaignPreviewDialog.tsx`
  - `src/components/crm/campaign-editor/CampaignScheduleDrawer.tsx`
  - `src/components/crm/campaign-editor/CampaignSendConfirmation.tsx`
  - `src/components/crm/campaigns/CampaignSendConfirmationModal.tsx`
- Campaign composer and builder surfaces:
  - `src/components/crm/CRMCampaignBuilder.tsx`
  - `src/components/crm/CampaignCreatorLayout.tsx`
  - `src/components/crm/campaign-composer/EmailCampaignComposer.tsx`
  - `src/components/crm/campaign-composer/CampaignPreview.tsx`
  - `src/components/crm/campaign-composer/TestEmailModal.tsx`
  - `src/components/crm/EmailComposer.tsx`
  - `src/components/crm/CRMSimpleEmailBuilder.tsx`
  - `src/components/crm/EmailBlockRenderer.tsx`
  - `src/components/crm/EmailBlockEditor.tsx`
  - `src/components/crm/CleanEmailBlockEditor.tsx`
  - `src/components/crm/blocks/EmailSafeHeroBlockEditor.tsx`
  - `src/components/crm/click-to-edit/ClickToEditEmailBuilder.tsx`
  - `src/components/crm/EmailBuilderModeSelector.tsx`
- Campaign analytics, performance, and delivery surfaces:
  - `src/components/analytics/CampaignAnalytics.tsx`
  - `src/components/analytics/CampaignDerivedMetrics.tsx`
  - `src/components/analytics/CampaignDeliveryBreakdown.tsx`
  - `src/components/analytics/EmailCampaignSection.tsx`
  - `src/components/analytics/EmailCampaignPerformance.tsx`
  - `src/components/crm/CampaignAnalyticsDashboard.tsx`
  - `src/components/crm/CampaignActionBar.tsx`
  - `src/components/crm/CampaignPerformanceCard.tsx`
  - `src/components/crm/CampaignGovernanceMetricsCard.tsx`
  - `src/components/crm/CampaignReadiness.tsx`
  - `src/components/crm/CampaignHistoryView.tsx`
  - `src/components/crm/CampaignClickStats.tsx`
  - `src/components/crm/CampaignDeliverabilityStats.tsx`
  - `src/components/crm/CampaignDeliveryStatusCard.tsx`
  - `src/components/crm/campaigns/CampaignDeliverySummary.tsx`
  - `src/components/crm/campaigns/CampaignEngagementMetrics.tsx`
  - `src/components/crm/campaigns/CampaignMetricsColumns.tsx`
  - `src/components/crm/campaigns/CRMCampaignPerformance.tsx`
- Campaign operations and governance surfaces:
  - `src/components/crm/CampaignConsentWarning.tsx`
  - `src/components/crm/ScheduledCampaignBanner.tsx`
  - `src/components/crm/ScheduledCampaignActions.tsx`
  - `src/components/crm/OverdueCampaignsBanner.tsx`
  - `src/components/crm/CampaignTemplatesModal.tsx`
  - `src/components/crm/SmartCampaignSelector.tsx`
  - `src/components/crm/SmartCampaignEnhancements.tsx`
  - `src/components/crm/CampaignAutomationSettings.tsx`
  - `src/components/crm/BouncedEmailsList.tsx`
  - `src/components/crm/EmailConsentManager.tsx`
  - `src/components/crm/FullEmailPreview.tsx`
  - `src/components/crm/EmailPreviewWithCustomer.tsx`
- Settings and domain health surfaces that affect send ability:
  - `src/components/crm/settings/EmailDomainManagement.tsx`
  - `src/components/crm/settings/EmailDomainGuide.tsx`
  - `src/components/crm/settings/TenantEmailHealthDashboardCard.tsx`
  - `src/components/domains/EmailDomainsList.tsx`
  - `src/components/domains/EmailDomainDetails.tsx`
  - `src/components/domains/EmailSendersTab.tsx`
  - `src/components/crm/email/EmailSendingHelpPanel.tsx`
  - `src/components/crm/EmailHealthScore.tsx`
- Campaign-adjacent calendar, dashboard, homepage, and admin surfaces that create, list, or surface campaigns:
  - `src/components/calendar/BackfillCampaigns.tsx`
  - `src/components/calendar/CalendarCampaignList.tsx`
  - `src/components/calendar/CampaignTemplateManager.tsx`
  - `src/components/calendar/CampaignContentSection.tsx`
  - `src/components/calendar/CampaignDetailsModal.tsx`
  - `src/components/calendar/CalendarCampaignCreateDialog.tsx`
  - `src/components/calendar/CampaignOverviewDialog.tsx`
  - `src/components/calendar/CampaignItem.tsx`
  - `src/components/dashboard/CampaignCard.tsx`
  - `src/components/dashboard/CustomCampaignsSection.tsx`
  - `src/components/dashboard/WeekCampaignCard.tsx`
  - `src/components/dashboard/CurrentCampaignSection.tsx`
  - `src/components/dashboard/current-campaign/CurrentCampaignSection.tsx`
  - `src/components/dashboard/current-campaign/AutoCampaignCreator.tsx`
  - `src/components/dashboard/current-campaign/CampaignContent.tsx`
  - `src/components/dashboard/current-campaign/CampaignContentList.tsx`
  - `src/components/dashboard/current-campaign/CampaignLoadingState.tsx`
  - `src/components/dashboard/current-campaign/NoCampaignState.tsx`
  - `src/components/dashboard/current-campaign/NoCampaignStateCard.tsx`
  - `src/components/dashboard/current-campaign/useCurrentCampaignSection.ts`
  - `src/components/homepage/CampaignCard.tsx`
  - `src/components/homepage/EnhancedCampaignCard.tsx`
  - `src/components/homepage/NewCampaignCard.tsx`
  - `src/components/homepage/NewCampaignDialog.tsx`
  - `src/components/homepage/NewCampaignModal.tsx`
  - `src/components/homepage/WeekCampaignCard.tsx`
  - `src/components/homepage/CampaignAutoManager.ts`
  - `src/components/admin/CampaignCleanupButton.tsx`

### B4. Data loading, realtime subscriptions, manual refresh paths, and mutation flow

- `CRMCampaignRecipientsPage` keeps a local `pendingRealtimeCount`, row-level realtime overrides, and a `handleRefresh` callback that clears pending count and reloads page data.
- `useCampaignEventRealtime` uses a Supabase `RealtimeChannel` and returns `isLive` plus `bannerState`.
- `CRMCampaignRecipientsPage` subscribes via `useCampaignEventRealtime({ onEvent: handleRealtimeEvent })`.
- Realtime updates do not fully replace manual refresh. The page increments `pendingRealtimeCount` and shows a refresh banner instead of immediately reconciling all derived page state.
- `crmCampaignService` is the primary client mutation layer for create, send, schedule, reschedule, and unschedule flows:
  - claim via RPC
  - invoke `send-email-campaign`
  - update failure state on edge send errors
  - schedule or reschedule through RPCs or direct updates
  - emit success and failure toasts
- Auto-save and block-save behaviors are split across:
  - `src/hooks/useCampaignAutoSave.ts`
  - `src/hooks/useCampaignBlockAutosave.ts`
  - `src/lib/crm/campaignEditor.ts`

### B5. User-visible copy, statuses, badges, and error messaging

- `CRMCampaignEditorPage` user-visible campaign state text:
  - `queued`, `partially_queued`, and `sending` all render the same `"Sending..."` headline.
  - The same surface shows `"Sending to ~{N} recipients"`.
  - Scheduled campaigns show `"Scheduled for ..."`.
  - Paused campaigns show `"Campaign is paused."`.
  - Failed campaigns show `"This campaign failed before it could complete."`.
- `CRMCampaignRecipientsPage` user-visible state text:
  - realtime badge toggles between `"Live"` and `"Realtime paused"`
  - action button text includes `"Refresh data"`
  - pending updates banner text is `"N new event(s) - refresh view"`
  - retry actions surface `"Retry queued"` and `"Recipient retry updated"`
- `crmCampaignService` user-facing toasts and guard messages:
  - `"Failed to send campaign: ..."`
  - `"Campaign \"...\" scheduled successfully!"`
  - `"Schedule updated successfully"`
  - `"This campaign is locked (already sending or sent)."`
  - `"Cannot reschedule a campaign that is currently sending"`
  - `"Cannot unschedule a campaign that has already been sent"`
  - `"Please sign in again to schedule this campaign."`
  - `"You don't have access to schedule this campaign."`

### B6. Permissions, visibility gates, and UI-level access rules

- `CRMCampaignRecipientsPage` sets `canShowRecipients = ["sent", "sending", "sent_with_errors"].includes(status)`.
- Because of that gate, queued and paused campaigns do not expose the recipient ledger page contents even if queue data already exists.
- `CampaignLockedView`, schedule guards, and force-send hooks enforce UI-level lock behaviors alongside RPC-level lock semantics.
- Tenant-scoped RLS policies govern visibility of campaigns, email messages, jobs, tracked links, skipped sends, hygiene reports, and tracking events.
- `CampaignConsentWarning`, domain-management components, health dashboard components, and governance visibility hooks all participate in whether the UI proceeds or what it shows about send readiness.
- API-route-level permission wrappers for campaign sending: Not Found.
- Server-action-level permission wrappers for campaign sending: Not Found.

### B7. Observed UX state model for `sending`, `queued`, `paused`, and `stuck` behavior

- The editor UI compresses `queued`, `partially_queued`, and `sending` into one generic `"Sending..."` state.
- The recipient ledger is only exposed after the campaign reaches one of `sent`, `sending`, or `sent_with_errors`.
- Realtime is partial and banner-driven. New events can accumulate behind a refresh banner until the user manually refreshes the page state.
- Client send success is coupled to queueing success. `crmCampaignService` invokes `send-email-campaign`, which returns `mode: "queued"`, not provider delivery success.
- `crmCampaignService` still emits a sent-style success toast based on `sendResult?.metrics?.sent`, while `send-email-campaign` returns queue counts such as `total_recipients` and `total_batches`.
- `send-email-campaign` sets `crm_campaigns.sent_at` while queueing, before the worker finishes actual provider delivery.
- The overall UI model surfaces campaign creation, scheduling, queueing, sending, recipient drill-down, analytics, and retries, but queue state and provider delivery state are not represented as separate user-visible phases.

## PART C — CRITICAL FLAGS

### C1. Queue success and delivery success are different states

- `send-email-campaign` is a queue-builder that returns `mode: 'queued'` and `"Campaign queued for sending to N recipients"`.
- `auto-send-campaigns` treats that result as success and updates `crm_campaigns.status = 'queued'`.
- `process-email-send-queue` is the only verified component in the core path that actually sends to Resend and then marks the campaign `sent` or `sent_with_errors`.

### C2. `crm_campaigns.sent_at` is stamped during queue creation, not provider completion

- `send-email-campaign` updates the campaign record to `status: 'queued'` and also sets `sent_at: new Date().toISOString()`.
- `process-email-send-queue` later performs the actual provider send and then does durable sent/failed recounts.
- A campaign can therefore have `sent_at` populated before provider delivery completes.

### C3. Client success messaging is built on queueing, not confirmed delivery

- `src/utils/crmCampaignService.ts` immediate-send flow claims the campaign and invokes `send-email-campaign`.
- `send-email-campaign` returns queue-oriented data: `mode`, `campaign_id`, `total_recipients`, `total_batches`, `message`, reputation info, hygiene info, and compliance info.
- `crmCampaignService` still emits a sent-style success toast and reads `sendResult?.metrics?.sent`, which is not the primary return shape of the queue-builder response.

### C4. Recipient visibility is gated away from queued and paused campaigns

- `CRMCampaignRecipientsPage` only shows recipients for `sent`, `sending`, and `sent_with_errors`.
- A campaign that is already queued, partially queued, or paused can have backend work in progress or stalled queue rows while the primary recipient ledger remains hidden behind the UI gate.

### C5. Realtime campaign event updates are not fully in-place

- The recipients page increments `pendingRealtimeCount` when realtime events arrive.
- The page exposes `"N new event(s) - refresh view"` and a `"Refresh data"` button.
- Campaign activity can therefore be known to the client while the visible table remains stale until manual refresh.

### C6. Cron integrity is a hard dependency for campaign progress

- `auto-send-campaigns` and `process-email-send-queue` are both cron-driven.
- `supabase/migrations/20260425041500_fix_cron_jobs_use_service_role_key.sql` explicitly documents a past broken-auth condition that stalled scheduled campaign sending and names a campaign stuck for 7 days.
- Any cron auth or scheduling break impacts both queue creation and queue draining.

### C7. The worker can auto-finalize `sending` campaigns from queue state

- `process-email-send-queue` scans for campaigns in `sending` older than 10 minutes whose jobs are all done.
- It auto-finalizes them to `sent` or `sent_with_errors` based on durable sent/failed recounts.
- The same file also finalizes normal completion using sent/failed recounts and writes `send_blocked_reason` when recipients fail after max attempts.

### C8. Mid-send pause and intervention paths exist throughout the worker

- `process-email-send-queue` can pause campaigns or jobs based on intervention state, reputation policy, domain crisis state, and batch-safety checks.
- `send-email-campaign` can also system-pause a campaign before or during queue creation.
- The runtime model includes real pause states and not only success or failure states.

### C9. Large sends degrade through chunk reduction and per-run limits

- `send-email-campaign` reduces DB insert chunk size from 200 down to 25 on timeout.
- `process-email-send-queue` processes only 10 jobs per invocation and preserves a 10-second timeout buffer.
- Under large sends or repeated timeouts, campaign progress is intentionally incremental across repeated cron invocations.

### C10. Live schema and repo code disagree on allowed campaign statuses

- The live Supabase MCP snapshot for `public.crm_campaigns` reports this status check:
  - `status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sending'::text, 'paused'::text, 'sent'::text, 'failed'::text])`
- Repo migration `supabase/migrations/20260224173500_reputation_tier_enforcement_m6.sql` expands the status constraint to:
  - `draft`
  - `scheduled`
  - `queued`
  - `partially_queued`
  - `sending`
  - `paused`
  - `sent`
  - `sent_with_errors`
  - `failed`
- Runtime code in `send-email-campaign`, `process-email-send-queue`, `auto-send-campaigns`, `CRMCampaignEditorPage`, `CRMCampaignRecipientsPage`, and multiple governance and recipient migrations uses `queued`, `partially_queued`, and `sent_with_errors`.
- This is a verified schema-vs-code discrepancy.

### C11. The raw source annex is the authoritative code appendix for this audit

- The findings above are paired with `docs/campaign-module-audit/source-bundle/`.
- That annex contains the actual code bodies for the campaign-related source, edge functions, and migrations inspected during this audit.
- No additional hidden backend layer, API route layer, or server action layer was found outside the listed sources.