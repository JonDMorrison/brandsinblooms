# Phase 3: Embed Display Modes & Triggers

This document describes the display mode architecture and trigger system for BloomSuite form embeds.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Display Mode + Trigger Architecture                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                │
│  │   INLINE     │   │    MODAL     │   │   SLIDE-IN   │                │
│  │   (default)  │   │              │   │              │                │
│  └──────────────┘   └──────┬───────┘   └──────┬───────┘                │
│                            │                  │                         │
│                            ▼                  ▼                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   TRIGGER ENGINE (Client-Side)                    │  │
│  │                                                                    │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │  │
│  │  │ MANUAL  │  │  DELAY  │  │ SCROLL  │  │  CLICK  │             │  │
│  │  │ (btn)   │  │  (ms)   │  │  (%)    │  │ (modal) │             │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘             │  │
│  │                                                                    │  │
│  │  • Client-side only evaluation                                    │  │
│  │  • No per-user state persistence (v1)                             │  │
│  │  • Single-fire per page load                                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              PRESENTATION WRAPPER LAYER (Display Only)            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  CORE FORM LAYER (Unchanged)                      │  │
│  │                                                                    │  │
│  │  renderForm() / handleSubmit() / submitData()                     │  │
│  │  ⚠️ NEVER MODIFIED BY TRIGGERS OR DISPLAY MODES                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Display Trigger Configuration Schema

### Data Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `data-trigger` | string | Trigger type: `delay`, `scroll`, `click` |
| `data-delay` | number | Delay in milliseconds (for `delay` trigger) |
| `data-scroll-depth` | number | Scroll percentage 0-100 (for `scroll` trigger) |
| `data-click-selector` | string | CSS selector (for `click` trigger, modal only) |

## Supported Triggers

### 1. Manual (Default)

User clicks a trigger button to open the form. This is the default when no `data-trigger` is specified.

```html
<div 
  data-bloomsuite-form="abc123def456..."
  data-display-mode="modal"
  data-button-text="Contact Us"
></div>
```

### 2. Delay Trigger

Form opens automatically after a specified delay (milliseconds).

```html
<!-- Open modal after 3 seconds -->
<div 
  data-bloomsuite-form="abc123def456..."
  data-display-mode="modal"
  data-trigger="delay"
  data-delay="3000"
></div>

<!-- Open slide-in after 5 seconds -->
<div 
  data-bloomsuite-form="abc123def456..."
  data-display-mode="slide-in"
  data-trigger="delay"
  data-delay="5000"
  data-form-title="Quick Question?"
></div>
```

### 3. Scroll Depth Trigger

Form opens when user scrolls past a percentage of the page.

```html
<!-- Open modal at 50% scroll -->
<div 
  data-bloomsuite-form="abc123def456..."
  data-display-mode="modal"
  data-trigger="scroll"
  data-scroll-depth="50"
></div>

<!-- Open slide-in at 75% scroll -->
<div 
  data-bloomsuite-form="abc123def456..."
  data-display-mode="slide-in"
  data-trigger="scroll"
  data-scroll-depth="75"
  data-form-title="Before You Go..."
></div>
```

### 4. Click Selector Trigger (Modal Only)

Form opens when user clicks any element matching a CSS selector. **Only works with modal mode.**

```html
<!-- Open modal when clicking any .cta-button -->
<div 
  data-bloomsuite-form="abc123def456..."
  data-display-mode="modal"
  data-trigger="click"
  data-click-selector=".cta-button"
></div>

<!-- Then anywhere on the page -->
<button class="cta-button">Get Started</button>
<a href="#" class="cta-button">Learn More</a>
```

## Trigger Logic Details

### Evaluation Rules

| Rule | Description |
|------|-------------|
| Client-side only | All trigger logic runs in browser JavaScript |
| Single-fire | Each trigger fires at most once per page load |
| No persistence | No cookies, localStorage, or server state (v1) |
| No conditions | Simple triggers only, no complex AND/OR logic |

### Trigger Behavior

| Trigger | When It Fires | Cleanup |
|---------|---------------|---------|
| `delay` | After X ms from page load | Timeout cleared on destroy |
| `scroll` | When scroll % ≥ threshold | Scroll listener removed on destroy |
| `click` | When matching element clicked | Click listener removed on destroy |

### Edge Cases

- **Delay**: Fires even if user has scrolled or interacted
- **Scroll**: Checks immediately on init (if already scrolled past threshold)
- **Click**: Prevents default action on clicked element, bubbles up to check parent elements

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

## Complete Attribute Reference

