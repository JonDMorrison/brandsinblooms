# Newsletter editor rollout

## Required release order

1. Review and apply pending migrations in repository order, including the original
   `20261026193000_crm_saved_blocks.sql` and the follow-up
   `20261027221828_newsletter_saved_blocks_release_guard.sql`.
   The follow-up is safe when the table is absent and installs campaign-based RLS,
   bounded object payloads and the explicit v2 client write marker.
   Do not mark a migration applied without confirming its effective schema.
2. Confirm `crm_saved_blocks` exists, RLS is enabled, anonymous access is denied,
   owner/admin/marketing writes work, read-only staff cannot write, and another
   account cannot read/change rows. Master-admin access must require an explicit
   matching tenant context. Use test fixtures, then remove them.
3. Deploy all affected edge functions selected by
   `scripts/find-affected-edge-functions.mjs`. The shared generator and send-time
   conditional audience resolver must be live before the new frontend is enabled.
4. Publish the frontend only after the database and workers are verified.
5. Complete the acceptance checks below. No live customer campaign should be sent
   to validate this release; use explicit internal test recipients.

## Acceptance checks

- Save a new campaign with each new block type. Reload and verify text, images,
  widths, conditions, audience selection and style overrides persist.
- Save and reuse a named seasonal template; verify master design settings survive.
- Save a configured coupon to account A. Load on a second browser in A. Insert,
  edit its copy and verify the saved original is unchanged. Rename and remove it.
- Switch to account B. No A saved block should appear or be mutable. Verify
  master-admin switching does not show stale A rows while B loads.
- Confirm browser legacy import prompts with the destination account. Verify no
  import occurs simply by opening the builder.
- Navigate a long email through Outline; test keyboard selection, duplicate,
  reordering, delete/undo, Top and Bottom.
- Test 640px and 700px newsletters, 375px preview, and a wide monitor. Check that
  properties fit without horizontal page overflow and buttons remain accessible.
- Replace every feature-grid image and verify the correct slot changes. Test image
  URLs, saved base-folder filenames and normal file uploads.
- Inspect a test email in Gmail, Outlook and iOS Mail for the selected design,
  spacing, galleries, CTA, coupon small print and mandatory footer links.
- Test a conditional block with a matching customer, a nonmatching customer and a
  removed/archived segment. Missing database membership evidence must not include
  the block. Preview-all mode must never be used for normal delivery.
- Import a small real XLSX and quoted CSV. Check mapping, image URLs, row layout,
  errors, cancellation and single-action undo.
- Test a public CORS-enabled feed and a refused/private/oversized feed.
- Print a test UPC image and scan it with the actual target POS scanner. Confirm
  redemption is controlled by the POS rule, not the email block.

## Recovery

Keep saved content and its table on rollback. Do not revert to the unsafe
browser-auto-import implementation with write access. If the new editor is
rolled back, retain the v2 write marker restriction; old tabs should receive a
visible save error rather than importing unowned local content into an account.
Do not downgrade the email workers while scheduled campaigns contain new block
kinds or conditional content. Repair the renderer or temporarily pause affected
campaigns rather than silently dropping their content.
