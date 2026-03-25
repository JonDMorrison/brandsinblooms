# LS-UI-000 — Lightspeed Page Redesign: Audit & Design System

## Objective

Document the current Lightspeed management page problems, define the exact visual and interaction standards for the redesign, and lock the component contracts for LS-UI-001 through LS-UI-004.

This milestone is documentation-only.

No production UI code is changed as part of LS-UI-000.

## Scope

Included in this milestone:

- Current-state audit of the existing Lightspeed management page
- Redesign vision and layout model
- Page-specific design-system rules
- Interaction and status rules
- Component inventory and contracts
- Milestone boundaries for LS-UI-001 through LS-UI-004

Excluded from this milestone:

- UI implementation
- Backend or API changes
- Query/data-model changes
- Cross-provider redesign beyond reusable pattern notes

## Source Of Truth

This audit is based on the current implementation in [src/pages/integrations/IntegrationDetailPage.tsx](src/pages/integrations/IntegrationDetailPage.tsx), supported by existing BloomSuite design conventions in [src/docs/DESIGN_SYSTEM.md](src/docs/DESIGN_SYSTEM.md) and operational-detail patterns in [src/pages/crm/CRMCampaignRecipientDetailPage.tsx](src/pages/crm/CRMCampaignRecipientDetailPage.tsx).

Important implementation note:

- The current Lightspeed tabs are already rendered at the page-content level in code.
- The redesign still treats tab placement and styling as a problem because the present visual hierarchy makes them feel subordinate to nearby content rather than like top-level page navigation.

## Current Page Audit

### Current Top-Level Structure

The current Lightspeed detail experience is rendered in this order:

1. Breadcrumb
2. Page header with title, status badge, metadata, and actions
3. Metric cards grid
4. Tab bar
5. Tab content
   - Overview
   - Customers
   - Sales
   - Products
   - Sync Logs

Within the current Overview tab, the primary section order is:

1. Store Details
2. Sync Progress
3. Sync Configuration
4. Webhook Configuration
5. Data Pipeline

The broader page also includes connection state, repeated error surfaces, and destructive disconnect controls through header actions and related panels.

### Layout And Structure Problems

| Area | Problem |
|---|---|
| Header flow | The page has multiple competing action and status surfaces. Error context is not consolidated into one dominant action path. |
| Status communication | Status is split across header badge, metric cards, overview panels, sync panels, and sync logs. This makes the operator assemble one mental model from multiple places. |
| Left/right relationship | The intended operator split between health signals and configuration/detail is weak. Current sections stack linearly and do not create a clear fixed health rail versus detail column. |
| Health grouping | Connection health, webhook state, sync state, and connection verification problems are presented through separate cards or fields rather than a unified answer to “is this integration working?” |
| Panel hierarchy | Store Details, Sync Configuration, Webhook Configuration, and Data Pipeline have nearly identical weight. Nothing clearly reads as primary versus secondary. |
| Sync action placement | Manual sync is placed within lower page content instead of being promoted to the page header as the dominant operator action. |
| Diagnostics placement | Diagnostics and sync-log access are mixed into lower information panels instead of being grouped as operator tools. |
| Danger zone | Destructive/disconnect behavior is not isolated strongly enough as a separate bottom-of-page zone. |

### Typography And Visual Hierarchy Problems

| Area | Problem |
|---|---|
| Section titles | Section headers use similar weight and scale across operationally different content, reducing hierarchy. |
| Labels | Field labels are visually uniform even when some fields are core identity data and others are secondary operational telemetry. |
| Status values | Connected, warning, sync-only, pending, and empty states do not use one consistent status language or treatment. |
| Empty values | Null or missing values are often rendered as verbose fallback strings rather than a single recognizable empty-state pattern. |
| Error escalation | Error text appears inline with standard field content instead of escalating visually above surrounding informational rows. |
| Metric cards | Mixed content types inside the stat cards create inconsistent reading patterns. Numeric cards and state-only cards do not feel part of one system. |

