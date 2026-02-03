

# Enhanced Email Analytics Reporting

## Overview

This plan adds comprehensive email campaign analytics to the Business Analytics page, including:
1. **Accurate Send Reporting** - Pulls actual delivery counts from `email_send_jobs` instead of stale cached values
2. **Delivery Breakdown** - Shows sent, skipped, and failed counts with reasons
3. **List Health Integration** - Surfaces bounce/complaint rates alongside campaign metrics
4. **Recompute Functionality** - Adds ability to refresh stale metrics directly from the analytics page

## What You Experienced

The discrepancy where your "Bloomin' Easy partnership" campaign showed "200 sent" but actually delivered to ~419 recipients is due to:
- The `total_sent` field in `crm_campaigns` being cached/stale
- The actual data lives in `email_send_jobs` (batch records) and `email_send_log` (individual sends)

The new analytics will query both sources to show accurate, real-time numbers.

---

## Implementation Plan

### 1. Create Enhanced Campaign Metrics Hook

**New file: `src/hooks/analytics/useCampaignDeliveryMetrics.ts`**

This hook will:
- Query `email_send_jobs` to get actual batch totals (enqueued, sent, failed)
- Query `email_send_skips` to get skip counts by reason (opt_out, suppressed, invalid_email)
- Calculate accurate delivery vs. audience size
- Return both cached (`crm_campaigns.total_sent`) and computed values for comparison

```text
┌────────────────────────────────────────────┐
│           CAMPAIGN DELIVERY DATA           │
├────────────────────────────────────────────┤
│  Audience Size        │  610 contacts      │
│  Enqueued             │  423 recipients    │
│  Delivered            │  419 emails        │
│  Skipped              │  187 contacts      │
│  Failed               │    4 emails        │
├────────────────────────────────────────────┤
│  Skip Reasons:                             │
│    - Opted Out: 45                         │
│    - Suppressed: 98                        │
│    - Invalid Email: 44                     │
└────────────────────────────────────────────┘
```

### 2. Create Delivery Breakdown Component

**New file: `src/components/analytics/CampaignDeliveryBreakdown.tsx`**

A visual component showing:
- Funnel from audience to delivered
- Pie/donut chart of skip reasons
- Comparison between cached vs. computed totals (with warning if they differ)
- "Recompute Metrics" button for stale campaigns

### 3. Enhance EmailCampaignPerformance Component

**Modify: `src/components/analytics/EmailCampaignPerformance.tsx`**

Updates:
- Add a "Delivery Details" expandable row for each campaign
- Show accurate delivery counts from `email_send_jobs`
- Add "Skipped" column to the table
- Include a badge if metrics appear stale

### 4. Add List Health Summary Card

**Modify: `src/pages/AnalyticsPage.tsx`**

Add the existing `ListHealthCard` component to the analytics page, positioned alongside email campaign performance. This surfaces:
- 30-day bounce rate
- 30-day complaint rate
- Suppression breakdown
- Health status indicator (healthy/warning/critical)

### 5. Add Bulk Recompute Action

**Modify: `src/components/analytics/EmailCampaignPerformance.tsx`**

Add a "Recompute All Metrics" button in the header that:
- Calls `recompute-campaign-metrics` edge function for all sent campaigns
- Shows progress indicator
- Refreshes displayed data after completion

---

## Technical Details

### Database Queries

**Accurate Send Count Query:**
```sql
SELECT 
  SUM(emails_sent) as total_delivered,
  SUM(emails_failed) as total_failed,
  COUNT(*) as batch_count
FROM email_send_jobs 
WHERE campaign_id = $1 AND status = 'completed';
```

**Skip Breakdown Query:**
```sql
SELECT reason, COUNT(*) as count
FROM email_send_skips
WHERE campaign_id = $1
GROUP BY reason;
```

### Component Structure

```text
AnalyticsPage
├── ExecutiveDashboard (existing)
├── EmailCampaignPerformance (enhanced)
│   ├── Summary Stats
│   ├── Campaign Table
│   │   └── CampaignDeliveryBreakdown (expandable row)
│   └── Recompute All Button
├── ListHealthCard (add to page)
├── ChannelPerformance (existing)
└── ...
```

### Files to Create
- `src/hooks/analytics/useCampaignDeliveryMetrics.ts`
- `src/components/analytics/CampaignDeliveryBreakdown.tsx`

### Files to Modify
- `src/components/analytics/EmailCampaignPerformance.tsx`
- `src/pages/AnalyticsPage.tsx`

---

## Immediate Action: Fix the Stale Metrics

Once you approve this plan, I will also add a way for you to recompute the metrics for the "Bloomin' Easy partnership" campaign. You can do this immediately from the Admin > Analytics Health page (if you have access), or I can add a recompute button to the campaign detail page.

The recompute will:
1. Query `email_send_log` for actual unique recipient counts
2. Query `email_tracking_events` for opens/clicks
3. Recalculate rates
4. Update `crm_campaigns.total_sent`, `total_opens`, `total_clicks`, `open_rate`, `click_rate`

