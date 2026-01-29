# BloomSuite Embed.js — Supabase Storage Deployment Guide

## Overview

This guide explains how to host BloomSuite embed scripts on Supabase Storage to bypass domain-blocking restrictions in third-party website builders (Wix, Squarespace, etc.) that block `lovableproject.com` domains.

---

## Production URLs

After deployment, customers use these URLs:

```
https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.js
https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.css
```

For pinned versions:
```
https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.4.0.js
```

---

## Build Artifacts

The following files are located in `/public/forms/`:

| File | Purpose | Cache Strategy |
|------|---------|----------------|
| `embed.v1.4.0.js` | Immutable pinned version | 1 year, immutable |
| `embed.v1.js` | Major version alias (auto-updates within v1.x.x) | 1 hour + revalidate |
| `embed.css` | Styles for all embed versions | 1 year, immutable |

---

## Deployment Steps

### Step 1: Ensure `assets` Bucket Exists

The `assets` bucket should already exist. If not, create it:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;
```

### Step 2: Upload Files via Supabase Dashboard

1. Go to **Storage** → **assets** bucket
2. Create folder: `forms` (if it doesn't exist)
3. Upload these files from `public/forms/`:
   - `embed.v1.4.0.js`
   - `embed.v1.js`
   - `embed.css`

### Step 3: Upload via Supabase CLI (Alternative)

```bash
# From project root
supabase storage cp public/forms/embed.v1.4.0.js storage://assets/forms/embed.v1.4.0.js
supabase storage cp public/forms/embed.v1.js storage://assets/forms/embed.v1.js
supabase storage cp public/forms/embed.css storage://assets/forms/embed.css
```

### Step 4: Verify Public Access

Test each URL in browser:

```
https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.js
https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.css
```

Both should return file contents (not 404 or auth error).

---

## Customer Embed Snippet

### Recommended (Auto-Updates)

```html
<div data-bloomsuite-form="YOUR_EMBED_KEY"></div>
<script 
  src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.js" 
  defer
></script>
```

### Pinned Version (Production-Critical)

```html
<div data-bloomsuite-form="YOUR_EMBED_KEY"></div>
<script 
  src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.4.0.js" 
  defer
></script>
```

### With Debug Mode

```html
<div data-bloomsuite-form="YOUR_EMBED_KEY" data-debug="true"></div>
<script 
  src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.js" 
  defer
></script>
```

---

## How CSS Loading Works

The embed script automatically:

1. Detects its own URL (via `document.currentScript.src`)
2. Derives the base path: `/storage/v1/object/public/assets/forms/`
3. Loads `embed.css` from the same path

**Result:** CSS loads from Supabase Storage automatically. No separate CSS link tag needed.

---

## Version Update Procedure

When releasing a new version (e.g., v1.5.0):

1. Update version constant in `public/forms/embed.js`
2. Copy to `public/forms/embed.v1.5.0.js`
3. Copy to `public/forms/embed.v1.js` (alias)
4. Upload all three files to Supabase Storage:
   - `assets/forms/embed.v1.5.0.js` (new)
   - `assets/forms/embed.v1.js` (overwrite)
   - `assets/forms/embed.css` (if changed)

Customers using `embed.v1.js` get the update automatically.

---

## Troubleshooting

### Form Shows "Loading..." Forever

1. Check browser console for CORS or network errors
2. Verify the embed key is correct and form is published
3. Enable debug mode: `data-debug="true"`

### CSS Not Loading

1. Verify `embed.css` exists in Supabase Storage at same path as JS
2. Check browser Network tab for 404
3. The script auto-derives CSS path from its own URL

### Script Blocked by Site Builder

Some builders (Wix) have aggressive script blocking. Solutions:

1. Ensure using Supabase Storage URL (not lovableproject.com)
2. Use `defer` attribute (not `async`)
3. Place script at end of `<body>`

### "BLOCKED" Error in Form

Request was blocked by ad-blocker or CSP. Solutions:

1. Whitelist `supabase.co` domain in ad-blocker
2. Add to site's CSP:
   ```
   script-src: https://udldmkqwnxhdeztyqcau.supabase.co
   connect-src: https://udldmkqwnxhdeztyqcau.supabase.co
   style-src: 'unsafe-inline'
   ```

---

## Storage RLS Policies

The `assets` bucket must be public. If needed, add this policy:

```sql
-- Allow public read access to assets bucket
CREATE POLICY "Public read access for assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'assets');
```

---

## File Size Budget

| Metric | Target | Current (v1.4.0) |
|--------|--------|------------------|
| JS Uncompressed | < 50 KB | ~45 KB |
| JS Gzipped | < 15 KB | ~12 KB |
| CSS Uncompressed | < 10 KB | ~6 KB |
| CSS Gzipped | < 3 KB | ~2 KB |

---

## Summary

| Item | Value |
|------|-------|
| **JS URL** | `https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v1.js` |
| **CSS URL** | Auto-loaded from same path |
| **Bucket** | `assets` (public) |
| **Path** | `forms/embed.*.js`, `forms/embed.css` |
| **Attribute** | `defer` (recommended) |
