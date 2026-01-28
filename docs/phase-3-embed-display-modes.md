# Phase 3: Embed Display Modes

This document describes the display mode architecture for BloomSuite form embeds.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Display Mode Architecture                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                │
│  │   INLINE     │   │    MODAL     │   │   SLIDE-IN   │                │
│  │   (default)  │   │              │   │              │                │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘                │
│         │                  │                  │                         │
│         │                  │                  │                         │
│         ▼                  ▼                  ▼                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              PRESENTATION WRAPPER LAYER (Display Only)            │  │
│  │                                                                    │  │
│  │  • Creates container (overlay, panel, etc.)                       │  │
│  │  • Handles open/close transitions                                 │  │
│  │  • Manages focus trap & accessibility                             │  │
│  │  • NEVER touches form logic                                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  CORE FORM LAYER (Unchanged)                      │  │
│  │                                                                    │  │
│  │  renderForm()     →  Builds form DOM                              │  │
│  │  renderField()    →  Creates field elements                       │  │
│  │  handleSubmit()   →  Collects & validates data                    │  │
│  │  submitData()     →  POSTs to /submit-form                        │  │
│  │                                                                    │  │
│  │  ⚠️ NEVER MODIFIED BY DISPLAY MODES                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    SUBMISSION ENDPOINT                            │  │
│  │                    /submit-form (unchanged)                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Supported Display Modes

### 1. Inline (Default)

Form renders directly in the container element.

```html
<div data-bloomsuite-form="abc123def456..."></div>
```

### 2. Modal

Form opens in a centered overlay dialog.

```html
<div 
  data-bloomsuite-form="abc123def456..."
  data-display-mode="modal"
  data-button-text="Contact Us"
></div>
```

### 3. Slide-In

Form opens in a panel sliding from the right edge.

```html
<div 
  data-bloomsuite-form="abc123def456..."
  data-display-mode="slide-in"
  data-button-text="Get Quote"
  data-form-title="Request a Quote"
></div>
```

## Mode Selection Mechanism

Display mode is determined by the `data-display-mode` attribute:

| Attribute Value | Mode | Behavior |
|-----------------|------|----------|
| (none) | inline | Form renders in place |
| `inline` | inline | Form renders in place |
| `modal` | modal | Trigger button + centered overlay |
| `slide-in` | slide-in | Trigger button + right panel |

### Attribute Reference

| Attribute | Modes | Description |
|-----------|-------|-------------|
| `data-bloomsuite-form` | All | Required. The 32-char embed key |
| `data-display-mode` | All | `inline`, `modal`, or `slide-in` |
| `data-button-text` | modal, slide-in | Text for trigger button |
| `data-form-title` | slide-in | Title in panel header |

## Implementation Details

### Wrapper Layer Responsibilities

The display mode wrapper ONLY handles:

1. **Container Creation**: Overlay, panel, close button
2. **Visibility Transitions**: CSS animations for open/close
3. **Event Handling**: Close on Escape, click outside
4. **Accessibility**: Focus trap, ARIA attributes
5. **Body Scroll Lock**: Prevent background scroll when open

### What Wrappers NEVER Do

- ❌ Modify field rendering
- ❌ Change validation logic
- ❌ Duplicate submission code
- ❌ Alter form data collection
- ❌ Handle API responses

### Submission Path Confirmation

**The submission path is 100% unchanged:**

```
User clicks Submit
       │
       ▼
handleSubmit() (unchanged)
       │
       ▼
submitData() → POST /submit-form (unchanged)
       │
       ▼
Success: Show message / Redirect
Error: Show error message
```

All three display modes use the exact same:
- `handleSubmit()` function
- `submitData()` function
- Form data collection logic
- Error handling
- Success message display

## JavaScript API

### Programmatic Control

```javascript
// Access the API
var forms = window.BloomSuiteForms;

// Create a modal
var modalId = forms.createModal('abc123def456...', { title: 'Contact' });
forms.openModal(modalId);
forms.closeModal(modalId);
forms.destroyModal(modalId);

// Create a slide-in
var panelId = forms.createSlideIn('abc123def456...', { title: 'Get Quote' });
forms.openSlideIn(panelId);
forms.closeSlideIn(panelId);

// Create trigger button
var trigger = forms.createTrigger('abc123def456...', {
  mode: 'modal',
  buttonText: 'Open Form',
  title: 'Contact Us'
});

document.getElementById('my-container').appendChild(trigger.button);
trigger.open();  // Programmatic open
trigger.close(); // Programmatic close
trigger.destroy(); // Cleanup
```

### Available Modes Constant

```javascript
BloomSuiteForms.modes = {
  INLINE: 'inline',
  MODAL: 'modal',
  SLIDE_IN: 'slide-in'
};
```

## CSS Classes Reference

### Modal Classes

| Class | Description |
|-------|-------------|
| `bs-form-modal-overlay` | Full-screen overlay backdrop |
| `bs-form-modal-content` | Centered modal box |
| `bs-form-modal-close` | Close button (×) |
| `bs-form-modal-body` | Form container inside modal |
| `bs-form-open` | Applied when modal is visible |

### Slide-In Classes

| Class | Description |
|-------|-------------|
| `bs-form-slidein-overlay` | Full-screen overlay backdrop |
| `bs-form-slidein-panel` | Right-edge panel |
| `bs-form-slidein-header` | Panel header with title |
| `bs-form-slidein-title` | Title text |
| `bs-form-slidein-close` | Close button (×) |
| `bs-form-slidein-body` | Form container inside panel |
| `bs-form-open` | Applied when panel is visible |

### Trigger Button

| Class | Description |
|-------|-------------|
| `bs-form-trigger` | Trigger button styling |

## Accessibility

### Keyboard Navigation

- **Escape**: Closes modal/slide-in
- **Tab**: Trapped within modal when open
- **Enter/Space**: Activates buttons

### ARIA Attributes

```html
<!-- Modal -->
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
  ...
</div>

<!-- Slide-in -->
<div role="dialog" aria-modal="true" aria-labelledby="panel-title">
  ...
</div>
```

## Migration Notes

### Upgrading from v1.0.x

1. **No breaking changes** - Existing inline forms work identically
2. Add `data-display-mode` attribute to use new modes
3. Script version updated to 1.1.0

### Version Compatibility

| embed.js Version | Modes Supported |
|------------------|-----------------|
| 1.0.x | inline only |
| 1.1.0+ | inline, modal, slide-in |
