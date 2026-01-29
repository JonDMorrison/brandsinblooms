# Embed.js Versioning and Hosting

This document defines the official versioning scheme, URLs, and cache policies for the BloomSuite embed script.

## Version Scheme

| File | Version | Purpose | Cache Policy |
|------|---------|---------|--------------|
| `embed.js` | Latest (1.4.0) | Development/staging | `max-age=60` (1 min) |
| `embed.v1.js` | Latest v1.x (1.4.0) | Major version pin | `max-age=3600` (1 hour) |
| `embed.v1.4.0.js` | 1.4.0 (immutable) | Exact version pin | `max-age=31536000, immutable` |
| `embed.v1.3.0.js` | 1.3.0 (immutable) | Legacy support | `max-age=31536000, immutable` |
| `embed.v1.0.0.js` | 1.0.0 (immutable) | Legacy support | `max-age=31536000, immutable` |
| `embed.v1.0.1.js` | 1.0.1 (immutable) | Legacy support | `max-age=31536000, immutable` |

## Official URLs

### Production (Recommended)

| Use Case | URL |
|----------|-----|
| **Major Pin (Recommended)** | `https://brandsinblooms.lovable.app/forms/embed.v1.js` |
| **Immutable Pin** | `https://brandsinblooms.lovable.app/forms/embed.v1.3.0.js` |
| **Latest (Dev Only)** | `https://brandsinblooms.lovable.app/forms/embed.js` |

### Preview/Staging

| Use Case | URL |
|----------|-----|
| **Latest Preview** | `https://id-preview--be93ec50-2043-42c4-b91c-5d7c30f0ef2d.lovable.app/forms/embed.js` |

## Version Matching

**CRITICAL**: The `SCRIPT_VERSION` constant in each file MUST match the filename version.

| File | Required `SCRIPT_VERSION` |
|------|---------------------------|
| `embed.js` | `'1.4.0'` |
| `embed.v1.js` | `'1.4.0'` (latest v1.x) |
| `embed.v1.4.0.js` | `'1.4.0'` |
| `embed.v1.3.0.js` | `'1.3.0'` |
| `embed.v1.0.0.js` | `'1.0.0'` |
| `embed.v1.0.1.js` | `'1.0.1'` |

## Embedding Instructions

### Recommended: Major Version Pin

```html
<!-- Use v1.js for automatic minor/patch updates -->
<script src="https://brandsinblooms.lovable.app/forms/embed.v1.js" defer></script>

<div data-bloomsuite-form="YOUR_EMBED_KEY_HERE"></div>
```

### Strict: Immutable Version Pin

```html
<!-- Use exact version for guaranteed consistency -->
<script src="https://brandsinblooms.lovable.app/forms/embed.v1.4.0.js" defer></script>

<div data-bloomsuite-form="YOUR_EMBED_KEY_HERE"></div>
```

### Development Only

```html
<!-- Use for testing only - may change frequently -->
<script src="https://brandsinblooms.lovable.app/forms/embed.js" defer></script>
```

## Cache Headers

### CDN/Server Configuration

For Netlify/Vercel/Cloudflare, configure headers:

```toml
# netlify.toml example
[[headers]]
  for = "/forms/embed.v*.*.*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/forms/embed.v1.js"
  [headers.values]
    Cache-Control = "public, max-age=3600"

[[headers]]
  for = "/forms/embed.js"
  [headers.values]
    Cache-Control = "public, max-age=60"
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.4.0 | 2026-01-29 | MutationObserver for late-loaded containers, fail-loud error UI, debug mode, idempotent init |
| 1.3.0 | 2026-01-29 | iOS scroll lock, ESC focus scope, z-index isolation, SR debounce |
| 1.2.0 | 2026-01-28 | Display triggers (delay, scroll, click) |
| 1.1.0 | 2026-01-27 | Display modes (modal, slide-in) |
| 1.0.1 | 2026-01-15 | Bug fixes, CSP improvements |
| 1.0.0 | 2026-01-10 | Initial release (inline forms) |

## Release Process

When releasing a new version:

1. **Update `embed.js`**: Increment `SCRIPT_VERSION` and add changes
2. **Create immutable copy**: `cp embed.js embed.v1.X.Y.js`
3. **Update major alias**: `cp embed.js embed.v1.js`
4. **Update docs**: Add version to history table
5. **Deploy**: Publish to production

## Troubleshooting

### Check Installed Version

```javascript
console.log('BloomSuite version:', window.BloomSuiteForms?.version);
console.log('Full config:', window.BloomSuiteForms?.getConfig());
```

### Force Cache Refresh

```html
<!-- Add cache-buster for emergency fixes -->
<script src="https://brandsinblooms.lovable.app/forms/embed.v1.js?v=1706540000" defer></script>
```

### Version Mismatch Detection

```javascript
// In browser console
fetch('/forms/embed.v1.js')
  .then(r => r.text())
  .then(t => {
    const match = t.match(/SCRIPT_VERSION = '([^']+)'/);
    console.log('File version:', match?.[1]);
  });
```

---

## Non-Technical Troubleshooting Guide

### "Form shows nothing / blank container"

**Most common cause: Script loaded too early**

The embed script runs once when the page loads. If your site builder adds the form container *after* the script runs, the form won't render.

**Solution 1 (Recommended): Use `defer` instead of `async`**

```html
<!-- ❌ Bad: async may run before container exists -->
<script src=".../embed.v1.js" async></script>

<!-- ✅ Good: defer waits for DOM -->
<script src=".../embed.v1.js" defer></script>
```

**Solution 2: Manually re-initialize**

If your site builder injects the container after page load, add this after the container:

```html
<div data-bloomsuite-form="YOUR_KEY"></div>
<script>
  // Wait for BloomSuite to be available, then init
  if (window.BloomSuiteForms) {
    window.BloomSuiteForms.init();
  }
</script>
```

**Solution 3 (v1.4.0+): Automatic detection**

Version 1.4.0+ includes a MutationObserver that automatically detects late-added containers. If you're using an older version, upgrade to v1.4.0+.

---

### "Form shows error: Form Could Not Load"

**Causes:**
1. **Ad blocker** is blocking API requests
2. **Content Security Policy (CSP)** is blocking the connection
3. **Firewall/proxy** is blocking the BloomSuite API

**Solutions:**
- Disable ad blocker for your site
- Add `connect-src https://udldmkqwnxhdeztyqcau.supabase.co` to your CSP
- Contact your IT team about firewall rules

---

### "Form shows error: Form Not Available"

**Causes:**
1. The embed key is incorrect
2. The form is not published

**Solutions:**
- Copy the embed code again from BloomSuite dashboard
- Check that the form status is set to **Published**
- Verify the 32-character key matches exactly

---

### Enable Debug Mode

Add `data-debug="true"` to see diagnostic information:

```html
<div 
  data-bloomsuite-form="YOUR_KEY" 
  data-debug="true"
></div>
```

This displays:
- Script version
- API base URL
- Request status
- Whether the request was blocked

## CSP Requirements

The embed script requires these Content-Security-Policy directives:

```
script-src 'self' https://brandsinblooms.lovable.app;
style-src 'self' https://brandsinblooms.lovable.app;
connect-src 'self' https://udldmkqwnxhdeztyqcau.supabase.co;
```

For strict CSP environments, the script includes fallback inline styles that may require `'unsafe-inline'` for style-src, but the external CSS approach is preferred.