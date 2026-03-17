

# Form Builder Fixes — Implementation Plan

This plan addresses 13 fixes across 3 priority tiers. Here is what will change, file by file.

---

## CRITICAL FIXES

### Fix 1: PublicFormPage uses shared FormPreviewRenderer

**Problem**: `PublicFormPage.tsx` has a basic inline renderer (200 lines) that ignores headlines, theme colors, layout, button styles, etc. The editor preview uses `FormPreviewRenderer.tsx` which handles all of these.

**Change**: Rewrite `PublicFormPage.tsx` to:
- Keep its existing data-fetching logic (fetch from `get-form-config` edge function) and submission logic (POST to `submit-form`)
- Replace the inline form rendering (lines 138-200) with `<FormPreviewRenderer>` in `mode="embed"` with an `onSubmit` callback
- The `onSubmit` callback will contain the existing submission logic (lines 54-90)
- Replace hardcoded Supabase URL with the client import (also covers Fix 8)
- Pass fetched `fields_json`, `settings_json`, `compliance_json` as props

**Files**: `src/pages/PublicFormPage.tsx`

---

### Fix 2: Audience/persona assignment not saving

**Problem**: `FormEditorPage.tsx` line 34 manages `audience` state, but `handleSave()` (line 66-71) doesn't include it. The `forms` table does NOT have an `audience_json` column (confirmed from `types.ts`), yet `submit-form` edge function reads `audience_json` from the forms table.

**Change**:
1. Add a database migration to add `audience_json JSONB DEFAULT '{}'::jsonb` to the `forms` table
2. Update `handleSave()` in `FormEditorPage.tsx` to include `audience_json: audience as unknown as Json` in the update payload
3. Update the `useEffect` that initializes state from the loaded form to also set `audience` from `form.audience_json` (currently only sets fields/settings/compliance)
4. Update `useForms.ts` — add `audience_json` to `UpdateFormData` interface and the `dbUpdates` mapping in `updateFormMutation`

**Files**: `src/pages/crm/FormEditorPage.tsx`, `src/hooks/useForms.ts`, new migration SQL

---

### Fix 3: Select, checkbox, hidden fields on public form

**Problem**: `PublicFormPage.tsx` only renders email/phone/text/consent. After Fix 1, this is automatically resolved because `FormPreviewRenderer` already handles all field types (select at line 408, checkbox at line 427, hidden fields filtered at line 269). No additional work needed beyond Fix 1.

---

### Fix 4: Unsaved changes warning

**Problem**: `hasChanges` state exists but nothing prevents navigation.

**Change**:
- Import and use the existing `useBeforeUnload` hook (already in the codebase at `src/hooks/useBeforeUnload.ts`) with `when: hasChanges`
- Add a React Router `useBlocker` guard that shows a confirmation dialog when `hasChanges` is true and user tries to navigate away
- Use a simple `ConfirmationDialog` (already exists in the codebase) for the in-app navigation guard

**Files**: `src/pages/crm/FormEditorPage.tsx`

---

## MODERATE FIXES

### Fix 5: Pre-publish validation

**Problem**: Users can publish forms with zero fields, no email field, or missing consent fields.

**Change**: In `FormPublishTab.tsx`, before the publish action, run validation:
- Must have at least one field
- Must have an email field (`type === 'email'`)
- If an SMS consent field exists, a phone field must also exist
- Show inline error messages listing what's missing (using Alert component)
- Block the publish button until validation passes

The `FormPublishTab` receives `form` as a prop, which contains `fields_json`. We'll add a validation function and display errors inline.

**Files**: `src/components/forms/FormPublishTab.tsx`

---

### Fix 6: Wire FormAnalyticsTab into editor

**Change**: Add "Analytics" as a 7th tab in `FormEditorPage.tsx`:
- Import `FormAnalyticsTab`
- Update `TabsList` grid from `grid-cols-6` to `grid-cols-7`
- Add `<TabsTrigger value="analytics">Analytics</TabsTrigger>`
- Add `<TabsContent value="analytics">` rendering `<FormAnalyticsTab formId={form.id} />`

