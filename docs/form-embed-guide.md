# BloomSuite Form Embed Guide

## Quick Start

Add this code to any webpage to embed a BloomSuite form:

```html
<!-- 1. Add the container where you want the form -->
<div data-bloomsuite-form="YOUR_EMBED_KEY_HERE"></div>

<!-- 2. Load the embed script (before </body>) -->
<script src="https://forms.bloomsuite.com/embed.js" async></script>
```

Replace `YOUR_EMBED_KEY_HERE` with your form's 32-character embed key.

---

## Script Versioning

BloomSuite provides three URL patterns for embed.js:

| URL | Description | Cache | Use Case |
|-----|-------------|-------|----------|
| `/embed.js` | **Stable channel** (alias for latest v1.x.x) | 1 hour | Recommended for most sites |
| `/embed.v1.js` | **Major version alias** (latest v1.x.x) | 1 hour | Pin to major version |
| `/embed.v1.0.0.js` | **Pinned version** (immutable) | 1 year | Maximum stability |

### Recommended (Auto-Updates)
```html
<script src="https://forms.bloomsuite.com/embed.js" async></script>
```

### Pinned (Never Changes)
```html
<script src="https://forms.bloomsuite.com/embed.v1.0.0.js" async></script>
```

> **Note**: Pinned versions are immutable and cached for 1 year. Use for sites requiring strict change control.

---

## Multiple Forms on One Page

You can embed multiple forms on the same page:

```html
<!-- Newsletter signup -->
<div data-bloomsuite-form="a1b2c3d4e5f6789012345678901234ab"></div>

<!-- Contact form -->
<div data-bloomsuite-form="c3d4e5f6789012345678901234ab1234"></div>

<!-- Single script handles all forms -->
<script src="https://forms.bloomsuite.com/embed.js" async></script>
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
  <script src="https://forms.bloomsuite.com/embed.js" async></script>
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

BloomSuite forms are designed to work with strict CSP policies. The embed script loads an external CSS file from the same origin, avoiding the need for `'unsafe-inline'` styles.

### Minimal CSP (Recommended)
```http
Content-Security-Policy: 
  script-src 'self' https://forms.bloomsuite.com;
  style-src 'self' https://forms.bloomsuite.com;
  connect-src 'self' https://api.bloomsuite.com;
```

### Detailed Breakdown

| Directive | Required Value | Why |
|-----------|----------------|-----|
| `script-src` | `https://forms.bloomsuite.com` | Load embed.js |
| `style-src` | `https://forms.bloomsuite.com` | Load embed.css (external stylesheet) |
| `connect-src` | `https://api.bloomsuite.com` | API calls to get-form-config and submit-form |

> **Note**: `'unsafe-inline'` for styles is **NOT required**. The form loads styles from an external CSS file.

### Fallback Mode

If the external CSS fails to load (due to network issues or CSP blocking the stylesheet):
1. The script attempts to inject minimal inline fallback styles
2. If inline styles are also blocked, the form renders with browser default styling
3. **Forms remain fully functional** in all cases

### Example with Nonce (strictest)
```html
<script nonce="abc123" src="https://forms.bloomsuite.com/embed.js"></script>
```

```http
Content-Security-Policy: 
  script-src 'nonce-abc123';
  style-src https://forms.bloomsuite.com;
  connect-src https://api.bloomsuite.com;
```

### Self-Hosted CSP

If self-hosting embed.js and embed.css on your domain:
```http
Content-Security-Policy: 
  script-src 'self';
  style-src 'self';
  connect-src https://api.bloomsuite.com;
```

---

## Hosting Options

### Option 1: BloomSuite CDN (Recommended)
```html
<!-- Stable channel - auto-updates to latest v1.x.x -->
<script src="https://forms.bloomsuite.com/embed.js" async></script>

<!-- OR pinned version - never changes -->
<script src="https://forms.bloomsuite.com/embed.v1.0.0.js" async></script>
```

### Option 2: Self-Host
Download `embed.js` and host on your own domain:
```html
<script src="/js/bloomsuite-embed.js" async></script>
```

If self-hosting, set the API base before loading:
```html
<script>
  window.BLOOMSUITE_API_BASE = 'https://api.bloomsuite.com';
</script>
<script src="/js/bloomsuite-embed.js" async></script>
```

---

## Subresource Integrity (SRI)

For maximum security, use SRI hash with pinned versions:
```html
<script 
  src="https://forms.bloomsuite.com/embed.v1.0.0.js"
  integrity="sha384-HASH_HERE"
  crossorigin="anonymous"
  async
></script>
```

> **Note**: SRI should only be used with pinned versions (`embed.v1.0.0.js`), not the stable channel which may update.

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
- **Cause**: Ad blocker blocking API calls
- **Fix**: Whitelist `api.bloomsuite.com` or disable ad blocker

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

## Deployment Implementation Notes

### Current Stack (Lovable + Vite)

The embed.js files are served from the `public/forms/` directory:

```
public/forms/
├── embed.js          # Stable channel (copied from latest v1.x.x)
├── embed.v1.js       # Major version alias (copied from latest v1.x.x)
└── embed.v1.0.0.js   # Pinned v1.0.0 (immutable)
```

### Cache Headers (public/_headers)

```
# Pinned versions - immutable, cache for 1 year
/forms/embed.v*.*.*.js
  Cache-Control: public, max-age=31536000, immutable

# Stable/alias versions - short cache with revalidation
/forms/embed.js
  Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```

### Release Process

When releasing a new version (e.g., v1.1.0):

1. Create `public/forms/embed.v1.1.0.js` with new code
2. Copy to `public/forms/embed.js` (stable channel)
3. Copy to `public/forms/embed.v1.js` (major version alias)
4. Update `SCRIPT_VERSION` constant in the new file
5. Publish to production

### Production Domain Setup

For production, configure a custom domain (e.g., `forms.bloomsuite.com`) pointing to the Lovable app, or use a CDN like Cloudflare/Fastly with:

| Current (Development) | Production Target |
|-----------------------|-------------------|
| `brandsinblooms.lovable.app/forms/` | `forms.bloomsuite.com/` |
| Supabase functions URL | `api.bloomsuite.com/` |

### Final Production URLs

| URL | Description |
|-----|-------------|
| `https://forms.bloomsuite.com/embed.js` | Stable channel |
| `https://forms.bloomsuite.com/embed.css` | External stylesheet |
| `https://forms.bloomsuite.com/embed.v1.js` | Major version alias |
| `https://forms.bloomsuite.com/embed.v1.0.1.js` | Pinned v1.0.1 |

---

## Changelog

### v1.0.1 (2026-01-28)
- **CSP-friendly**: Moved styles to external `embed.css` file
- No longer requires `'unsafe-inline'` in style-src directive
- Added fallback mode for environments where CSS fails to load
- Forms remain functional with browser default styling in strictest CSP environments

### v1.0.0 (2026-01-28)
- Initial release
- CASL/TCPA compliant consent checkboxes
- UTM tracking
- Honeypot spam protection
- Theme support
- Ad-blocker fallback
