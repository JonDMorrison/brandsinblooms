# Embed.js Versioning and Hosting

This document defines the official versioning scheme, URLs, and cache policies for the BloomSuite embed script.

---

## ⚠️ IMPORTANT: Use Supabase Storage URLs

Many third-party website builders (Wix, Squarespace, Webflow, etc.) **block scripts from `*.lovableproject.com`** domains. To ensure forms work everywhere, **always use the Supabase Storage URLs** listed below.

---

## Version Scheme

| File | Version | Purpose | Cache Policy |
|------|---------|---------|--------------|
| `embed.js` | Latest (1.5.0) | Development/staging | `max-age=3600` |
| `embed.v1.js` | Latest v1.x (1.5.0) | Major version pin | `max-age=3600` |
| `embed.v1.5.0.js` | 1.5.0 (immutable) | Exact version pin | `max-age=31536000, immutable` |
| `embed.v1.4.0.js` | 1.4.0 (immutable) | Legacy support | `max-age=31536000, immutable` |
| `embed.css` | N/A | Styles (auto-loaded) | `max-age=31536000, immutable` |

---

## Official URLs

### 🟢 Production — Supabase Storage (RECOMMENDED)

These URLs work in **all website builders** including Wix, Squarespace, Webflow, etc.

| Use Case | URL |
|----------|-----|
| **Major Pin (Recommended)** | `https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.js` |
| **Immutable Pin** | `https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.5.0.js` |
| **CSS (auto-loaded)** | `https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.css` |

### 🟡 Lovable URLs (May Be Blocked)

These URLs may be blocked by website builders. Use only for testing.

| Use Case | URL |
|----------|-----|
| Latest Preview | `https://brandsinblooms.lovable.app/forms/embed.js` |
| Preview | `https://id-preview--be93ec50-2043-42c4-b91c-5d7c30f0ef2d.lovable.app/forms/embed.js` |

---

## Embedding Instructions

### ✅ Recommended: Supabase Storage (Works Everywhere)

```html
<!-- BloomSuite Form Embed -->
<div data-bloomsuite-form="YOUR_EMBED_KEY"></div>
<script 
  src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.js" 
  defer
></script>
```

### ✅ Pinned Version (Production-Critical Sites)

```html
<!-- BloomSuite Form Embed - Pinned to v1.5.0 -->
<div data-bloomsuite-form="YOUR_EMBED_KEY"></div>
<script 
  src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.5.0.js" 
  defer
></script>
```

### Debug Mode

```html
<div 
  data-bloomsuite-form="YOUR_EMBED_KEY" 
  data-debug="true"
></div>
<script 
  src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.js" 
  defer
></script>
```

---

## Advanced: Override CSS URL

If CSS auto-detection fails, you can explicitly set the CSS URL:

```html
<script>
  window.BLOOMSUITE_CSS_URL = 'https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.css';
</script>
<div data-bloomsuite-form="YOUR_EMBED_KEY"></div>
<script 
  src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.js" 
  defer
></script>
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.5.0 | 2026-01-29 | Supabase Storage hosting support, CSS_URL override, improved base path detection |
| 1.4.0 | 2026-01-29 | MutationObserver for late-loaded containers, fail-loud error UI, debug mode |
| 1.3.0 | 2026-01-29 | iOS scroll lock, ESC focus scope, z-index isolation |
| 1.2.0 | 2026-01-28 | Display triggers (delay, scroll, click) |
| 1.1.0 | 2026-01-27 | Display modes (modal, slide-in) |
| 1.0.1 | 2026-01-15 | Bug fixes, CSP improvements |
| 1.0.0 | 2026-01-10 | Initial release (inline forms) |

---

## Troubleshooting

### "Form shows nothing / blank container"

**Most common cause: Script blocked by website builder**

Many builders block `*.lovableproject.com` domains.

**Solution: Use Supabase Storage URL**

```html
<!-- ❌ May be blocked -->
<script src="https://brandsinblooms.lovable.app/forms/embed.v1.js" defer></script>

<!-- ✅ Works everywhere -->
<script src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.js" defer></script>
```

### "Script loads but form is still blank"

**Cause: Container added after script runs**

**Solution 1: Use `defer` (not `async`)**

```html
<!-- ❌ Bad: async may run before container exists -->
<script src=".../embed.v1.js" async></script>

<!-- ✅ Good: defer waits for DOM -->
<script src=".../embed.v1.js" defer></script>
```

**Solution 2: Manually trigger init**

```html
<div data-bloomsuite-form="YOUR_KEY"></div>
<script>
  if (window.BloomSuiteForms) {
    window.BloomSuiteForms.init();
  }
</script>
```

### "Form shows error: Form Could Not Load"

**Causes:**
1. Ad blocker blocking API requests
2. Content Security Policy blocking the connection

**Solutions:**
- Disable ad blocker for your site
- Add to CSP: `connect-src https://udldmkqwnxhdeztyqcau.supabase.co`

### "CSS not loading / form looks unstyled"

**Cause: CSS file not found at expected path**

The script auto-detects its base path and loads `embed.css` from the same directory.

**Solution: Override CSS URL explicitly**

```html
<script>
  window.BLOOMSUITE_CSS_URL = 'https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.css';
</script>
```

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
- CSS URL being used
- Request status

---

## CSP Requirements

For sites with Content Security Policy:

```
script-src 'self' https://udldmkqwnxhdeztyqcau.supabase.co;
style-src 'self' https://udldmkqwnxhdeztyqcau.supabase.co;
connect-src 'self' https://udldmkqwnxhdeztyqcau.supabase.co;
```

---

## Deployment

### Manual Upload

1. Go to [Supabase Storage](https://supabase.com/dashboard/project/udldmkqwnxhdeztyqcau/storage/buckets/assets)
2. Navigate to `forms/` folder
3. Upload files from `public/forms/`:
   - `embed.js`
   - `embed.v1.js`
   - `embed.v1.5.0.js`
   - `embed.css`

### Automated Deployment

```bash
# Set service role key
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run deployment script
bun run scripts/deploy-embed-assets.ts
```

---

## Release Process

When releasing a new version:

1. **Update `embed.js`**: Increment `SCRIPT_VERSION` and add changes
2. **Create immutable copy**: `cp embed.js embed.v1.X.Y.js`
3. **Update major alias**: `cp embed.js embed.v1.js`
4. **Update docs**: Add version to history table
5. **Deploy to Supabase Storage**: Run `bun run scripts/deploy-embed-assets.ts`
6. **Verify**: Test URLs return HTTP 200