**Files**: `src/pages/crm/FormEditorPage.tsx`

---

### Fix 7: Remove duplicate getStatusBadge

**Change**: Remove the component-level `getStatusBadge` method (lines 61-70) inside the `FormsPage` component. Keep the standalone function (lines 275-284).

**Files**: `src/pages/crm/FormsPage.tsx`

---

### Fix 8: Replace hardcoded URLs

**Change** (partially done in Fix 1):
- `PublicFormPage.tsx`: Replace `https://udldmkqwnxhdeztyqcau.supabase.co` with the Supabase client URL imported from the client module. We'll extract the URL from the existing `supabase` client or use the env variable.
- `FormPublishTab.tsx` line 43: Replace `https://brandsinblooms.lovable.app` with `window.location.origin`

**Files**: `src/pages/PublicFormPage.tsx`, `src/components/forms/FormPublishTab.tsx`

---

### Fix 9: Pagination for submissions

**Change**: In `FormSubmissionsTab.tsx`:
- Add `page` state (starting at 0), with page size of 50
- Change the query to use `.range(page * 50, (page + 1) * 50 - 1)` instead of `.limit(500)`
- Add a separate count query for stats (using `{ count: 'exact', head: true }`)
- Add Previous/Next pagination controls below the table using existing Pagination components
- Stats cards use the separate total count, not the paginated data

**Files**: `src/components/forms/FormSubmissionsTab.tsx`

---

### Fix 10: Mark test matrix submissions

**Change**:
- In `FormTestMatrix.tsx`: Add `is_test: true, source: "test_matrix"` to the `meta` object in every test case's request body
- In `FormSubmissionsTab.tsx`: Add a "Hide test submissions" toggle (default: on) that filters out rows where `metadata.is_test === true`. Show a small "Test" badge on test rows when visible.

**Files**: `src/components/forms/FormTestMatrix.tsx`, `src/components/forms/FormSubmissionsTab.tsx`

---

## LOWER PRIORITY FIXES

### Fix 11: Form duplication

**Change**: In `FormsPage.tsx`:
- Add a "Duplicate" `DropdownMenuItem` in the form action menu
- On click, call `createForm()` with the existing form's `fields_json`, `settings_json`, `compliance_json`, and name `"[Name] (Copy)"`, status `'draft'`
- Navigate to the new form's editor after creation

**Files**: `src/pages/crm/FormsPage.tsx`

---

### Fix 12: Form search and filter

**Change**: In `FormsPage.tsx`:
- Add search input + status filter dropdown above the forms list
- Client-side filtering on `form.name` and `form.status`
- Show result count: "Showing X of Y forms"

**Files**: `src/pages/crm/FormsPage.tsx`

---

### Fix 13: Warn before deleting consent fields

**Change**: In `DraggableFieldList.tsx`:
- In `removeField()` (line 112), check if the field type is `email_consent` or `sms_consent`
- If so, show a confirmation dialog before deletion with compliance warning text
- Use the existing `ConfirmationDialog` component

**Files**: `src/components/forms/DraggableFieldList.tsx`

---

## Database Migration Required

One migration for Fix 2:

```sql
ALTER TABLE public.forms 
ADD COLUMN IF NOT EXISTS audience_json JSONB DEFAULT '{}'::jsonb;
```

---

## Summary of Files Changed

| File | Fixes |
|------|-------|
| `src/pages/PublicFormPage.tsx` | 1, 3, 8 |
| `src/pages/crm/FormEditorPage.tsx` | 2, 4, 6 |
| `src/hooks/useForms.ts` | 2 |
| `src/components/forms/FormPublishTab.tsx` | 5, 8 |
| `src/pages/crm/FormsPage.tsx` | 7, 11, 12 |
| `src/components/forms/FormSubmissionsTab.tsx` | 9, 10 |
| `src/components/forms/FormTestMatrix.tsx` | 10 |
| `src/components/forms/DraggableFieldList.tsx` | 13 |
| New migration SQL | 2 |

No edge functions are modified. No unrelated refactoring.

