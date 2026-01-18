# Automation System - Complete Technical Documentation & Issues

> **Document Version:** 1.0  
> **Last Updated:** January 18, 2026  
> **Status:** Active Investigation

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Database Tables](#3-database-tables)
4. [Edge Functions](#4-edge-functions)
5. [pg_cron Scheduled Jobs](#5-pg_cron-scheduled-jobs)
6. [Message Flow & Processing](#6-message-flow--processing)
7. [Current Issues](#7-current-issues)
8. [Bypass Techniques & Soft Failure Mode](#8-bypass-techniques--soft-failure-mode)
9. [Case Study: furqanhameedjutt.311@gmail.com](#9-case-study-furqanhameedjuttgmailcom)
10. [Troubleshooting Guide](#10-troubleshooting-guide)
11. [Recommendations](#11-recommendations)

---

## 1. System Overview

The automation system is a **multi-stage, event-driven architecture** designed to send personalized emails and SMS messages to customers based on triggers like segment membership, welcome flows, or purchase behavior.

### Key Components

| Component | Purpose |
|-----------|---------|
| **PostgreSQL Triggers** | Detect events (segment additions) and queue automation triggers |
| **pg_cron** | Schedule periodic execution of edge functions |
| **pg_net** | Make HTTP calls to edge functions from PostgreSQL |
| **Edge Functions** | Process queues, execute business logic, send messages |
| **Resend API** | Email delivery service |
| **Mobile Text Alerts (MTA)** | SMS delivery service (US/Canada only) |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUTOMATION SYSTEM FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────────────────────────────────────┐
│   USER ACTIONS   │     │              DATABASE LAYER                       │
│                  │     │                                                    │
│ • Add to Segment │────▶│  customer_segments (INSERT)                       │
│ • New Customer   │     │          │                                        │
│ • Manual Trigger │     │          ▼                                        │
└──────────────────┘     │  ┌─────────────────────────────┐                  │
                         │  │ trigger_segment_automation() │ ◄── PG Trigger  │
                         │  │      (PostgreSQL Function)   │                  │
                         │  └──────────────┬──────────────┘                  │
                         │                 │                                  │
                         │                 ▼                                  │
                         │  ┌─────────────────────────────┐                  │
                         │  │ automation_trigger_events   │ ◄── Event Queue  │
                         │  │ (queued triggers waiting)   │                  │
                         │  └──────────────┬──────────────┘                  │
                         └─────────────────┼──────────────────────────────────┘
                                           │
            ┌──────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                              pg_cron LAYER                                 │
│                                                                            │
│  ┌────────────────────────────┐    ┌────────────────────────────────────┐ │
│  │ process-automation-triggers│    │ process-automation-outbox          │ │
│  │ (Every 1 minute)           │    │ (Every 1 minute)                   │ │
│  │                            │    │                                    │ │
│  │ Calls: automation-executor │    │ Calls: process-automation-outbox   │ │
│  └─────────────┬──────────────┘    └──────────────┬─────────────────────┘ │
│                │                                   │                       │
└────────────────┼───────────────────────────────────┼───────────────────────┘
                 │                                   │
                 ▼                                   ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         EDGE FUNCTIONS LAYER                               │
│                                                                            │
│  ┌────────────────────────────┐    ┌────────────────────────────────────┐ │
│  │   automation-executor      │    │  process-automation-outbox         │ │
│  │                            │    │                                    │ │
│  │ 1. Read trigger events     │    │ 1. Lock queued messages            │ │
│  │ 2. Check active automations│    │ 2. Call send functions             │ │
│  │ 3. Handle overlap behavior │    │ 3. Update status                   │ │
│  │ 4. Create automation_runs  │    │ 4. Advance to next step            │ │
│  │ 5. Enqueue first step      │    │ 5. Handle soft failures            │ │
│  └─────────────┬──────────────┘    └──────────────┬─────────────────────┘ │
│                │                                   │                       │
│                ▼                                   ▼                       │
│  ┌────────────────────────────┐    ┌───────────────┬───────────────────┐ │
│  │       crm_outbox           │    │send-transactio│    send-sms       │ │
│  │   (Message Queue Table)    │◄───│nal-email      │    (MTA API)      │ │
│  │                            │    │(Resend API)   │                   │ │
│  └────────────────────────────┘    └───────────────┴───────────────────┘ │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                  │
│                                                                            │
│  ┌─────────────────────┐              ┌─────────────────────────────────┐ │
│  │     Resend API      │              │   Mobile Text Alerts (MTA)      │ │
│  │                     │              │                                 │ │
│  │ • Email delivery    │              │ • SMS delivery (US/Canada ONLY) │ │
│  │ • Custom domains    │              │ • International NOT supported   │ │
│  │ • Tracking webhooks │              │                                 │ │
│  └─────────────────────┘              └─────────────────────────────────┘ │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Tables

### 3.1 `crm_automations`

**Purpose:** Defines automation structure, triggers, and workflow steps.

```sql
CREATE TABLE public.crm_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id UUID,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- 'welcome', 'segment_joined', 'segment.added', etc.
  trigger_conditions JSONB DEFAULT '{}',
  workflow_steps JSONB DEFAULT '[]',  -- Array of email/sms steps with timing
  is_active BOOLEAN DEFAULT false,
  overlap_behavior TEXT DEFAULT 'ignore', -- 'ignore', 'restart', 'parallel', 'queue'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Key Fields:**
- `trigger_type`: What triggers the automation (e.g., `segment.added`, `welcome`)
- `trigger_conditions`: JSON with conditions like `{"segment_id": "uuid"}`
- `workflow_steps`: Array of steps with timing and content
- `overlap_behavior`: How to handle when customer is already in the automation

### 3.2 `automation_trigger_events`

**Purpose:** Queue for incoming trigger events before processing.

```sql
CREATE TABLE public.automation_trigger_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES crm_automations(id),
  customer_id UUID REFERENCES crm_customers(id),
  segment_id UUID REFERENCES crm_segments(id),
  persona_id UUID REFERENCES personas(id),
  tenant_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ,
  queued_until TIMESTAMPTZ,  -- For delayed processing
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Fields:**
- `processed_at`: When the event was processed (NULL = pending)
- `queued_until`: Delay processing until this time
- `error_message`: If processing failed

### 3.3 `automation_runs`

**Purpose:** Tracks the execution state of an automation for a specific customer.

```sql
CREATE TABLE public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES crm_automations(id),
  customer_id UUID NOT NULL REFERENCES crm_customers(id),
  tenant_id UUID NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled', 'failed'
  current_step_index INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  run_sequence INTEGER DEFAULT 1,  -- For parallel runs
  next_step_scheduled_at TIMESTAMPTZ,
  trigger_data JSONB,
  channel_availability JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Key Fields:**
- `status`: Current state of the automation run
- `current_step_index`: Which step is being executed
- `run_sequence`: Allows tracking parallel runs for the same customer
- `next_step_scheduled_at`: When the next step should execute

### 3.4 `crm_outbox`

**Purpose:** The primary message delivery queue. Every step creates an entry here.

```sql
CREATE TABLE public.crm_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  automation_id UUID,
  automation_run_id UUID,
  customer_id UUID NOT NULL,
  message_type TEXT NOT NULL, -- 'sms' or 'email'
  recipient TEXT NOT NULL,    -- Phone or email address
  content TEXT NOT NULL,
  subject TEXT,               -- For emails only
  template_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'queued', -- 'queued', 'processing', 'sent', 'failed', 'retrying', 'skipped'
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  skip_reason TEXT,
  skipped_at TIMESTAMPTZ,
  step_index INTEGER,
  priority INTEGER DEFAULT 100,
  locked_by TEXT,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Key Fields:**
- `status`: Current delivery state
- `scheduled_at`: When the message should be sent (enables delays)
- `locked_by` / `locked_until`: Prevents concurrent processing
- `skip_reason`: Why message was skipped (for debugging)

### 3.5 `crm_automation_logs`

**Purpose:** Historical tracking of all automation step executions.

```sql
CREATE TABLE public.crm_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  step_index INTEGER NOT NULL,
  message_type TEXT NOT NULL, -- 'email' or 'sms'
  status TEXT NOT NULL, -- 'queued', 'sent', 'failed', 'soft_failed', 'skipped'
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  skip_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(automation_id, customer_id, step_index)
);
```

---

## 4. Edge Functions

### 4.1 `automation-executor`

**Purpose:** The core automation engine that identifies eligible customers and enqueues automation steps.

**Location:** `supabase/functions/automation-executor/index.ts`

**Triggered By:** pg_cron every minute (`process-automation-triggers` job)

**Responsibilities:**
1. Fetch all active automations from `crm_automations`
2. Process pending events from `automation_trigger_events`
3. Handle overlap behavior (ignore, restart, parallel, queue)
4. Create `automation_runs` records
5. Enqueue the first step into `crm_outbox`

**Key Logic - Overlap Behavior:**

```typescript
switch (overlapBehavior) {
  case 'ignore':
    // Skip - customer already has active run
    continue;
    
  case 'restart':
    // Cancel existing run, start fresh
    await supabase.from('automation_runs')
      .update({ status: 'cancelled' })
      .eq('id', existingRun.id);
    break;
    
  case 'parallel':
    // Allow multiple concurrent runs
    nextRunSequence = (maxSeqData?.run_sequence || 0) + 1;
    break;
    
  case 'queue':
    // Not supported for batch - skip
    continue;
}
```

### 4.2 `process-automation-outbox`

**Purpose:** Worker that processes the message queue and sends emails/SMS.

**Location:** `supabase/functions/process-automation-outbox/index.ts`

**Triggered By:** pg_cron every minute

**Responsibilities:**
1. Lock and fetch queued messages from `crm_outbox`
2. Check if `scheduled_at` has passed
3. Call appropriate send function (`send-transactional-email` or `send-sms`)
4. Update message status based on result
5. Handle retries (up to `max_retries`)
6. Advance automation to next step via `advanceAutomationRun()`
7. Implement **Soft Failure Mode** to continue on failures

**Key Configuration:**

```typescript
const BATCH_SIZE = 50;
const SOFT_FAILURE_MODE = true;  // When true, failed steps don't block automation
```

### 4.3 `send-transactional-email`

**Purpose:** Sends emails via the Resend API.

**Location:** `supabase/functions/send-transactional-email/index.ts`

**Integration:** Resend API

**Key Features:**
- Custom domain support
- Reply-to configuration
- Email tagging for tracking

```typescript
const emailPayload = {
  from: fromAddress,          // e.g., "hello@dwn2earth.com"
  to: Array.isArray(to) ? to : [to],
  subject: subject || "Message from automation",
  html: html_content,
  reply_to: reply_to,
  tags: tags
};

const response = await resend.emails.send(emailPayload);
```

### 4.4 `send-sms`

**Purpose:** Sends SMS messages via Mobile Text Alerts (MTA) API.

**Location:** `supabase/functions/send-sms/index.ts`

**Integration:** Mobile Text Alerts API

**⚠️ CRITICAL LIMITATION: US/Canada Numbers Only**

```typescript
// Check for unsupported international numbers
const digits = to.replace(/\D/g, '');
const isUSCanada = digits.length === 10 || 
                   (digits.length === 11 && digits.startsWith('1'));

if (!isUSCanada) {
  return new Response(
    JSON.stringify({ 
      error: 'UNSUPPORTED_REGION',
      skipable: true,  // ← Allows automation to continue
      message: 'SMS only available for US/Canada numbers.',
      canRetry: false
    }), 
    { status: 200 }  // ← Returns 200 so automation isn't blocked
  );
}
```

---

## 5. pg_cron Scheduled Jobs

The system uses PostgreSQL's `pg_cron` extension with `pg_net` to schedule HTTP calls to edge functions.

### Active Cron Jobs (as of January 2026)

| Job Name | Schedule | Edge Function | Purpose |
|----------|----------|---------------|---------|
| `process-automation-triggers` | `* * * * *` (every minute) | `automation-executor` | Process trigger events and start automation runs |
| `process-automation-outbox` | `* * * * *` (every minute) | `process-automation-outbox` | Send queued messages |
| `process-email-send-queue` | `* * * * *` (every minute) | `process-email-send-queue` | Process general email queue |
| `auto-generate-weekly-campaigns` | `0 16 * * 1` (Mon 4pm) | `auto-generate-weekly-campaigns` | Generate weekly marketing campaigns |
| `auto-send-campaigns` | `0 * * * *` (every hour) | `auto-send-campaigns` | Send scheduled campaigns |
| `domain-verify-cron-2m` | `*/2 * * * *` (every 2 min) | `domain-verify-cron` | Verify custom email domains |
| `nightly-suppression-checker` | `0 3 * * *` (3am daily) | `suppression-checker` | Check email suppressions |
| `insights-worker-scheduler` | `0 2 * * *` (2am daily) | `insights-worker` | Generate analytics insights |

### Cron Job Configuration Example

```sql
SELECT cron.schedule(
  'process-automation-outbox',
  '* * * * *',  -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/process-automation-outbox',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

## 6. Message Flow & Processing

### Complete Flow Diagram

```
1. TRIGGER EVENT
   │
   ├── Customer added to segment
   │   └── PostgreSQL Trigger: trigger_segment_automation()
   │       └── INSERT INTO automation_trigger_events
   │
   ├── Manual trigger from UI
   │   └── Direct API call to automation-executor
   │
   └── Welcome/Purchase triggers
       └── Detected by automation-executor scan

2. EXECUTOR PHASE (automation-executor)
   │
   ├── Query automation_trigger_events WHERE processed_at IS NULL
   ├── For each event:
   │   ├── Find matching automation
   │   ├── Check overlap behavior
   │   ├── Create automation_runs record
   │   ├── Calculate first step timing
   │   └── INSERT INTO crm_outbox (status='queued', scheduled_at=...)
   └── Mark event as processed

3. OUTBOX PROCESSING (process-automation-outbox)
   │
   ├── Query crm_outbox WHERE status IN ('queued', 'retrying')
   │                    AND scheduled_at <= NOW()
   ├── Lock messages (set locked_by, locked_until)
   ├── For each message:
   │   ├── If message_type = 'email':
   │   │   └── Call send-transactional-email
   │   ├── If message_type = 'sms':
   │   │   └── Call send-sms
   │   │
   │   ├── On SUCCESS:
   │   │   ├── Update status = 'sent'
   │   │   ├── Update sent_at
   │   │   └── Call advanceAutomationRun()
   │   │
   │   ├── On FAILURE (retry < max):
   │   │   └── Update status = 'retrying', retry_count++
   │   │
   │   └── On FAILURE (retry >= max):
   │       ├── If SOFT_FAILURE_MODE:
   │       │   ├── Log as 'soft_failed'
   │       │   └── Call advanceAutomationRun() ← Continue anyway!
   │       └── Else:
   │           └── Update status = 'failed'

4. STEP ADVANCEMENT (advanceAutomationRun)
   │
   ├── Get current automation_run
   ├── Increment current_step_index
   ├── If more steps remain:
   │   ├── Calculate next step timing
   │   ├── INSERT INTO crm_outbox (next step)
   │   └── Update automation_runs.next_step_scheduled_at
   └── If no more steps:
       └── Update automation_runs.status = 'completed'
```

### Timing Calculation

Delays between steps are specified in the `workflow_steps` JSON:

```json
{
  "workflow_steps": [
    {
      "type": "email",
      "delay": { "value": 0, "unit": "immediately" },
      "subject": "Welcome!",
      "content": "..."
    },
    {
      "type": "sms",
      "delay": { "value": 2, "unit": "days" },
      "content": "..."
    },
    {
      "type": "email",
      "delay": { "value": 7, "unit": "days" },
      "subject": "Check in",
      "content": "..."
    }
  ]
}
```

---

## 7. Current Issues

### Issue 1: Emails Not Being Sent Despite Being Queued

**Status:** 🔴 Active Issue

**Symptoms:**
- Messages appear in `crm_outbox` with `status = 'queued'`
- `scheduled_at` is in the future (e.g., 2 days from now)
- `process-automation-outbox` logs show "No tenants with queued messages"

**Root Cause:**
The `scheduled_at` field controls when messages are eligible for sending. Messages with a future `scheduled_at` won't be processed until that time arrives.

**Example from Case Study:**
```
Message ID: d33309c7-b485-4174-8f0b-f8f81f7de90f
Created:    2026-01-18 15:06:02
Scheduled:  2026-01-20 15:06:02  ← 2 days in the future!
Status:     queued
```

**Why This Happens:**
1. The step delay was configured as "2 days" in the automation workflow
2. The first step was also given a delay (not immediate)
3. The `scheduled_at` is calculated as `created_at + delay`

**Resolution Options:**
1. Modify the automation workflow to use "immediately" for the first step
2. Manually update `scheduled_at` to a past time for testing
3. Wait for the scheduled time

---

### Issue 2: SMS Failures for International Numbers

**Status:** 🔴 Known Limitation

**Symptoms:**
- SMS messages fail with `error: 'UNSUPPORTED_REGION'`
- International numbers (e.g., Pakistan +92) are rejected
- Error message: "SMS sending is only available for US/Canada numbers"

**Root Cause:**
Mobile Text Alerts (MTA) API only supports US and Canada phone numbers. The system now detects international numbers and returns a skipable response instead of crashing.

**Detection Logic:**
```typescript
const digits = to.replace(/\D/g, '');
const isUSCanada = digits.length === 10 || 
                   (digits.length === 11 && digits.startsWith('1'));
```

**Impact:**
- SMS steps for international customers will be skipped
- Automation continues to next step (if Soft Failure Mode is enabled)
- Customer still receives email steps

**Example Error:**
```json
{
  "error": "UNSUPPORTED_REGION",
  "skipable": true,
  "message": "This phone number is in an unsupported region.",
  "canRetry": false
}
```

---

### Issue 3: Duplicate Automation Runs

**Status:** 🟡 Partially Resolved

**Symptoms:**
- Customer receives multiple copies of the same automation
- Multiple active `automation_runs` for the same customer/automation

**Root Cause:**
- Segment membership changes can trigger multiple events
- Before the `overlap_behavior` feature, all triggers created new runs

**Resolution:**
The `overlap_behavior` column was added with options:
- `ignore` (default): Skip if customer already has active run
- `restart`: Cancel existing and start fresh
- `parallel`: Allow multiple concurrent runs
- `queue`: Wait for current to finish (not yet implemented)

---

### Issue 4: Edge Function Invocation Failures

**Status:** 🟡 Intermittent

**Symptoms:**
- Logs show "Edge Function error" for SMS/Email
- Messages stuck in 'retrying' status
- Error message contains function invocation details

**Potential Causes:**
1. Edge function cold start timeout
2. Supabase rate limiting
3. External API (Resend/MTA) failures
4. Invalid secrets/API keys

**Diagnostic Steps:**
1. Check edge function logs in Supabase dashboard
2. Verify API keys are correctly configured in secrets
3. Check external service status (Resend, MTA)
4. Review `crm_outbox.error_message` for specific errors

---

## 8. Bypass Techniques & Soft Failure Mode

### Soft Failure Mode

**Location:** `process-automation-outbox/index.ts`

**Purpose:** Prevent one failed step from blocking the entire automation journey.

**Configuration:**
```typescript
const SOFT_FAILURE_MODE = true;
```

**Behavior When Enabled:**
1. Failed step is marked as `soft_failed` in logs
2. Error is recorded but not terminal
3. `advanceAutomationRun()` is still called
4. Next step is queued normally
5. Automation continues

**Implementation:**
```typescript
if (SOFT_FAILURE_MODE && message.automation_run_id) {
  console.log(`⚠️ Soft failure mode: Step ${message.step_index} failed, continuing`);
  
  // Log as soft_failed
  await supabase.from("crm_automation_logs").upsert({
    automation_id: message.automation_id,
    customer_id: message.customer_id,
    step_index: message.step_index,
    status: "soft_failed",
    error_message: sendResult.error,
    skip_reason: `Failed after ${retries} retries - bypassed`
  });
  
  // Continue to next step despite failure
  await advanceAutomationRun(supabase, message);
}
```

### International SMS Bypass

**Location:** `send-sms/index.ts`

**Purpose:** Gracefully handle unsupported international numbers.

**Behavior:**
1. Detect non-US/Canada numbers before API call
2. Return success response with `skipable: true`
3. No error thrown (status 200)
4. Automation continues to next step
5. SMS marked as skipped, not failed

**Implementation:**
```typescript
if (!isUSCanada) {
  return new Response(
    JSON.stringify({ 
      error: 'UNSUPPORTED_REGION',
      skipable: true,
      canRetry: false
    }), 
    { status: 200 }  // Success status allows automation to continue
  );
}
```

### Manual Message Bypass

To manually skip a queued message:

```sql
UPDATE crm_outbox 
SET status = 'skipped',
    skip_reason = 'Manually skipped by admin',
    skipped_at = NOW()
WHERE id = 'message-uuid-here';
```

### Cancel Automation Run

To stop an automation run entirely:

```sql
-- Cancel the run
UPDATE automation_runs 
SET status = 'cancelled',
    error_message = 'Cancelled by admin',
    completed_at = NOW()
WHERE id = 'run-uuid-here';

-- Skip all pending messages for this run
UPDATE crm_outbox 
SET status = 'skipped',
    skip_reason = 'Run cancelled by admin',
    skipped_at = NOW()
WHERE automation_run_id = 'run-uuid-here'
  AND status IN ('queued', 'retrying');
```

---

## 9. Case Study: furqanhameedjutt.311@gmail.com

### Customer Details

| Field | Value |
|-------|-------|
| Email | furqanhameedjutt.311@gmail.com |
| Phone | +923249761079 (Pakistan) |
| Customer ID | 5ac20588-ed15-42ee-87ab-bfedac0ad269 |
| Tenant | Down to Earth Garden Center |
| SMS Opt-In | Yes |
| Email Opt-In | Yes |

### Issue Summary

This customer was added to the "Perks Program" segment, triggering the "PERKS PROGRAM — FOLLOW-UP EMAIL" automation. However:

1. **SMS Failed:** Phone is an international Pakistan number (+92)
2. **Emails Delayed:** First email scheduled 2 days in the future
3. **Multiple Runs Created:** 4+ automation runs were created

### Automation Runs History

| Run ID | Status | Created | Notes |
|--------|--------|---------|-------|
| 308381c1-1b59-4e10-90f9-07eb4847399c | active | Jan 18, 15:06 | Currently active, email scheduled for Jan 20 |
| a7345424-4cf8-4e5e-ad56-fa87e7ac453c | cancelled | Jan 18, 14:42 | Cancelled by admin |
| 44a87adf-b67c-4d7c-af2b-75e60c9b1b29 | cancelled | Jan 18, 14:42 | Cancelled by admin |
| bfc46232-23b6-4e6c-bc62-8f23b211da93 | cancelled | Jan 18, 14:42 | Cancelled by admin |

### Outbox Messages

| Type | Subject | Status | Scheduled | Notes |
|------|---------|--------|-----------|-------|
| Email | How your Perks Work | queued | Jan 20, 15:06 | Waiting for scheduled time |
| Email | Welcome to Perks | failed | — | From cancelled run |
| Email | Welcome to Perks | failed | — | From cancelled run |
| Email | Welcome to Perks | sent | Jan 18 | Successfully delivered |

### SMS Status

Both SMS attempts failed with:
- **Error:** Edge Function error
- **Reason:** International number not supported by MTA API

### Resolution Applied

1. Cancelled 3 duplicate automation runs
2. Marked 3 duplicate queued emails as failed
3. One active run remains with email scheduled for Jan 20

---

## 10. Troubleshooting Guide

### Check Automation Status

```sql
-- Find all automation runs for a customer
SELECT 
  ar.id,
  ar.status,
  ar.current_step_index,
  ar.total_steps,
  ar.started_at,
  ar.next_step_scheduled_at,
  a.name as automation_name
FROM automation_runs ar
JOIN crm_automations a ON a.id = ar.automation_id
WHERE ar.customer_id = 'customer-uuid'
ORDER BY ar.created_at DESC;
```

### Check Pending Messages

```sql
-- Find all queued messages for a customer
SELECT 
  id,
  message_type,
  subject,
  status,
  scheduled_at,
  error_message,
  retry_count
FROM crm_outbox
WHERE customer_id = 'customer-uuid'
  AND status IN ('queued', 'retrying')
ORDER BY scheduled_at;
```

### View Recent Edge Function Logs

Check the Supabase dashboard:
- Navigate to: Edge Functions → [function-name] → Logs
- Filter by time range
- Look for ERROR or WARN messages

### Verify Cron Jobs Running

```sql
-- Check cron job history
SELECT 
  jobname,
  runid,
  job_pid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

### Force Process a Message

```sql
-- Make a message eligible for immediate processing
UPDATE crm_outbox 
SET scheduled_at = NOW() - INTERVAL '1 minute',
    status = 'queued',
    locked_by = NULL,
    locked_until = NULL
WHERE id = 'message-uuid';
```

---

## 11. Recommendations

### Short-Term Fixes

1. **Review Automation Timing:** Ensure first step uses "immediately" not a delay
2. **Test with US Numbers:** For SMS testing, use US/Canada phone numbers
3. **Monitor Queued Messages:** Regularly check `crm_outbox` for stuck messages
4. **Enable Soft Failure Mode:** Keep `SOFT_FAILURE_MODE = true` to prevent blocked journeys

### Medium-Term Improvements

1. **Add SMS Provider for International:** Integrate Twilio or another provider with international support
2. **Implement Queue Mode:** Complete the "queue" overlap behavior for sequential runs
3. **Add Admin Dashboard:** Visual monitoring of automation health
4. **Improve Error Reporting:** More detailed error messages in logs

### Long-Term Architecture

1. **Message Broker:** Consider using a dedicated queue (Redis, RabbitMQ) for higher throughput
2. **Retry Backoff:** Implement exponential backoff for retries
3. **Circuit Breaker:** Temporarily disable failing automations after repeated errors
4. **Analytics Integration:** Track automation performance metrics

---

## Appendix: Quick Reference SQL

### Cancel All Active Runs for a Customer

```sql
UPDATE automation_runs 
SET status = 'cancelled', updated_at = NOW()
WHERE customer_id = 'customer-uuid' 
  AND status = 'active';
```

### Skip All Pending Messages for a Customer

```sql
UPDATE crm_outbox 
SET status = 'skipped', 
    skip_reason = 'Admin bypass',
    skipped_at = NOW()
WHERE customer_id = 'customer-uuid' 
  AND status IN ('queued', 'retrying');
```

### Find Stuck Messages (Not Processed)

```sql
SELECT * FROM crm_outbox
WHERE status = 'queued'
  AND scheduled_at < NOW() - INTERVAL '5 minutes'
ORDER BY scheduled_at;
```

### Check Automation Health

```sql
SELECT 
  a.name,
  COUNT(*) FILTER (WHERE ar.status = 'active') as active_runs,
  COUNT(*) FILTER (WHERE ar.status = 'completed') as completed,
  COUNT(*) FILTER (WHERE ar.status = 'failed') as failed,
  COUNT(*) FILTER (WHERE ar.status = 'cancelled') as cancelled
FROM crm_automations a
LEFT JOIN automation_runs ar ON ar.automation_id = a.id
WHERE a.is_active = true
GROUP BY a.id, a.name;
```

---

*Document maintained by the development team. For questions, contact the engineering lead.*
