# BloomSuite Form Embed Guide

## Quick Start

Add this code to any webpage to embed a BloomSuite form:

```html
<!-- 1. Add the container where you want the form -->
<div data-bloomsuite-form="YOUR_EMBED_KEY_HERE"></div>

<!-- 2. Load the embed script (before </body>) -->
<script src="https://brandsinblooms.lovable.app/forms/embed.js" async></script>
```

Replace `YOUR_EMBED_KEY_HERE` with your form's 32-character embed key.

---

## Multiple Forms on One Page

You can embed multiple forms on the same page:

```html
<!-- Newsletter signup -->
<div data-bloomsuite-form="a1b2c3d4e5f6789012345678901234ab"></div>

<!-- Contact form -->
<div data-bloomsuite-form="c3d4e5f6789012345678901234ab1234"></div>

<!-- Single script handles all forms -->
<script src="https://brandsinblooms.lovable.app/forms/embed.js" async></script>
```

---

## Complete Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter Signup</title>
</head>
<body>
  <main>
    <h1>Join Our Newsletter</h1>
    <p>Get weekly gardening tips delivered to your inbox.</p>
    
    <!-- BloomSuite Form -->
    <div 
      data-bloomsuite-form="a1b2c3d4e5f6789012345678901234ab"
      style="max-width: 480px; margin: 0 auto;"
    ></div>
  </main>

  <!-- Load embed script -->
  <script src="https://brandsinblooms.lovable.app/forms/embed.js" async></script>
</body>
</html>
```

---

## How It Works

1. **Script loads** → Finds all `[data-bloomsuite-form]` divs
2. **Fetches config** → Calls `get-form-config?embed_key=...` 
3. **Renders form** → Creates scoped HTML with `bs-form-*` classes
4. **Handles submission** → POSTs to `submit-form` with:
   ```json
   {
     "embed_key": "a1b2c3d4...",
     "data": {
       "email": "user@example.com",
       "first_name": "Jane",
       "email_consent": true
     },
     "meta": {
       "page_url": "https://example.com/signup",
       "referrer": "https://google.com",
       "utm_source": "google",
       "utm_medium": "cpc",
       "utm_campaign": "spring2024",
       "user_agent": "Mozilla/5.0..."
     }
   }
   ```
5. **Shows result** → Success message OR redirects to `success_redirect_url`

---

## Features

| Feature | Implementation |
|---------|----------------|
| **No iframe** | Inline DOM rendering for full styling control |
| **Scoped CSS** | All classes prefixed `bs-form-*` to avoid conflicts |
| **Multiple forms** | Each `[data-bloomsuite-form]` initialized independently |
| **Consent checkboxes** | NEVER pre-checked (CASL/TCPA compliant) |
| **Ad-blocker fallback** | Shows friendly message if blocked |
| **Zero dependencies** | Pure vanilla JavaScript |
| **Spam protection** | Hidden honeypot field |
| **Theme support** | Respects form's primary color, border radius, button style |

---

## UTM Tracking

The embed script automatically captures UTM parameters from the page URL:

```
https://example.com/signup?utm_source=google&utm_medium=cpc&utm_campaign=spring2024
```

These are sent in the `meta` object:
- `utm_source`
- `utm_medium`
- `utm_campaign`

---

## Content Security Policy (CSP)

If your site uses a strict CSP, add these directives:

### Minimal CSP
```http
Content-Security-Policy: 
  script-src 'self' https://brandsinblooms.lovable.app;
  connect-src 'self' https://udldmkqwnxhdeztyqcau.supabase.co;
  style-src 'self' 'unsafe-inline';
```

### Detailed Breakdown

| Directive | Required Value | Why |
|-----------|----------------|-----|
| `script-src` | `https://brandsinblooms.lovable.app` | Load embed.js |
| `connect-src` | `https://udldmkqwnxhdeztyqcau.supabase.co` | API calls to get-form-config and submit-form |
| `style-src` | `'unsafe-inline'` | Injected scoped CSS styles |

### Example with Nonce (stricter)
```html
<script nonce="abc123" src="https://brandsinblooms.lovable.app/forms/embed.js"></script>
```

```http
Content-Security-Policy: script-src 'nonce-abc123';
```

---

## Script Hosting Options

### Option 1: CDN (Recommended)
```html
<script src="https://brandsinblooms.lovable.app/forms/embed.js" async></script>
```

### Option 2: Self-Host
Download `embed.js` and host on your own domain:
```html
<script src="/js/bloomsuite-embed.js" async></script>
```

If self-hosting, set the API base before loading:
```html
<script>
  window.BLOOMSUITE_API_BASE = 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1';
</script>
<script src="/js/bloomsuite-embed.js" async></script>
```

---

## Subresource Integrity (SRI)

For maximum security, use SRI hash:
```html
<script 
  src="https://brandsinblooms.lovable.app/forms/embed.js"
  integrity="sha384-HASH_HERE"
  crossorigin="anonymous"
  async
></script>
```

Generate hash with:
```bash
cat embed.js | openssl dgst -sha384 -binary | openssl base64 -A
```

---

## JavaScript API

The embed script exposes a global API:

```javascript
// Version info
console.log(BloomSuiteForms.version); // "1.0.0"

// Manually initialize all forms
BloomSuiteForms.init();

// Initialize a specific container
var container = document.getElementById('my-form');
BloomSuiteForms.initForm(container);
```

### Dynamic Form Loading
```javascript
// Add form after page load
var div = document.createElement('div');
div.setAttribute('data-bloomsuite-form', 'a1b2c3d4...');
document.body.appendChild(div);

// Initialize it
BloomSuiteForms.initForm(div);
```

---

## Troubleshooting

### Form Shows "Form Blocked"
- **Cause**: Ad blocker blocking Supabase API calls
- **Fix**: Whitelist `udldmkqwnxhdeztyqcau.supabase.co` or disable ad blocker

### Form Shows "Form not found"
- **Cause**: Invalid embed key or form not published
- **Fix**: Verify embed key is correct and form status is "published"

### Form Doesn't Load (blank div)
- **Cause**: Script blocked by CSP
- **Fix**: Add required CSP directives (see above)

### Styles Look Wrong
- **Cause**: CSS conflicts with page styles
- **Fix**: The `bs-form-*` prefix should prevent most conflicts. If issues persist, wrap in an iframe.

### Submission Shows Error
- **Cause**: Consent required but not provided
- **Fix**: Ensure user checks consent checkboxes (cannot be pre-checked)

---

## Browser Support

| Browser | Minimum Version | Notes |
|---------|-----------------|-------|
| Chrome | 60+ | Full support |
| Firefox | 55+ | Full support |
| Safari | 11+ | Full support |
| Edge | 79+ (Chromium) | Full support |
| IE 11 | ❌ | Not supported (no URLSearchParams) |

---

## Changelog

### v1.0.0 (2026-01-28)
- Initial release
- CASL/TCPA compliant consent checkboxes
- UTM tracking
- Honeypot spam protection
- Theme support
- Ad-blocker fallback
