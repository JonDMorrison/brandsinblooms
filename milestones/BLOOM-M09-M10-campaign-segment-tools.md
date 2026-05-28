# BLOOM-M09: Campaign Tools

> **Copilot Thinking Effort:** XHigh
> **Branch:** `feature/bloom-assist`
> **Phase:** 2 — Query & Mutation System
> **Milestone:** 9 of 40

---

## Objective

Implement all campaign-related tools: create, update, clone, schedule, send, pause/resume campaigns, and get campaign analytics. These tools must call the exact same underlying services the CRM UI uses — `campaignDraftPersistence.ts` for creates/updates, `campaignEditor.ts` for segment/persona/block sync, `crmCampaignService.ts` for send lifecycle, and the campaign analytics RPCs for metrics.

---

## Scope

### Tool Implementations in `supabase/functions/bloom-assist/tools/implementations/`

**`campaign-tools.ts`** — Implements:

- **`create_campaign`**: Calls the equivalent of `persistCampaignRecord()` from `campaignDraftPersistence.ts`. Stamps `tenant_id`, `user_id`. Creates `crm_campaigns` row + `campaign_segments` + `campaign_personas` if audience specified. Returns `confirmation_required` with task plan showing what will be created.

- **`update_campaign`**: Calls the equivalent of `campaignEditor.ts` update patterns. Syncs `campaign_segments` and `campaign_personas`. Returns task plan for approval.

- **`clone_campaign`**: Follows `useCampaignCloning` pattern — copies `crm_campaigns`, `campaign_blocks`, `campaign_segments`. Returns new campaign ID.

- **`schedule_campaign`**: Calls `set_campaign_schedule` RPC via `crmCampaignService.ts` pattern. Validates date is in the future. Returns confirmation with scheduled time.

- **`send_campaign`**: Calls `send-email-campaign` Edge Function via `supabase.functions.invoke()`. Requires high-risk confirmation gate. Shows audience size, subject line, sender info in task plan.

- **`pause_resume_campaign`**: Calls `pause_email_campaign_sending` or `resume_email_campaign_sending` RPCs. Medium-risk confirmation.

- **`get_campaign_analytics`**: Calls `recompute_campaign_metrics` RPC + reads `crm_campaigns.metrics` JSONB. Returns metrics with `block_type: "stat_card"` for single metrics or `"chart"` for time-series. Follows `useCampaignAnalytics` and `useCampaignDerivedMetrics` patterns.

- **`generate_campaign_content`**: Calls existing `generate-email-content`, `generate-subject-lines`, `generate-sms` Edge Functions. Passes tenant context, store profile, persona info. Returns generated content for review.

---

## Acceptance Criteria

- [ ] All campaign tools execute against real CRM tables following existing service patterns
- [ ] Create/update campaigns stamp `tenant_id` and `user_id` correctly
- [ ] Campaign audience (segments, personas) synced via junction tables
- [ ] Send campaign goes through proper claim → validate → queue → send pipeline
- [ ] Analytics reads from `crm_campaigns.metrics` and returns correct block types
- [ ] Content generation calls existing Edge Functions (not reimplementing)
- [ ] All mutation tools return `confirmation_required` with task plan details
- [ ] Risk levels: create=low, update=medium, send=high, delete=high

---

## What NOT To Do

- Do NOT reimagine the campaign send pipeline — follow `crmCampaignService.ts` exactly
- Do NOT write raw queries for campaign metrics — use `recompute_campaign_metrics` RPC
- Do NOT skip the confirmation gate for any mutation
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M10: Segment, Persona & Tag Tools

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 2 — Query & Mutation System
> **Milestone:** 10 of 40

---

## Objective

Implement tools for managing segments, personas, tags, and audience sizing. These are the audience-building tools that power targeted campaigns. Every tool follows the existing hooks: `useCreateSegment`, `useUpdateSegment`, `useSegmentMembers`, `useCustomerSegments`, `useCRMPersonas`, `useCRMTags`, and `computeAudienceRecipientCount.ts`.

---

## Scope

### Tool Implementations

**`segment-tools.ts`**:
- `create_segment` → follows `useCreateSegment` — creates in `crm_segments` with type (dynamic/static), rules, name. Stamps `tenant_id`.
- `update_segment` → follows `useUpdateSegment` — updates rules, name, status.
- `get_segment_members` → follows `useSegmentMembers` — paginated member list via `customer_segments` → `crm_customers`.
- `assign_segment` → follows `useCustomerSegments` — add/remove customers from static segments. Auto-updates `crm_segments.customer_count`.
- `compute_audience_size` → follows `computeAudienceRecipientCount.ts` — preview audience count for segment/persona combinations before campaign creation.

**`persona-tools.ts`**:
- `query_personas` → reads `crm_personas` scoped by `tenant_id`.

**`tag-tools.ts`**:
- `query_tags` → reads `crm_tags` scoped by `tenant_id`.
- `create_tag` → inserts into `crm_tags`.
- `bulk_tag_customers` → manages `customer_tags` junction — assign or remove tags from multiple customers. Returns confirmation with affected count.
- `manage_consent` → follows `emailConsent.ts` / `smsConsent.ts` patterns — toggles email/SMS opt-in with consent event recording in `crm_email_consent_events` / `crm_sms_consent_events`.

---

## Acceptance Criteria

- [ ] Segment CRUD follows existing hook patterns exactly
- [ ] `customer_count` auto-updates on segment membership changes
- [ ] Audience size computation matches `computeAudienceRecipientCount.ts`
- [ ] Tag operations use `crm_tags` + `customer_tags` junction pattern
- [ ] Consent management records events in consent event tables
- [ ] All tools scoped by `tenant_id`
- [ ] Bulk tag operations show confirmation with affected count

---

## What NOT To Do

- Do NOT create new persona CRUD — personas are managed through the CRM UI, Bloom only queries them
- Do NOT skip consent event recording when toggling opt-in/opt-out
- Do NOT use `site_id`
- Do NOT generate test files or documentation