### Information Architecture Problems

| Area | Problem |
|---|---|
| Health understanding | The current page makes operators inspect several panels before understanding the integration’s real state. |
| Data Pipeline | Pipeline rows can repeat the same status with low information density, adding vertical noise without meaningful differentiation. |
| Error repetition | The same underlying failure can appear as a banner, a health issue, a webhook error, and a sync failure context. The user sees repetition without a single obvious next step. |
| Reconnect guidance | Reconnect guidance exists, but the page does not always make reconnect the dominant corrective action when the integration cannot be verified. |
| Sync logs | Sync logs are useful but currently separate from the primary operator decision path. They should support diagnosis, not carry the burden of primary health communication. |

### Interaction Problems

| Area | Problem |
|---|---|
| Primary action | The most important page action changes by state, but the current hierarchy does not always surface that action first. |
| Warning handling | Warning and error states are not consistently tied to one corrective CTA. |
| Manual sync | Manual sync visually competes with content panels instead of living in the header where operators expect a primary action. |
| Redundant messaging | The same failure can appear in multiple places without progressive disclosure. |

### Code Structure Problems Affecting The Redesign

| Area | Problem |
|---|---|
| Multi-provider page | [src/pages/integrations/IntegrationDetailPage.tsx](src/pages/integrations/IntegrationDetailPage.tsx) is a large multi-provider page with extensive conditional rendering. |
| Repeated panel logic | Several provider-specific sections use repeated card, metric, and table patterns that make future redesign work riskier. |
| Lightspeed-specific complexity | Lightspeed-specific tables, sync logs, filters, and status helpers already justify progressive extraction into dedicated page-level components during LS-UI implementation. |

## Redesign Vision

### Design Direction

Operational dashboard with clinical precision.

This page is an operator tool, not a marketing surface and not a generic dashboard. The redesign should feel closer to a deployment detail page, admin console, or issue detail screen than a promotional product UI.

The desired tone is:

- clean
- precise
- low-noise
- status-first
- action-oriented

### Core Principles

1. One dominant hierarchy
   The page first answers whether the integration is healthy, then presents the one action the operator should take.

2. Status before content
   Health, verification state, and operational status appear above detailed configuration and raw data.

3. Related health signals are consolidated
   Connection, webhook, and sync health belong in one left-column health system.

4. Empty states are visually distinct
   A missing value must be recognizable without reading a full sentence.

5. Primary action is always visible
   Reconnect or Sync Now belongs in the header area, not mid-page.

6. Errors escalate once
   High-priority errors should appear in one contextual banner and then roll down into supporting detail, not repeat at equal weight everywhere.

## Target Page Layout

### Page Shell

The redesigned page should render in this order:

1. Breadcrumb
2. Page header
3. Contextual status banner
4. Stat cards row
5. Page-level tab bar
6. Two-column content region
7. Danger zone

### Header

Header contents:

- Integration identity
- Connection status badge
- Connection metadata line
- Primary action
- Documentation link
- Actions menu

Primary header action rules:

- Error state requiring repair: show `Reconnect`
- Healthy state: show `Sync Now`
- In-progress state: show disabled `Syncing...`

### Status Banner

The status banner is conditional.

Show it only when there is a warning or error requiring operator attention.

The banner must:

- summarize the highest-priority issue once
- include exactly one primary corrective CTA when applicable
- disappear when the issue resolves

### Stat Cards

The stat-card row remains above the tab bar.

It should summarize:

- Customers
- Sales
- Products
- Webhook mode

These cards are summary indicators, not secondary content panels.

### Tab Bar

Tabs are page-level navigation.

Tabs for this redesign:

- Overview
- Customers
- Sales
- Products
- Sync Logs

The tab bar must sit outside detail cards and above the main two-column content area.

### Two-Column Content Region

