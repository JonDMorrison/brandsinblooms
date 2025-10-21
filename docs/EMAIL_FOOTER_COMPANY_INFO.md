# Email Footer Company Information

## Issue
Email footers were showing outdated company information (e.g., "Homestead Nursery") even after the company profile was updated to "Brands in Blooms".

## Root Cause
1. Campaign HTML content is saved to the database with the footer baked in
2. When company information is updated in `company_profiles` table, existing saved campaign HTML is not automatically updated
3. Old campaigns retain their original footer with outdated company information

## Solution Implemented
1. **Dynamic Footer Generation**: The `generateEmailHTML()` function now always uses fresh company info from the `useCompanyInfo` hook
2. **Logging Added**: Added debug logging to track when company info is loaded and what values are being used in footer generation
3. **Real-time Updates**: The `useCompanyInfo` hook has real-time subscriptions to detect profile changes

## How It Works Now
- When you preview or send a test email, the footer is generated fresh using your current company profile
- Old saved campaign HTML in the database won't affect new test emails
- Next time you save a campaign, it will store the updated footer with current company info

## Verifying The Fix
1. Check browser console for logs like: `🏢 Company info loaded/updated: { name: "Brands in Blooms", ... }`
2. Look for footer generation logs: `✅ Footer HTML generated with company: Brands in Blooms`
3. Send a test email - it should now show your current company name

## Important Notes
- Existing campaigns in the database still have old HTML stored
- The stored HTML is only used as a reference; test emails and previews always regenerate
- When you edit and save a campaign, it will update with the new company info