| Attribute | Type | Modes | Description |
|-----------|------|-------|-------------|
| `data-bloomsuite-form` | string | All | Required. 32-char embed key |
| `data-display-mode` | string | All | `inline`, `modal`, or `slide-in` |
| `data-button-text` | string | modal, slide-in | Text for manual trigger button |
| `data-form-title` | string | slide-in | Title in panel header |
| `data-trigger` | string | modal, slide-in | `delay`, `scroll`, or `click` |
| `data-delay` | number | modal, slide-in | Delay in ms (for delay trigger) |
| `data-scroll-depth` | number | modal, slide-in | Scroll % 0-100 (for scroll trigger) |
| `data-click-selector` | string | modal only | CSS selector (for click trigger) |

## Accessibility Implementation

### Accessibility Checklist ✓

| Feature | Modal | Slide-In | Implementation |
|---------|-------|----------|----------------|
| **Focus Trap** | ✅ | ✅ | Tab cycles within dialog only |
| **ESC Closes** | ✅ | ✅ | `keydown` listener with `e.preventDefault()` |
| **ARIA role="dialog"** | ✅ | ✅ | Set on overlay/panel element |
| **ARIA aria-modal="true"** | ✅ | ✅ | Indicates modal behavior |
| **ARIA aria-labelledby** | ✅ | ✅ | Points to title element |
| **ARIA aria-describedby** | ✅ | ✅ | Points to "Press Escape to close" text |
| **Close Button Visible** | ✅ | ✅ | Top-right corner, styled `×` |
| **Close Button Keyboard** | ✅ | ✅ | Focusable `<button>` with `aria-label` |
| **Focus Restore** | ✅ | ✅ | Returns to triggering element on close |
| **Screen Reader Announce** | ✅ | ✅ | `role="status"` announcements on open/close |
| **Body Scroll Lock** | ✅ | ✅ | `overflow: hidden` on `<body>` |

### Code Implementation Notes

#### 1. Focus Trap

```javascript
// Focus trap cycles Tab key within dialog
function createFocusTrap(container, closeCallback) {
  var focusableElements = getFocusableElements(container);
  var firstFocusable = focusableElements[0];
  var lastFocusable = focusableElements[focusableElements.length - 1];
  
  function handleKeyDown(e) {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey && document.activeElement === firstFocusable) {
      e.preventDefault();
      lastFocusable.focus();
    } else if (!e.shiftKey && document.activeElement === lastFocusable) {
      e.preventDefault();
      firstFocusable.focus();
    }
  }
  
  container.addEventListener('keydown', handleKeyDown);
  
  // Return cleanup function that restores previous focus
  return function() {
    container.removeEventListener('keydown', handleKeyDown);
    previousActiveElement.focus();
  };
}
```

#### 2. ESC Key Handling

```javascript
// ESC closes dialog with proper event handling
var escHandler = function(e) {
  if (e.key === 'Escape' && isOpen) {
    e.preventDefault();      // Prevent other handlers
    e.stopPropagation();     // Stop bubbling
    closeModal(modalId);
  }
};
document.addEventListener('keydown', escHandler);
```

#### 3. ARIA Attributes

```html
<!-- Modal structure -->
<div role="dialog" 
     aria-modal="true" 
     aria-labelledby="modal-title" 
     aria-describedby="modal-desc">
  <div role="document">
    <h2 id="modal-title">Form Title</h2>
    <p id="modal-desc" class="sr-only">Press Escape to close this dialog</p>
    <button aria-label="Close form">×</button>
    <!-- form content -->
  </div>
</div>
```

#### 4. Dismiss Button

```javascript
// Close button is a proper button element
var closeBtn = createElement('button', 'modal-close', {
  type: 'button',
  'aria-label': 'Close form'  // Screen reader text
});
closeBtn.innerHTML = '<span aria-hidden="true">&times;</span>';
```

#### 5. Screen Reader Announcements

```javascript
// Announce state changes to screen readers
function announceToScreenReader(message) {
  var el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  el.className = 'sr-only';  // Visually hidden
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// Usage
openModal() → announceToScreenReader('Form dialog opened. Press Escape to close.');
closeModal() → announceToScreenReader('Form dialog closed.');
```

#### 6. Focus Restoration

```javascript
// Store previous focus on open
var previousActiveElement = document.activeElement;

// On close, restore focus
function cleanup() {
  if (previousActiveElement && previousActiveElement.focus) {
    previousActiveElement.focus();
  }
}
```

### CSS for Screen Reader Only Text

```css
.bs-form-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

## Implementation Details

### Wrapper Layer Responsibilities

The display mode wrapper ONLY handles:

1. **Container Creation**: Overlay, panel, close button
2. **Visibility Transitions**: CSS animations for open/close
3. **Event Handling**: Close on Escape, click outside
4. **Accessibility**: Focus trap, ARIA attributes, announcements
5. **Body Scroll Lock**: Prevent background scroll when open
6. **Focus Management**: Trap on open, restore on close

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
