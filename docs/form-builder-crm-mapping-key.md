# Form Builder CRM Mapping Key

## Purpose

The `CRM Mapping Key` input in the Form Builder defines the canonical key used for a field when form submissions are normalized into submission payload data.

This input is not just a UI label or an AI hint. It changes the property name that the public form submission pipeline writes into the final submitted data object.

## What The Field Does

For each form field:

- `id` identifies the field instance inside the builder.
- `label` is the human-facing text shown in the form.
- `mapping_key` is the machine-facing key used in normalized submission data.

At submit time, the public form page converts field values into an object keyed by `mapping_key`.

Example:

```json
{
  "id": "9a3dc404-...",
  "label": "Upload Prescription",
  "type": "file",
  "mapping_key": "file_9a3dc404"
}
```

If the visitor uploads a file, the normalized submission payload will use:

```json
{
  "file_9a3dc404": {
    "upload_id": "...",
    "file_name": "prescription.pdf"
  }
}
```

Not:

```json
{
  "9a3dc404-...": { "upload_id": "..." }
}
```

## Why It Exists

The mapping key gives the system a stable business key for downstream processing.

It is used so that:

- submissions are stored under meaningful keys like `email`, `first_name`, `phone`, or `file_9a3dc404`
- CRM-oriented fields can map to expected customer attributes
- custom fields can still be preserved under custom keys
- presentation and lookup code can resolve a field by `mapping_key` before falling back to `id`

## Runtime Behavior

### 1. Builder storage

Each form field stores a `mapping_key` in `fields_json`.

Example shape:

```ts
interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  mapping_key: string;
}
```

### 2. Default values

New fields are created with default mapping keys from the field registry.

Common defaults:

- `email` -> `email`
- `text` -> usually a semantic default like `first_name` depending on template or field type defaults
- `phone` -> `phone`
- `file` -> generated unique value like `file_<first_8_chars_of_uuid>`

File fields intentionally get a generated key so multiple upload fields do not collide.

### 3. Submission normalization

During form submission, the public form code uses:

- `field.mapping_key` first
- `field.id` only as a fallback if the mapping key is missing

That means the mapping key controls the final payload key written into submission data.

### 4. Submission presentation and lookup

When the app later renders or inspects a submission, it tries these keys in order:

- `mapping_key`
- `id`
- legacy `field_key` if present

This allows the UI to resolve both current and older stored submissions.

## Important Constraints

- The mapping key should be treated as a data-contract field, not decorative metadata.
- Changing it after a form has live submissions can change how new submissions are keyed.
- Duplicate mapping keys across multiple fields can create ambiguous payloads and should be avoided.
- The server sanitization path trims the value and caps it to 120 characters.

## Guidance For AI Systems

When an AI model works with this form schema, it should interpret `mapping_key` as the canonical machine field name.

AI should:

- preserve `mapping_key` unless there is a deliberate schema migration
- prefer semantic keys like `email`, `first_name`, `last_name`, `phone`, `company`, `notes`
- keep upload fields unique if there are multiple file inputs
- avoid rewriting keys based only on label wording changes
- assume downstream automation may depend on these exact keys

AI should not:

- treat `mapping_key` as display copy
- rename keys casually during form redesign
- collapse two distinct fields onto the same key unless a merge is explicitly intended

## Recommended Usage

- Use standard CRM-shaped keys for known identity fields.
- Use descriptive custom keys for non-standard fields.
- Keep keys stable once external automations, reporting, or CRM enrichment depend on them.

## Code References

- Builder input label and helper copy: `src/components/forms/DraggableFieldList.tsx`
- Field type defaults: `src/lib/forms/fieldRegistry.ts`
- Submission normalization: `src/pages/PublicFormPage.tsx`
- Submission lookup and display fallback: `src/lib/forms/submissionPresentation.ts`
- Type definition: `src/types/formBuilder.ts`