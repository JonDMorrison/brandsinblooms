# BloomSuite CRM Dashboard — Mobile Empty-State Hotfix

## Why it looked empty

The dashboard always rendered "What would you like to do?" but hid every
button when customers.read, campaigns.write, and reports.read permissions were
not available. It also hid all metrics and the latest campaign behind the same
permission flags. An account with permissions still loading, a master admin
without a selected tenant, a failed permission query, or a genuinely limited
role could see an almost completely blank mobile page without an explanation.

This is a presentation and access-state bug, not proof that a user's roles were
actually revoked. Do not bypass server permissions to fill the screen.

## Fix

- Master admins without a selected tenant get a clear company picker.
- During permission hydration, show visible action-sized skeletons.
- Permission errors show an explanation and Retry access. Limited roles also
  get a visible message rather than an empty dashboard.
- Authorized users see three large mobile action cards for email, SMS and
  customer lookup, with multi-column layout on larger screens.
- Reporting-only users can still open Analytics.
- Metrics and latest campaign remain available where permitted.
- No database, RLS, loyalty, billing, customer data or sending changes.

## Tests

- Unit tests for granted, loading, denied, error, missing-admin-company and
  reporting-only states.
- Real dashboard component browser tests at small and large iPhone sizes and
  desktop, asserting visible actions, tight placement below the heading,
  no horizontal overflow, company selection, and clear recovery states.
- All browser fixtures are synthetic, with module aliases only in the
  dedicated local Vite config. There is no production auth bypass.

## Customer verification

Open the authenticated CRM dashboard on the affected iPhone and confirm the
intended tenant and menu. Synthetic browser tests do not prove real account
permissions or the state of individual tenants.