Left column:

- fixed width: 380px
- reserved for unified health/status interpretation

Right column:

- flexible width
- stacked configuration and detail panels

### Column Responsibilities

Left column contains:

- `IntegrationHealthPanel`

Right column contains, in order:

1. `StoreDetailsPanel`
2. `SyncConfigurationPanel`
3. `WebhookConfigurationPanel`
4. `DataPipelinePanel`

### Danger Zone

The danger zone is always last.

It must be visually isolated from routine configuration content and include the disconnect action as the sole dominant destructive control.

## Page-Specific Design System

This page inherits BloomSuite typography, spacing rhythm, and semantic color intent from [src/docs/DESIGN_SYSTEM.md](src/docs/DESIGN_SYSTEM.md), but intentionally overrides decorative card styling.

### Card Container

All operational panels on this page use one container style:

```tsx
bg-white border border-gray-100 rounded-xl p-5 shadow-sm
```

Rules:

- No colored card backgrounds
- No gradient card treatments
- No nested card-in-card compositions for standard information panels

### Section Header

All section headers use one pattern:

```tsx
<div className="flex items-center justify-between mb-4">
  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
  {action ? (
    <button className="text-xs text-muted-foreground hover:text-foreground">
      {action}
    </button>
  ) : null}
</div>
```

### Field Row

All standard field rows use one pattern:

```tsx
<div className="flex items-start justify-between py-2.5 border-b border-gray-50 last:border-0">
  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-40 flex-shrink-0 pt-0.5">
    {label}
  </span>
  <span className="text-sm text-foreground text-right">
    {value}
  </span>
</div>
```

### Empty Values

All empty or null values must render as:

```tsx
<span className="text-muted-foreground italic text-sm">—</span>
```

Rules:

- Do not use verbose fallbacks like “Not synced yet” or “No successful sync recorded” for standard fields
- Use the em dash for absent values
- Reserve explanatory empty-state prose for full empty panels, not individual rows

### Status Dots

Status dots are used anywhere status is expressed inline.

