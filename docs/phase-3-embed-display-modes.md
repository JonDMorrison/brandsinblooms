# Phase 3: Embed Display Modes & Triggers

This document describes the display mode architecture, trigger system, and accessibility implementation for BloomSuite form embeds.

**Current Version:** 1.3.0

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

---

## Test Harness

### File Location

```
public/forms/test-harness.html
```

### Running Locally

1. Serve the forms directory:
   ```bash
   # Using npx serve
   npx serve public/forms

   # Or Python
   cd public/forms && python -m http.server 8000
   ```

2. Open in browser:
   ```
   http://localhost:5000/test-harness.html  # npx serve
   http://localhost:8000/test-harness.html  # python
   ```

3. Replace placeholder embed keys with valid 32-char keys from your forms.

---

## Manual Test Checklist

### Focus Trap Tests

| Test | Steps | Pass Criteria |
|------|-------|---------------|
| **FT-1: Initial Focus** | Open modal via button click | Focus moves to close button or first form field automatically |
| **FT-2: Tab Forward** | Press Tab repeatedly inside modal | Focus cycles through: Close btn → Form fields → Submit btn → Close btn (loops) |
| **FT-3: Tab Backward** | Press Shift+Tab from close button | Focus moves to last focusable element (submit button) |
| **FT-4: Fallback Focus** | Open modal with empty/no-field form | Container becomes focusable; Tab doesn't escape modal |
| **FT-5: No Escape** | Tab while modal is open | Focus NEVER leaves the modal to underlying page elements |

### ESC Handler Tests

| Test | Steps | Pass Criteria |
|------|-------|---------------|
| **ESC-1: Close When Focused Inside** | Open modal, ensure focus is on a form field, press ESC | Modal closes |
| **ESC-2: Close When Focus Lost** | Open modal, click somewhere that removes focus (body), press ESC | Modal still closes (focus on body accepted) |
| **ESC-3: No Close When Outside** | Open modal, Alt+Tab to another window, return, click outside modal but don't close, press ESC while focus is on page element outside | Modal does NOT close |
| **ESC-4: Host Page Isolation** | Open host page modal, press ESC | Only host modal closes, BloomSuite ESC handler does not interfere |
| **ESC-5: Capture Phase** | Host page has ESC listener, open BloomSuite modal, press ESC | BloomSuite modal closes first (uses capture phase) |

### ARIA Attribute Verification

| Element | Attribute | Expected Value |
|---------|-----------|----------------|
| Modal overlay | `role` | `"dialog"` |
| Modal overlay | `aria-modal` | `"true"` |
| Modal overlay | `aria-labelledby` | `"{modalId}-title"` (points to real h2 element) |
| Modal overlay | `aria-describedby` | `"{modalId}-desc"` (points to real p.sr-only element) |
| Slide-in panel | `role` | `"dialog"` |
| Slide-in panel | `aria-modal` | `"true"` |
| Slide-in panel | `aria-labelledby` | `"{panelId}-title"` |
| Slide-in panel | `aria-describedby` | `"{panelId}-desc"` |
| Close button | `aria-label` | `"Close form"` |
| Close button | `type` | `"button"` |

**Verification Script (run in browser console):**
```javascript
// Check modal ARIA
var modal = document.querySelector('[role="dialog"]');
if (modal) {
  var labelId = modal.getAttribute('aria-labelledby');
  var descId = modal.getAttribute('aria-describedby');
  console.log('aria-labelledby points to:', document.getElementById(labelId));
  console.log('aria-describedby points to:', document.getElementById(descId));
}
```

### Focus Restoration Tests

| Test | Steps | Pass Criteria |
|------|-------|---------------|
| **FR-1: Button Trigger** | Click trigger button → Modal opens → Close modal | Focus returns to the trigger button |
| **FR-2: CTA Click Trigger** | Click `.cta-button` → Modal opens → Close modal | Focus returns to the clicked CTA button |
| **FR-3: Scroll Trigger** | Scroll to trigger slide-in → Close panel | Focus returns to `document.body` (no trigger element) |
| **FR-4: DOM Removal** | Open modal, remove trigger button from DOM while open, close modal | No error; focus defaults to body |

### iOS Safari Scroll Lock Tests

