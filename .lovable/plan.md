
# Fix Email Footer Missing Logo and Social Icons

## Problem Identified
Test emails from **Down to Earth** (Christine's account) are missing the formatted footer with logo and social icons that appear in emails from **Brands in Blooms**.

### Root Causes Found

**1. Missing Profile Data (Primary Issue)**
The "Down to Earth Garden Center" company profile has:
- ❌ No Facebook URL
- ❌ No Instagram URL  
- ❌ No TikTok URL
- ❌ No Pinterest URL
- ❌ No YouTube URL
- ❌ No LinkedIn URL
- ❌ No company logo uploaded

In contrast, "Brands in Blooms" has:
- ✅ Facebook, Instagram, LinkedIn, YouTube URLs configured
- ✅ Company logo uploaded and stored

**2. Code Gap (Secondary Issue)**
The email footer generator code doesn't pass the `feature_flags` field (which contains the company logo URL) from the company profile to the footer HTML builder.

---

## Solution

### Step 1: Fix the Code Gap
Update the email renderer to include `feature_flags` in the company profile data passed to the footer generator.

**Files to modify:**
- `supabase/functions/_shared/emailRenderer.ts`
  - Add `feature_flags` to `CompanyProfileShape` interface
  - Pass `feature_flags` to the footer generator in `appendFooter()` function

### Step 2: User Action Required (Christine's Account)
Christine needs to configure her company profile in BloomSuite with:
1. **Upload a company logo** (Settings → Branding)
2. **Add social media URLs** (Settings → Account → Social Links)

Without this data, the footer cannot display a logo or social icons - the system is working correctly, it just has nothing to show.

---

## Technical Changes

```text
supabase/functions/_shared/emailRenderer.ts
├── CompanyProfileShape interface
│   └── Add: feature_flags?: { company_logo_url?: string; footer_colors?: {...} }
│
└── appendFooter() function
    └── Pass feature_flags to profileData for footer generator
```

---

## Verification
After the code fix:
1. Deploy the updated edge function
2. Have Christine upload a logo and add at least one social URL
3. Send a test email - footer should now show the logo and social icons