```css
.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

### Status Palette

| State | Dot color | Label color | Background tint |
|---|---|---|---|
| Healthy / Connected | `emerald-500` | `text-emerald-700` | `bg-emerald-50` |
| Warning / Sync only | `amber-400` | `text-amber-700` | `bg-amber-50` |
| Error / Attention | `red-500` | `text-red-700` | `bg-red-50` |
| Pending / Not synced | `gray-400` | `text-muted-foreground` | none |
| Unknown / Never | none | `text-muted-foreground italic` | none |

### Typography Rules

The page uses existing BloomSuite typography tokens, with these application rules:

- page title: strongest hierarchy
- section title: `text-sm font-semibold`
- field label: `text-xs uppercase`
- field value: `text-sm`
- empty values: muted italic
- operational errors: promoted above standard field content

### Error Treatment Rules

High-priority errors must not be treated as ordinary values.

Rules:

- Primary issue appears in the status banner
- Secondary supporting details can appear in the health panel or sync logs
- Standard field rows should not become a wall of red body text
- User-facing sanitized error messages must be used for operator-facing summary panels unless the view is explicitly super-admin/debug-only

## Interaction Rules

### Primary Action Rules

| State | Primary action |
|---|---|
| Healthy | `Sync Now` |
| Verification failure | `Reconnect` |
| In progress | disabled `Syncing...` |
| Warning without reconnect need | context-dependent operator action |

### Reconnect Rules

If the connection cannot be verified:

- reconnect becomes the dominant CTA in the header
- the status banner also offers reconnect
- lower sections may reference the issue, but should not compete with the banner

### Manual Sync Rules

Manual sync must live in the header area for Overview.

The sync logs and sync configuration panel can provide supporting context, but not own the page’s dominant CTA.

### Diagnostics Rules

Diagnostics are operator tools.

They belong in an action cluster, not buried as ordinary informational rows.

Expected actions:

- Run Diagnostics
- Open Sync Logs

### Error Message Rules

The page must continue the existing user-facing integration error sanitization standard already implemented in the codebase.

That means:

- no raw token decryption or crypto formatting errors in standard operator summaries
- no raw backend or edge-function implementation strings in status/banner panels
- raw technical detail is only acceptable in intentionally privileged debug surfaces

## Component Inventory

| Component | Target | Milestone |
|---|---|---|
| `LightspeedPageHeader` | new extracted header composition | LS-UI-001 |
| `LightspeedStatusBanner` | new | LS-UI-001 |
| `LightspeedStatCards` | refactor existing metric-card usage | LS-UI-001 |
| `LightspeedTabBar` | new | LS-UI-001 |
| `IntegrationHealthPanel` | new, replaces fragmented health surfaces | LS-UI-002 |
| `StoreDetailsPanel` | refactor | LS-UI-002 |
| `SyncConfigurationPanel` | refactor | LS-UI-002 |
| `WebhookConfigurationPanel` | refactor | LS-UI-002 |
| `DataPipelinePanel` | refactor | LS-UI-002 |
| `LightspeedDangerZone` | refactor/extract | LS-UI-003 |
| Customers tab view | polish/extract | LS-UI-004 |
| Sales tab view | polish/extract | LS-UI-004 |
| Products tab view | polish/extract | LS-UI-004 |
| Sync Logs tab view | align to redesigned hierarchy as needed | LS-UI-004 |

## Component Contracts

### `LightspeedPageHeader`

Purpose:

- identity and primary action zone for the entire page

Placement:

- top of page, directly below breadcrumb

Must include:

- provider icon/identity
- title
- connection status badge
- metadata line
- primary CTA
- documentation link
- actions dropdown

Required inputs:

- retailer name
- domain prefix
- connection state
- connected timestamp
- page-level error/warning state
- sync state
- action handlers

States:

- healthy
- warning
- error
- syncing
- disconnected/unverified

Reuse notes:

- may reuse existing action-dropdown behavior
- should not remain embedded as ad hoc JSX inside the giant page file

### `LightspeedStatusBanner`

Purpose:

- display one contextual warning or error summary with one obvious CTA

Placement:

- below header, above stat cards

Required inputs:

- severity
- message
- optional action label
- optional action handler

States:

- hidden
- warning
- error

Rules:

- banner is omitted entirely when the integration is healthy

### `LightspeedStatCards`

Purpose:

- summary metrics above the fold

Placement:

- below banner, above tab bar

Required inputs:

- customers synced
- sales synced
- products synced
- webhook mode

Rules:

- all cards must feel like one system
- non-numeric state cards must still match the numeric-card hierarchy

Reuse notes:

- may wrap or refactor current `CRMMetricCard` usage

### `LightspeedTabBar`

Purpose:

- page-level navigation between overview and operational data views

Placement:

- below stat cards, above two-column/tab content region

Required inputs:

- active tab
- available tabs
- counts if needed
- navigation handler

Rules:

- tabs are not visually subordinate to the right-column panels

### `IntegrationHealthPanel`

Purpose:

- unify connection health, webhook health, sync health, and verification issues

Placement:

- fixed left column, top-aligned

Required inputs:

- connection status
- verification state
- webhook mode/status
- last sync status
- last error summary
- retry/reconnect cues

States:

- healthy
- warning
- error
- syncing
- never-synced

Rules:

- replaces the fragmented health interpretation currently spread across multiple surfaces

### `StoreDetailsPanel`

Purpose:

- show canonical store/account identity information

Placement:

- top panel in right column

Required inputs:

- retailer name
- domain prefix
- connection date
- connection status
- any core identity metadata retained by the page

Rules:

- store identity fields are primary fields and should read more strongly than secondary status telemetry

### `SyncConfigurationPanel`

Purpose:

- show sync-specific operational configuration and last successful sync facts

Placement:

- second panel in right column

Required inputs:

- last customer sync
- last sales sync
- last product sync
- sync-related state or notes

Rules:

- this panel informs; it does not own the dominant Sync Now CTA

### `WebhookConfigurationPanel`

Purpose:

- show webhook registration state, mode, retry telemetry, and last received/checked information

Placement:

- third panel in right column

Required inputs:

- webhook mode
- registration state
- last received
- last checked
- retry count
- next retry
- sanitized last error

Rules:

- empty fields use em dash
- last error uses sanitized summary text in normal operator surfaces

### `DataPipelinePanel`

Purpose:

- summarize feed availability and provide operational tools related to diagnostics/logs

Placement:

- fourth panel in right column

Required inputs:

- feed states for customers/sales/products
- diagnostics action
- sync logs action

Rules:

- eliminate low-value repetition
- operator tools should read as tools, not passive field content

### `LightspeedDangerZone`

Purpose:

- isolate destructive actions and consequences

Placement:

- full-width bottom section below main content

Required inputs:

- disconnect action
- warning copy
- current connection identity

Rules:

- visually isolated
- one dominant destructive action
- warning copy supports the action instead of looking like body content

## Reuse And Replacement Guidance

Existing reusable helpers/components:

- `SectionCard`
- `DetailFieldRows`
- `CRMMetricCard`
- `LightspeedSyncProgressPanel`
- `LightspeedSortButton`
- `LightspeedPaginationBar`
- `LightspeedTableEmptyState`
- `LightspeedJsonCollapsible`

Implementation guidance for later milestones:

- `SectionCard` may be reused only if its styling can be brought into strict compliance with the page-specific white-card rule
- `DetailFieldRows` is a good candidate for reuse if empty-state and hierarchy rules are tightened
- `CRMMetricCard` likely needs refactoring or wrapping to unify numeric and state-based metric cards
- `LightspeedSyncProgressPanel` should be reassessed under the new hierarchy so active sync state contributes to health understanding rather than competing with it
- table and pagination helpers can remain for LS-UI-004 if their surrounding page hierarchy is updated

## Milestone Boundaries

### LS-UI-001

Focus:

- page shell
- header
- banner
- stat cards
- tab bar

Expected outcome:

- new top-of-page hierarchy established

### LS-UI-002

Focus:

- overview tab redesign
- unified left-column health panel
- right-column detail/configuration panels

Expected outcome:

- Overview becomes a coherent operator console

### LS-UI-003

Focus:

- danger zone redesign
- destructive action isolation
- final overview hierarchy cleanup

Expected outcome:

- bottom-of-page destructive controls are clear and isolated

### LS-UI-004

Focus:

- customers, sales, products, and sync logs views aligned to the new system
- table views and logs inherit the top-level redesign language

Expected outcome:

- non-overview tabs feel like part of the same page system

## Acceptance Criteria

- All page-specific design tokens defined in this document are internally consistent
- Empty/null field values are specified as `—` in muted italic for standard field rows
- Status dots are standardized as 8px indicators with defined state colors
- All operational panels are specified to use one white-card container style
- All section headers are specified to use one header style
- The redesign clearly promotes one primary action in the header
- The redesign consolidates health signals into one left-column health panel
- The audit is grounded in the actual current implementation, not only screenshot interpretation
- The milestone deliverable exists as a committed repo doc under `docs/`

## Implementation Notes For Future Milestones

1. Lightspeed-specific UI should be progressively extracted from the large multi-provider [src/pages/integrations/IntegrationDetailPage.tsx](src/pages/integrations/IntegrationDetailPage.tsx) rather than expanding conditional rendering further.
2. Existing sanitized integration error handling should remain the default for operator-visible summary surfaces.
3. Later milestones should preserve current data/query behavior unless explicitly changed by a separate backend or data contract milestone.