| Test | Steps | Pass Criteria |
|------|-------|---------------|
| **iOS-1: Lock on Open** | On iOS Safari, open modal | Background does NOT scroll when swiping |
| **iOS-2: No Bounce** | Modal open, swipe up/down on modal content | No "rubber band" bounce effect on body |
| **iOS-3: Position Restore** | Scroll to middle of page, open modal, close modal | Page returns to exact previous scroll position |
| **iOS-4: Multiple Opens** | Open modal, close, scroll, open again, close | Each time scroll position correctly saved/restored |

**Implementation Notes:**
```javascript
// iOS-safe scroll lock uses position:fixed
function lockBodyScroll() {
  savedScrollPosition = window.pageYOffset;
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = '-' + savedScrollPosition + 'px';
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}

function unlockBodyScroll() {
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, savedScrollPosition);
}
```

### Z-Index and Overlay Isolation Tests

| Test | Steps | Pass Criteria |
|------|-------|---------------|
| **Z-1: Above Host Modals** | Host page has z-index:9999 modal, open BloomSuite modal | BloomSuite modal appears on top |
| **Z-2: Overlay Click** | Click dark overlay area | Modal/panel closes |
| **Z-3: Content Click** | Click inside modal content | Modal does NOT close |
| **Z-4: Nested Forms** | Page has multiple BloomSuite embeds, open one | Only that modal's overlay is visible |

**Z-Index Values:**
| Layer | Z-Index |
|-------|---------|
| Modal overlay | `2147483640` |
| Slide-in panel | `2147483641` |

### Screen Reader Tests

| Test | Tool | Steps | Pass Criteria |
|------|------|-------|---------------|
| **SR-1: Open Announcement** | VoiceOver/NVDA | Open modal | Announces: "Form dialog opened. Press Escape to close." |
| **SR-2: Close Announcement** | VoiceOver/NVDA | Close modal | Announces: "Form dialog closed." |
| **SR-3: No Double Announce** | VoiceOver/NVDA | Open modal quickly twice | Only one announcement per state change |
| **SR-4: Title Read** | VoiceOver/NVDA | Open modal, navigate to title | Reads the form title as heading level 2 |
| **SR-5: Close Button** | VoiceOver/NVDA | Focus close button | Announces: "Close form, button" |

**Debounce Implementation:**
```javascript
var lastAnnouncement = '';
var lastAnnouncementTime = 0;

function announceToScreenReader(message) {
  var now = Date.now();
  if (message === lastAnnouncement && (now - lastAnnouncementTime) < 500) {
    return; // Skip duplicate
  }
  lastAnnouncement = message;
  lastAnnouncementTime = now;
  // ... create announcement element
}
```

---

## Code Verification Notes

### 1. Focus Trap Has Fallback Focus Target

**Location:** `embed.js` → `createFocusTrap()` → `setInitialFocus()`

```javascript
function setInitialFocus() {
  updateFocusableElements();
  var closeBtn = container.querySelector('[aria-label="Close form"]');
  if (closeBtn) {
    closeBtn.focus();
  } else if (firstFocusable) {
    firstFocusable.focus();
  } else {
    // Fallback: make container focusable temporarily
    container.setAttribute('tabindex', '-1');
    containerMadeFocusable = true;
    container.focus();
  }
}
```

**Cleanup removes temporary tabindex:**
```javascript
return function cleanup() {
  if (containerMadeFocusable) {
    container.removeAttribute('tabindex');
  }
  // ...
};
```

### 2. ESC Handler Only Fires When Modal Is Open AND Focus Inside

**Location:** `embed.js` → `createModalWrapper()` → `escHandler`

```javascript
var escHandler = function(e) {
  if (e.key === 'Escape') {
    // Check modal is open
    if (!overlay.classList.contains(CSS_PREFIX + 'open')) return;

    // Check focus is inside the modal OR on body (focus lost)
    var activeEl = document.activeElement;
    var focusInside = isElementInsideContainer(activeEl, overlay);
    var focusOnBody = activeEl === document.body || activeEl === document.documentElement;

    if (focusInside || focusOnBody) {
      e.preventDefault();
      e.stopPropagation();
      closeModal(modalId);
    }
  }
};
document.addEventListener('keydown', escHandler, true); // Capture phase
```

**Helper function:**
```javascript
function isElementInsideContainer(element, container) {
  var node = element;
  while (node) {
    if (node === container) return true;
    node = node.parentElement;
  }
  return false;
}
```

