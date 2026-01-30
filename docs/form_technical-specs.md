# BloomSuite Form Builder — Technical Specification

> **Version:** 1.5.0  
> **Last Updated:** January 2026  
> **Status:** Production

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [System Components](#system-components)
3. [Database Schema](#database-schema)
4. [Edge Functions](#edge-functions)
5. [Embed Script (embed.v1.js)](#embed-script-embedv1js)
6. [Data Flow](#data-flow)
7. [Security Model](#security-model)
8. [Consent & Compliance](#consent--compliance)
9. [Rate Limiting](#rate-limiting)
10. [Builder UI](#builder-ui)
11. [Deployment & Hosting](#deployment--hosting)
12. [API Reference](#api-reference)

---

## Architecture Overview

The BloomSuite Form Builder is a full-stack, multi-tenant form solution designed for embedding on third-party websites. It consists of three main layers:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER WEBSITE                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      embed.v1.js (Client)                     │  │
│  │  • Zero dependencies    • Inline rendering (no iframe)       │  │
│  │  • CSP-friendly         • Modal/slide-in/inline modes        │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     SUPABASE EDGE FUNCTIONS                         │
│  ┌─────────────────────────┐  ┌─────────────────────────────────┐  │
│  │   get-form-config       │  │        submit-form              │  │
│  │   • Fetch form schema   │  │   • Validate submission         │  │
│  │   • Sanitize settings   │  │   • Rate limiting               │  │
│  │   • Public (no JWT)     │  │   • Consent capture             │  │
│  └─────────────────────────┘  │   • Customer upsert             │  │
│                               │   • Automation triggers         │  │
│                               └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Service Role
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SUPABASE DATABASE                              │
│  ┌────────────┐  ┌──────────────────┐  ┌────────────────────────┐  │
│  │   forms    │  │ form_submissions │  │   form_rate_limits     │  │
│  └────────────┘  └──────────────────┘  └────────────────────────┘  │
│  ┌────────────┐  ┌──────────────────┐                              │
│  │crm_customers│ │automation_trigger│                              │
│  │            │  │_events           │                              │
│  └────────────┘  └──────────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Zero-Dependency Embed**: The embed script has no external dependencies (no jQuery, React, etc.)
2. **No iframes**: Forms render inline for better accessibility and SEO
3. **Multi-Tenant Isolation**: `tenant_id` is derived strictly from the `embed_key` lookup
4. **Fail-Loud UI**: Errors are displayed visibly, not silently swallowed
5. **Immutable Consent Snapshots**: Legal proof of consent is captured at submission time

---

## System Components

### 1. Public-Facing Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `embed.v1.js` | `public/forms/embed.v1.js` | Client-side form renderer |
| `embed.css` | `public/forms/embed.css` | Scoped form styles |
| `get-form-config` | `supabase/functions/` | Fetch form configuration |
| `submit-form` | `supabase/functions/` | Process form submissions |

### 2. Internal Management Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `FormEditorPage` | `src/pages/crm/FormEditorPage.tsx` | Builder UI |
| `FormPreviewRenderer` | `src/components/forms/preview/` | Live preview |
| `useForms` hook | `src/hooks/useForms.ts` | Form CRUD operations |
| `formTemplates` | `src/lib/formTemplates.ts` | Pre-built templates |

### 3. Type Definitions

| File | Purpose |
|------|---------|
| `src/types/formBuilder.ts` | TypeScript interfaces for forms |

---

## Database Schema

### `public.forms`

Main form configuration table.

```sql
CREATE TABLE public.forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'published' | 'archived'
  embed_key TEXT UNIQUE NOT NULL,       -- 32-char hex, public identifier
  
  -- JSONB configuration columns
  fields_json JSONB NOT NULL DEFAULT '[]',
  settings_json JSONB NOT NULL DEFAULT '{}',
  compliance_json JSONB NOT NULL DEFAULT '{}',
  audience_json JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `fields_json` Structure

```typescript
interface FormField {
  id: string;              // UUID, unique per field
  type: FormFieldType;     // 'email' | 'text' | 'phone' | 'select' | 'checkbox' | 'hidden' | 'email_consent' | 'sms_consent'
  label: string;           // Display label
  required: boolean;       // Validation flag
  placeholder?: string;    // Input placeholder
  options?: string[];      // For 'select' type
  mapping_key: string;     // Maps to CRM field: 'email' | 'first_name' | 'last_name' | 'phone' | 'custom'
  default_value?: string;  // Pre-filled value
  rules?: {               // Validation rules
    min_length?: number;
    max_length?: number;
    pattern?: string;
    pattern_message?: string;
  };
}
```

#### `settings_json` Structure

```typescript
interface FormSettings {
  // Display
  success_message: string;           // Shown after successful submission
  success_redirect_url?: string;     // Optional redirect URL
  submit_button_text: string;        // Button label
  show_branding: boolean;            // "Powered by BloomSuite"
  
  // Headlines (H2/H4 semantic hierarchy)
  form_headline?: string;            // Main headline above form
  form_subheadline?: string;         // Supporting text
  
  // Theme
  theme: {
    primary_color: string;           // Hex color
    secondary_color?: string;
    text_color?: string;
    background_color?: string;
    font_family: string;
    border_radius: string;           // e.g., '8px'
    spacing: 'compact' | 'normal' | 'relaxed';
    button_style: 'filled' | 'outline' | 'rounded';
    input_style?: 'default' | 'underline' | 'filled';
  };
  
  // Layout
  form_width?: 'narrow' | 'medium' | 'wide' | 'full';
  label_position?: 'above' | 'inline' | 'floating';
  columns?: number;
  
  // Internal (NOT exposed to embed)
  notification_emails: string[];     // Admin emails for notifications
}
```

#### `compliance_json` Structure

```typescript
interface FormCompliance {
  email_consent_required: boolean;   // CASL compliance
  email_consent_text: string;        // Verbatim consent text
  sms_consent_required: boolean;     // TCPA compliance
  sms_consent_text: string;          // Verbatim consent text
  double_opt_in: boolean;            // Require email confirmation
  gdpr_compliant: boolean;           // GDPR mode
}
```

### `public.form_submissions`

Stores all form submissions with immutable consent proof.

```sql
CREATE TABLE public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  form_id UUID NOT NULL REFERENCES forms(id),
  customer_id UUID REFERENCES crm_customers(id),
  
  data JSONB NOT NULL,               -- Raw form data
  metadata JSONB NOT NULL,           -- Consent snapshots, UTM params, etc.
  ip_hash TEXT,                      -- SHA-256 hashed IP (privacy)
  
  result TEXT NOT NULL,              -- 'accepted' | 'rejected'
  reason TEXT,                       -- Rejection reason if applicable
  
  submitted_at TIMESTAMPTZ DEFAULT now()
);
```

#### `metadata` Structure (Canonical Keys)

```typescript
interface FormSubmissionMetadata {
  // Attribution
  page_url?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  user_agent?: string;
  
  // Form identification
  form_embed_key?: string;
  form_id?: string;
  consent_source?: string;
  submitted_at?: string;
  
  // ─── CANONICAL EMAIL CONSENT KEYS ───
  email_consent: boolean;            // Whether consent was given
  email_consent_text?: string;       // Verbatim consent text shown
  email_consent_at?: string;         // ISO 8601 timestamp
  email_consent_required?: boolean;  // Was consent required
  
  // ─── CANONICAL SMS CONSENT KEYS ───
  sms_consent: boolean;
  sms_consent_text?: string;
  sms_consent_at?: string;
  sms_consent_required?: boolean;
  
  // Rejection details
  rejection_type?: 'invalid' | 'rate_limited' | 'spam';
}
```

### `public.form_rate_limits`

Atomic rate limiting with sliding windows.

```sql
CREATE TABLE public.form_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  form_id UUID NOT NULL,
  ip_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER DEFAULT 1,
  
  UNIQUE(form_id, ip_hash, window_start)
);
```

---

## Edge Functions

### `get-form-config`

**Purpose:** Fetch form configuration for public embed rendering.

**Endpoint:** `GET /functions/v1/get-form-config?embed_key={key}`

**Authentication:** None (`verify_jwt = false`)

**Security Features:**
- In-memory rate limiting (60 req/min per IP)
- Embed key validation (32-char hex)
- Settings sanitization via strict allowlist

**Allowlist (SECURITY CRITICAL):**

Only these `settings_json` fields are returned to the browser:

```typescript
const SETTINGS_ALLOWLIST = {
  // UI/Display
  success_message: true,
  submit_button_text: true,
  show_branding: true,
  form_title: true,
  form_description: true,
  
  // Navigation
  success_redirect_url: true,
  
  // Theme (nested allowlist)
  theme: {
    primary_color: true,
    secondary_color: true,
    text_color: true,
    background_color: true,
    font_family: true,
    border_radius: true,
    spacing: true,
    button_style: true,
    input_style: true,
  },
  
  // Layout
  form_width: true,
  field_spacing: true,
  label_position: true,
  columns: true,
};
```

**NEVER Exposed:**
- `notification_emails` (admin PII)
- `webhook_url`, `webhook_secret` (backend secrets)
- `assign_personas`, `assign_tags` (handled server-side)

**Response:**

```json
{
  "form_id": "uuid",
  "fields_json": [...],
  "settings_json": { /* sanitized */ },
  "compliance_json": { /* sanitized */ }
}
```

---

### `submit-form`

**Purpose:** Process form submissions with validation, rate limiting, and customer management.

**Endpoint:** `POST /functions/v1/submit-form`

**Authentication:** None (`verify_jwt = false`)

**Request Body:**

```typescript
interface SubmissionPayload {
  embed_key: string;                    // Form identifier
  data: Record<string, unknown>;        // Form field values
  meta?: {
    page_url?: string;
    referrer?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
}
```

**Processing Pipeline:**

```
1. Validate embed_key format
2. Look up form by embed_key (derive tenant_id)
3. Validate form status === 'published'
4. DB-backed rate limiting check
5. Honeypot spam detection
6. Required field validation
7. Consent validation (CASL/TCPA)
8. Customer upsert (find or create)
9. Update consent timestamps (upgrade-only)
10. Record submission with consent snapshot
11. Emit automation trigger event
12. Return success response
```

**Rate Limits:**
- Short window: 5 submissions per minute per IP
- Long window: 20 submissions per 10 minutes per IP

**Response (Success):**

```json
{
  "success": true,
  "message": "Thank you for your submission!",
  "customer_id": "uuid",
  "redirect_url": "https://..." // optional
}
```

**Response (Validation Error):**

```json
{
  "error": "Validation failed",
  "errors": ["Email is required", "Phone must be valid"]
}
```

---

## Embed Script (embed.v1.js)

### Overview

`embed.v1.js` is the client-side JavaScript that renders BloomSuite forms on any website. It is:

- **Zero-dependency**: No jQuery, React, or external libraries
- **Self-contained**: ~45KB uncompressed, ~12KB gzipped
- **CSP-friendly**: Uses external CSS file, no `unsafe-inline` required
- **Multi-form capable**: Multiple forms per page supported

### Version Strategy

| File | Purpose | Cache |
|------|---------|-------|
| `embed.v1.5.0.js` | Immutable pinned version | 1 year |
| `embed.v1.js` | Major version alias (auto-updates within v1.x) | 1 hour |
| `embed.js` | Development/latest | No cache |

### Installation

**Recommended (Auto-Updates):**

```html
<div data-bloomsuite-form="YOUR_EMBED_KEY"></div>
<script 
  src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.js" 
  defer
></script>
```

**Pinned Version:**

```html
<script 
  src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.5.0.js" 
  defer
></script>
```

### Data Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-bloomsuite-form` | ✓ | 32-char embed key |
| `data-mode` | | `inline` (default), `modal`, `slide-in` |
| `data-trigger` | | `manual`, `delay`, `scroll`, `click` |
| `data-delay` | | Milliseconds (for delay trigger) |
| `data-scroll-depth` | | Percentage (for scroll trigger) |
| `data-click-selector` | | CSS selector (for click trigger) |
| `data-debug` | | `true` to enable debug panel |

### Display Modes

**Inline (Default):**
```html
<div data-bloomsuite-form="abc123..."></div>
```

**Modal:**
```html
<div 
  data-bloomsuite-form="abc123..." 
  data-mode="modal"
  data-trigger="delay"
  data-delay="5000"
></div>
```

**Slide-in:**
```html
<div 
  data-bloomsuite-form="abc123..." 
  data-mode="slide-in"
  data-trigger="scroll"
  data-scroll-depth="50"
></div>
```

### Initialization Flow

```javascript
1. Script loads, IIFE executes immediately
2. Detect SCRIPT_BASE from own URL (for CSS loading)
3. Load embed.css from same origin
4. Find all [data-bloomsuite-form] containers
5. Skip already initialized (data-bs-initialized="true")
6. For each container:
   a. Show loading state
   b. Fetch config from get-form-config
   c. Parse display mode and trigger config
   d. Render form or trigger button
   e. Set up event handlers
7. Start MutationObserver for dynamic containers
```

### CSS Class Prefix

All CSS classes use `bs-form-` prefix to avoid conflicts:

```css
.bs-form-container { }
.bs-form-wrapper { }
.bs-form-field { }
.bs-form-label { }
.bs-form-input { }
.bs-form-submit { }
.bs-form-success { }
.bs-form-error-msg { }
.bs-form-consent { }
.bs-form-modal-overlay { }
.bs-form-slidein-panel { }
```

### Fail-Loud Error States

The embed displays visible errors instead of failing silently:

| Error | Display | Cause |
|-------|---------|-------|
| `BLOCKED` | Red error box | Ad-blocker, CSP, or network block |
| `NOT_FOUND` | Red error box | Invalid embed key |
| `TIMEOUT` | Red error box | Network timeout (10s) |
| `NETWORK_ERROR` | Red error box | Connection failed |

### Debug Mode

Enable with `data-debug="true"`:

```html
<div data-bloomsuite-form="abc123..." data-debug="true"></div>
```

Displays diagnostic panel showing:
- Script version
- API base URL
- CSS URL
- Form ID
- Request/response details
- Timing information

### Accessibility Features

- Semantic HTML (`<form>`, `<label>`, `<fieldset>`)
- ARIA attributes for screen readers
- Focus management for modals
- Keyboard navigation support
- Focus trap in modal/slide-in modes
- iOS Safari scroll lock handling

---

## Data Flow

### Form Configuration Flow

```
┌─────────────┐     GET /get-form-config      ┌─────────────────┐
│  embed.js   │ ──────────────────────────►   │   Edge Function │
│             │   ?embed_key=abc123...        │                 │
└─────────────┘                               └────────┬────────┘
                                                       │
                                                       │ SELECT
                                                       ▼
                                              ┌─────────────────┐
                                              │     forms       │
                                              │  .embed_key     │
                                              │  .fields_json   │
                                              │  .settings_json │
                                              └────────┬────────┘
                                                       │
                                                       │ Sanitize
                                                       ▼
┌─────────────┐     { fields_json, ... }      ┌─────────────────┐
│  embed.js   │ ◄──────────────────────────   │   Edge Function │
│             │                               │                 │
└─────────────┘                               └─────────────────┘
```

### Form Submission Flow

```
┌─────────────┐     POST /submit-form         ┌─────────────────┐
│  embed.js   │ ──────────────────────────►   │   Edge Function │
│             │   { embed_key, data, meta }   │                 │
└─────────────┘                               └────────┬────────┘
                                                       │
                                    ┌──────────────────┴──────────────────┐
                                    │                                      │
                                    ▼                                      ▼
                            ┌───────────────┐                    ┌─────────────────┐
                            │ Rate Limit    │                    │ Honeypot Check  │
                            │ Check         │                    │                 │
                            └───────┬───────┘                    └────────┬────────┘
                                    │                                      │
                                    └──────────────────┬───────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │ Field + Consent │
                                              │ Validation      │
                                              └────────┬────────┘
                                                       │
                                    ┌──────────────────┴──────────────────┐
                                    │                                      │
                                    ▼                                      ▼
                            ┌───────────────┐                    ┌─────────────────┐
                            │ crm_customers │                    │form_submissions │
                            │ UPSERT        │                    │ INSERT          │
                            └───────────────┘                    └────────┬────────┘
                                                                          │
                                                                          ▼
                                                               ┌─────────────────────┐
                                                               │ automation_trigger  │
                                                               │ _events (INSERT)    │
                                                               └─────────────────────┘
```

### Automation Trigger Flow

Successful submissions (`result = 'accepted'`) emit events via PostgreSQL trigger:

```sql
-- Trigger on form_submissions table
CREATE TRIGGER emit_form_submitted_event
AFTER INSERT ON form_submissions
FOR EACH ROW
WHEN (NEW.result = 'accepted')
EXECUTE FUNCTION emit_automation_event('FormSubmitted');
```

The event metadata includes immutable consent snapshots:

```json
{
  "event_type": "FormSubmitted",
  "customer_id": "uuid",
  "form_id": "uuid",
  "metadata": {
    "email_consent": true,
    "email_consent_text": "I agree to receive marketing emails",
    "email_consent_at": "2026-01-30T10:00:00Z",
    "sms_consent": false
  }
}
```

---

## Security Model

### Tenant Isolation

**Critical Rule:** `tenant_id` is NEVER accepted from client input.

```typescript
// CORRECT: Derive tenant_id from embed_key lookup
const { data: form } = await supabase
  .from('forms')
  .select('id, tenant_id, ...')
  .eq('embed_key', embed_key.toLowerCase());

const tenantId = form.tenant_id; // Trust database, not client
```

### IP Privacy

Client IPs are immediately hashed using SHA-256 with a dedicated salt:

```typescript
async function hashIP(ip: string): Promise<string> {
  const salt = Deno.env.get('RATE_LIMIT_SALT');
  const data = encoder.encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

**Environment Variable:** `RATE_LIMIT_SALT` (required for production)

### CORS Configuration

Public endpoints include permissive CORS for cross-origin embedding:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
};
```

### Honeypot Spam Detection

Hidden fields catch bots that auto-fill all inputs:

```typescript
const honeypotFields = ['_honeypot', 'honeypot', '_hp', 'website', 'url', '_blank'];

function checkHoneypot(data: Record<string, unknown>): boolean {
  for (const field of honeypotFields) {
    if (data[field] !== undefined && data[field] !== '') {
      return true; // Spam detected
    }
  }
  return false;
}
```

Spam submissions return fake success to avoid tipping off bots.

---

## Consent & Compliance

### CASL (Email) Compliance

- Separate consent checkbox for email marketing
- Verbatim consent text stored in submission metadata
- Timestamp of consent captured at submission time
- "Upgrade-only" pattern: consent can be added but never removed programmatically

### TCPA (SMS) Compliance

- Separate consent checkbox for SMS (cannot be bundled with email)
- Required disclosure text including "Msg & data rates may apply"
- Timestamp and verbatim text stored for legal proof

### Consent Storage Pattern

```typescript
// In crm_customers table
{
  email_opt_in: "2026-01-30T10:00:00Z",  // Timestamp of first consent
  sms_opt_in: "2026-01-30T10:00:00Z",
  email_opt_out: null,                    // Never modified by form submissions
  sms_opt_out: null,
  email_consent_details: {
    source: "form",
    form_id: "uuid",
    consent_text: "I agree to receive marketing emails",
    page_url: "https://example.com/signup",
    captured_at: "2026-01-30T10:00:00Z"
  }
}
```

---

## Rate Limiting

### Two-Layer Protection

**Layer 1: In-Memory (get-form-config)**
- 60 requests per minute per IP
- Resets on cold start
- Fast, no database hit

**Layer 2: Database-Backed (submit-form)**
- Atomic UPSERT with unique constraint
- Short window: 5 submissions per minute
- Long window: 20 submissions per 10 minutes
- Persistent across cold starts

### Atomic Rate Limit Implementation

```sql
-- Unique constraint ensures atomicity
UNIQUE(form_id, ip_hash, window_start)

-- Atomic upsert
INSERT INTO form_rate_limits (tenant_id, form_id, ip_hash, window_start, count)
VALUES (?, ?, ?, ?, 1)
ON CONFLICT (form_id, ip_hash, window_start) 
DO UPDATE SET count = form_rate_limits.count + 1
RETURNING count;
```

---

## Builder UI

### Main Components

| Component | Purpose |
|-----------|---------|
| `FormEditorPage` | Main editor layout with 2-column view |
| `FormBuildTab` | Drag-and-drop field management |
| `FormDesignTab` | Theme, layout, headline settings |
| `FormComplianceTab` | Consent checkbox configuration |
| `FormPublishTab` | Status management, embed code |
| `FormSubmissionsTab` | Submission viewer |
| `PreviewPanel` | Live preview with change highlighting |
| `FormPreviewRenderer` | Shared renderer (preview + reference) |

### Live Preview Behavior

- Updates instantly as edits occur (200ms debounce)
- Subscribes to local builder state
- Simulates successful submissions (client-side only)
- Change highlighting with animated ring effect

### Brand Color Integration

New forms inherit brand colors from `company_profiles`:

```typescript
// useForms.ts - Form creation
const brandColors = await fetchBrandColors(user.user_id);
const settingsWithBrandColors = {
  ...DEFAULT_FORM_SETTINGS,
  theme: {
    primary_color: brandColors.primary || '#22C55E',
    secondary_color: brandColors.secondary,
    // ...
  }
};
```

---

## Deployment & Hosting

### Supabase Storage

Assets are hosted in a public bucket to bypass domain-blocking:

```
Bucket: assets (public)
Path:   forms/
Files:
  - embed.v1.5.0.js (immutable, 1 year cache)
  - embed.v1.js (alias, 1 hour cache)
  - embed.css (styles)
```

### URLs

**Production:**
```
https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.js
```

**CSS Auto-Loading:**
The embed script detects its own URL and loads CSS from the same path.

### Version Update Procedure

1. Update version constant in `public/forms/embed.js`
2. Copy to `public/forms/embed.v{X.Y.Z}.js`
3. Copy to `public/forms/embed.v1.js` (alias)
4. Upload to Supabase Storage
5. Verify public access

---

## API Reference

### GET `/functions/v1/get-form-config`

Fetch form configuration for rendering.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `embed_key` | string | ✓ | 32-char hex form identifier |

**Response 200:**
```json
{
  "form_id": "uuid",
  "fields_json": [...],
  "settings_json": {...},
  "compliance_json": {...}
}
```

**Response 400:** Invalid embed_key format  
**Response 404:** Form not found or not published  
**Response 429:** Rate limit exceeded

---

### POST `/functions/v1/submit-form`

Submit form data.

**Request Body:**
```json
{
  "embed_key": "abc123...",
  "data": {
    "field-uuid-1": "john@example.com",
    "field-uuid-2": "John",
    "field-uuid-3": true
  },
  "meta": {
    "page_url": "https://example.com/signup",
    "referrer": "https://google.com",
    "utm_source": "newsletter"
  }
}
```

**Response 200 (Success):**
```json
{
  "success": true,
  "message": "Thank you for your submission!",
  "customer_id": "uuid",
  "redirect_url": "https://..."
}
```

**Response 400 (Validation Error):**
```json
{
  "error": "Validation failed",
  "errors": ["Email is required", "SMS consent is required"]
}
```

**Response 404:** Form not found  
**Response 429:** Rate limit exceeded

---

## Glossary

| Term | Definition |
|------|------------|
| `embed_key` | 32-character hex string uniquely identifying a form |
| `tenant_id` | UUID identifying the organization that owns the form |
| `mapping_key` | Field property that maps form input to CRM customer fields |
| `consent_snapshot` | Immutable record of consent text and timestamp at submission |
| `CASL` | Canadian Anti-Spam Legislation (email consent) |
| `TCPA` | Telephone Consumer Protection Act (SMS consent) |

---

## Related Documentation

- [Embed Deployment Guide](./embed-deployment-guide.md)
- [Supabase Storage Deployment](./embed-supabase-storage-deployment.md)
- [Form Builder Types](../src/types/formBuilder.ts)
