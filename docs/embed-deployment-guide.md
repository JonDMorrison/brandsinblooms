# BloomSuite embed.js Production Deployment Guide

## Recommended URL Pattern

```
https://cdn.bloomsuite.app/forms/embed.v1.0.0.js
```

Or using Supabase Storage directly:

```
https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/scripts/embed.v1.0.0.js
```

---

## Hosting Options

### Option 1: Supabase Storage (Recommended)

**Why?**
- Already integrated with BloomSuite infrastructure
- Global CDN via Supabase's edge network
- No additional cost
- Easy to update via dashboard or CLI

**Setup Steps:**

1. **Create the folder structure in Supabase Storage:**
   ```
   assets/
   └── scripts/
       └── embed.v1.0.0.js
   ```

2. **Upload via Supabase Dashboard:**
   - Go to Storage → `assets` bucket
   - Create `scripts` folder if it doesn't exist
   - Upload `embed.v1.0.0.js`
   - Ensure the bucket is **public**

3. **Upload via Supabase CLI:**
   ```bash
   supabase storage cp public/forms/embed.v1.0.0.js storage://assets/scripts/embed.v1.0.0.js
   ```

4. **Resulting URL:**
   ```
   https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/scripts/embed.v1.0.0.js
   ```

### Option 2: Custom Domain with CDN Proxy

**Why?**
- Branded URL (e.g., `cdn.bloomsuite.app`)
- Additional caching layer
- Easier to switch backends later

**Setup Steps:**

1. **Configure DNS:**
   Add a CNAME record:
   ```
   cdn.bloomsuite.app → your-cdn-provider.com
   ```

2. **CDN Configuration (Cloudflare example):**
   - Origin: `udldmkqwnxhdeztyqcau.supabase.co`
   - Cache TTL: 1 year (versioned files)
   - Enable compression (gzip/brotli)

3. **Rewrite rules:**
   ```
   /forms/embed.v*.js → /storage/v1/object/public/assets/scripts/embed.v*.js
   ```

---

## Versioning Strategy

### Semantic Versioning

| Version | File Name | When to Use |
|---------|-----------|-------------|
| Major | `embed.v2.0.0.js` | Breaking changes |
| Minor | `embed.v1.1.0.js` | New features (backward compatible) |
| Patch | `embed.v1.0.1.js` | Bug fixes only |

### Latest Pointer (Optional)

For customers who want auto-updates, provide an alias:

```
embed.latest.js → embed.v1.0.0.js (symbolic link or redirect)
```

**Warning:** Not recommended for production use due to potential breaking changes.

---

## Cache Headers

### For Versioned Files (`embed.v1.0.0.js`)

```
Cache-Control: public, max-age=31536000, immutable
```

- 1 year cache (31536000 seconds)
- `immutable` prevents revalidation
- Version bump = new URL = cache bust

### For Unversioned/Latest Files (`embed.js`)

```
Cache-Control: public, max-age=3600, must-revalidate
```

- 1 hour cache
- Forces revalidation after expiry

### Supabase Storage Default

Supabase Storage sets:
```
Cache-Control: public, max-age=3600
```

To customize, use a CDN proxy layer.

---

## Customer Embed Snippet

### Production Snippet

```html
<!-- BloomSuite Form Embed -->
<div data-bloomsuite-form="YOUR_EMBED_KEY"></div>
<script src="https://cdn.bloomsuite.app/forms/embed.v1.0.0.js" async></script>
```

### With Supabase Storage URL

```html
<!-- BloomSuite Form Embed -->
<div data-bloomsuite-form="YOUR_EMBED_KEY"></div>
<script 
  src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/scripts/embed.v1.0.0.js" 
  async
></script>
```

### With Subresource Integrity (SRI)

For security-conscious customers:

```html
<script 
  src="https://cdn.bloomsuite.app/forms/embed.v1.0.0.js" 
  integrity="sha384-HASH_HERE"
  crossorigin="anonymous"
  async
></script>
```

Generate hash:
```bash
cat embed.v1.0.0.js | openssl dgst -sha384 -binary | openssl base64 -A
```

---

## Content Security Policy (CSP)

Customers embedding the form need these CSP directives:

```
script-src: https://cdn.bloomsuite.app (or Supabase URL)
connect-src: https://udldmkqwnxhdeztyqcau.supabase.co
style-src: 'unsafe-inline'
```

### Full Example

```
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' https://cdn.bloomsuite.app;
  connect-src 'self' https://udldmkqwnxhdeztyqcau.supabase.co;
  style-src 'self' 'unsafe-inline';
```

---

## Deployment Checklist

### Before Release

- [ ] Version number updated in code (`VERSION` constant)
- [ ] File renamed to `embed.v{X.Y.Z}.js`
- [ ] Minification applied (optional but recommended)
- [ ] SRI hash generated
- [ ] Tested on staging

### Upload to Production

- [ ] Upload to Supabase Storage
- [ ] Verify public access
- [ ] Test embed on external domain
- [ ] Update customer documentation

### Post-Release

- [ ] Notify customers of new version (if breaking changes)
- [ ] Monitor error logs for 24 hours
- [ ] Keep previous version available for rollback

---

## Rollback Procedure

1. Customers continue using old version URL (versioned files never change)
2. Update documentation to previous version
3. Investigate and fix issues in new version
4. Release as patch version

---

## Monitoring

### Recommended Metrics

- **Load success rate**: % of forms that initialize successfully
- **Submission success rate**: % of submissions that complete
- **Error types**: BLOCKED, Timeout, Network error
- **Version adoption**: % of traffic per version

### Supabase Logs

Check Edge Function logs for:
- `get-form-config` call volume
- `submit-form` success/error rates

---

## File Size Budget

| Metric | Target | Current |
|--------|--------|---------|
| Uncompressed | < 20 KB | ~14 KB |
| Gzipped | < 5 KB | ~4 KB |
| Brotli | < 4 KB | ~3.5 KB |

---

## Summary

| Item | Recommendation |
|------|----------------|
| **Hosting** | Supabase Storage (public bucket) |
| **URL** | `https://cdn.bloomsuite.app/forms/embed.v1.0.0.js` |
| **Cache** | 1 year for versioned, 1 hour for latest |
| **Versioning** | Semantic (v1.0.0, v1.1.0, v2.0.0) |
| **Updates** | Upload new version, update docs |