### 3. aria-labelledby and aria-describedby Point to Real Element IDs

**Modal:**
```javascript
overlay.setAttribute('aria-labelledby', modalId + '-title');
overlay.setAttribute('aria-describedby', modalId + '-desc');

var titleEl = createElement('h2', 'modal-title');
titleEl.id = modalId + '-title';  // ← Real element

var descEl = createElement('p', 'sr-only');
descEl.id = modalId + '-desc';    // ← Real element
descEl.textContent = 'Press Escape to close this dialog';
```

**Slide-in:**
```javascript
panel.setAttribute('aria-labelledby', panelId + '-title');
panel.setAttribute('aria-describedby', panelId + '-desc');

var title = createElement('h2', 'slidein-title');
title.id = panelId + '-title';    // ← Real element

var descEl = createElement('p', 'sr-only');
descEl.id = panelId + '-desc';    // ← Real element
```

### 4. Focus Restore Always Returns to Trigger Element

**Location:** `embed.js` → `createFocusTrap()` → cleanup function

```javascript
function createFocusTrap(container, closeCallback) {
  var previousActiveElement = document.activeElement;  // ← Captured on open

  // ... trap logic ...

  return function cleanup() {
    // Restore focus to previous element (the trigger)
    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
      try {
        if (document.contains(previousActiveElement)) {
          previousActiveElement.focus();
        }
      } catch (e) {
        // Element may no longer be focusable
      }
    }
  };
}
```

### 5. Background Scroll Lock Works on iOS Safari

**Location:** `embed.js` → `lockBodyScroll()` / `unlockBodyScroll()`

Uses `position: fixed` with scroll position tracking - the only reliable method for iOS Safari:

```javascript
var savedScrollPosition = 0;
var scrollLockCount = 0;  // Supports nested modals

function lockBodyScroll() {
  if (scrollLockCount === 0) {
    savedScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + savedScrollPosition + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }
  scrollLockCount++;
}

function unlockBodyScroll() {
  scrollLockCount--;
  if (scrollLockCount <= 0) {
    scrollLockCount = 0;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, savedScrollPosition);  // ← Restore position
  }
}
```

### 6. Z-Index and Overlay Isolation Prevents Host Collisions

**Location:** `embed.js` → `createModalWrapper()` / `createSlideInWrapper()`

```javascript
// Modal overlay
overlay.style.zIndex = '2147483640';  // Near max 32-bit signed int

// Slide-in panel
overlay.style.zIndex = '2147483640';
panel.style.zIndex = '2147483641';  // Panel above overlay
```

This ensures BloomSuite overlays appear above virtually any host page z-index.

---

## Display Trigger Configuration Schema

### Data Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `data-trigger` | string | Trigger type: `delay`, `scroll`, `click` |
| `data-delay` | number | Delay in milliseconds (for `delay` trigger) |
| `data-scroll-depth` | number | Scroll percentage 0-100 (for `scroll` trigger) |
| `data-click-selector` | string | CSS selector (for `click` trigger, modal only) |

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

---

## Accessibility Summary

### WCAG 2.1 Compliance

| Criterion | Level | Status | Notes |
|-----------|-------|--------|-------|
| 2.1.1 Keyboard | A | ✅ | All functions keyboard accessible |
| 2.1.2 No Keyboard Trap | A | ✅ | ESC always available to close |
| 2.4.3 Focus Order | A | ✅ | Logical tab order within dialogs |
| 2.4.7 Focus Visible | AA | ✅ | Browser default + custom outline |
| 4.1.2 Name, Role, Value | A | ✅ | ARIA roles and labels implemented |

### Tested Assistive Technologies

| Technology | Platform | Status |
|------------|----------|--------|
| VoiceOver | macOS/iOS | ✅ Tested |
| NVDA | Windows | ✅ Tested |
| JAWS | Windows | ⏳ Pending |
| TalkBack | Android | ⏳ Pending |

---

## Version History

| Version | Changes |
|---------|---------|
| 1.3.0 | Added iOS-safe scroll lock, ESC focus scope check, z-index isolation, announcement debouncing |
| 1.2.0 | Added display triggers (delay, scroll, click) |
| 1.1.0 | Added modal and slide-in display modes |
| 1.0.0 | Initial inline embed release |
