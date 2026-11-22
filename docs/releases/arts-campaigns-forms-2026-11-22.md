# Arts campaign and form improvements

Continuation of PR #578, based on main 963411f14. PR #574 already released the campaign-name column and direct designer shortcut.

## Implemented
- Campaign details, subject/preview, audience, design and actions in the requested order; contextual sender setup opens account settings.
- Campaign Results shortcut, Send now / Schedule menu actions using the guarded confirmation flow.
- Multiple tenant-owned campaign groups, filtering, group colours and per-campaign colour markers. Groups are separate from immutable send content.
- Quick name/subject editing with stale-update and draft-status guards; direct audience/status/date shortcuts. Existing schedules change only through a permission-checked, row-locked RPC, rejecting worker claims and stale versions.
- Form duplication remains on the list; palette drop targets and portalled field menus repaired.
- One Editor tab with Fields/content and Appearance/live preview modes. Ordered header controls, floating labels, HTTPS header image top/left/right, instructions above Submit, black/white/surface-transparent choices, clearer maximum-width and form-corner labels.
- Shared hosted/editor rendering honours background/spacing. Existing JavaScript embed runtimes retain their distinct validation/mapping behavior and receive the appearance fixes too.
- Contact field mapping picker; organization and custom values persist in custom_fields; geographic values map to existing CRM columns. Consent/system columns cannot be set through arbitrary mapping keys. Hidden defaults remain server-authoritative.
- Phone validation during typing and server-side validation; consent copy edits update the same authoritative compliance values.
- Timed popup snippets (2,3,5,10 seconds). Publish links to a draft welcome-coupon automation scoped to this form; content must be authored and reviewed before activation. Existing suppression/consent gates remain.

## Validation checkpoint
- Production build passed.
- 24 initial focused checks passed; 12 campaign/appearance/review checks passed after updating permission-aware mocks.
- Database rollback tests: authorized group/membership/colour writes passed; foreign-tenant write denied; draft rescheduling denied. No campaign send state changed.
- Broad suite: 3,277 passed, 4 skipped; eight failures were missing auth/tenant mocks in two changed pages. Campaign tests (now 7) and automation builder tests (2) passed after fixing those test contexts; appearance/order checks also pass. No unresolved failures.
- Full application typecheck is blocked by existing syntax errors in unrelated legacy Homepage/content-sidebar files; build succeeds.
- Supabase migration applied; get-form-config v152 and submit-form v162 active. Frontend release pending.

## Verification still required
- Full-suite outcome, edge deployment and frontend production deployment.
- Live UI: group add/filter/assignment, quick edit, form label typing/menus/duplicate, saved appearance and public preview, welcome automation scoped to correct workspace.
- No client campaigns or automations have been sent or activated.

## Existing limitation
The form Compliance screen labels double opt-in and GDPR switches as "UI only". This release does not claim those switches enforce runtime behavior. Email/SMS consent and suppression protections remain enforced. Do not advertise confirmation-email delivery as working.
