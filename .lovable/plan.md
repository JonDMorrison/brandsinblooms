
# Form Embed Deployment System

## Summary
Form embed assets are now served directly via Edge Functions, enabling automatic deployment when the AI updates the code. No manual upload steps required.

## Current Architecture

| Component | URL | Description |
|-----------|-----|-------------|
| **JavaScript** | `https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/serve-embed-js` | Main embed script |
| **CSS** | `https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/serve-embed-assets?file=embed.css` | Stylesheet |

## How It Works

1. **Edge Function Serving**: Embed files are embedded directly in edge function code
2. **Auto-Deploy**: When the AI updates the edge function, changes deploy automatically
3. **No Manual Steps**: No need to upload files to Storage or run scripts

## Customer Embed Snippet

```html
<div data-bloomsuite-form="YOUR_EMBED_KEY"></div>
<script src="https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/serve-embed-js" defer></script>
```

## Update Workflow

When making changes to embed files:

1. **Source Files** (for reference): `public/forms/embed.v1.js`, `public/forms/embed.css`
2. **Edge Functions** (deployed): 
   - `supabase/functions/serve-embed-js/index.ts`
   - `supabase/functions/serve-embed-assets/index.ts`
3. AI updates the edge function → changes auto-deploy

## Fallback Options

### Option A: Supabase Storage (Legacy)
Still available via `scripts/deploy-embed-assets.ts` if needed.

### Option B: Public Folder
Files in `public/forms/` work for local dev and Lovable preview.

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 1.5.0 | Current | Edge function serving, modal/slide-in support |

## Technical Notes

- Edge functions have `verify_jwt = false` for public access
- Cache headers: 1 hour + stale-while-revalidate
- CSS auto-detects companion function URL
