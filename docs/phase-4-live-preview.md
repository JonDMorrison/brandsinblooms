# Phase 4: Live Preview Column

## Overview

Phase 4 adds a live preview column to the Form Builder, showing how the form will appear to customers in real-time as you edit fields, design, and compliance settings.

## Features

### 2-Column Layout

- **Left Column**: Existing form builder UI (fields, design, compliance tabs)
- **Right Column**: Live preview panel (sticky, independently scrollable)

### Preview Controls

| Control | Description |
|---------|-------------|
| Device Width | Toggle between Desktop (480px) and Mobile (360px) |
| Background | Toggle between White and Gray backgrounds |
| Show Branding | Local toggle to show/hide "Powered by BloomSuite" (preview-only) |
| Reset | Reset the preview to initial state |

### Live Updates

- Preview updates instantly as you edit
- 200ms debounce prevents UI jitter
- Works for: fields, design settings, compliance checkboxes

### Responsive Behavior

- **Desktop (1024px+)**: Side-by-side 2-column layout
- **Mobile (<1024px)**: Full-screen modal overlay triggered by floating "Preview" button

### Validation Warnings

Preview shows non-blocking warnings:
- "No fields added yet"
- "No email field (recommended)"

## Components

### `FormPreviewRenderer`

Shared renderer that can be used by both the live preview and the embed.

```tsx
<FormPreviewRenderer
  fields={fields}
  settings={settings}
  compliance={compliance}
  mode="preview" // or "embed"
/>
```

**Props:**
- `fields`: Array of form fields
- `settings`: Form settings (theme, button text, etc.)
- `compliance`: Consent settings
- `mode`: "preview" shows reset button, "embed" calls onSubmit

### `PreviewPanel`

Wrapper with controls and debounced updates.

```tsx
<PreviewPanel
  fields={fields}
  settings={settings}
  compliance={compliance}
/>
```

## Files Changed

| File | Change |
|------|--------|
| `src/components/forms/preview/FormPreviewRenderer.tsx` | New - shared form renderer |
| `src/components/forms/preview/PreviewPanel.tsx` | New - preview wrapper with controls |
| `src/components/forms/preview/index.ts` | New - exports |
| `src/hooks/use-media-query.ts` | New - responsive hook |
| `src/pages/crm/FormEditorPage.tsx` | Updated - 2-column layout |

## Non-Goals (Out of Scope)

- ❌ Does NOT call `get-form-config` or `submit-form`
- ❌ Does NOT replace the production embed.js
- ❌ Does NOT support all embed display modes (modal, slide-in)
- ❌ Does NOT persist branding toggle (preview-only)

## Usage

1. Navigate to a form: `/crm/forms/:formId`
2. Preview appears automatically on Build, Design, and Compliance tabs
3. Use controls at top of preview panel to adjust view
4. On mobile, tap floating "Preview" button

## Embed Snippet

For production embedding, use the actual embed script:

```html
<div data-bloomsuite-form="YOUR_EMBED_KEY"></div>
<script src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.js" defer></script>
```
