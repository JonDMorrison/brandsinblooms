# Deployment Pipeline

## Overview

| Component | Trigger | Platform |
|---|---|---|
| Frontend (React/Vite) | Push to `main` | Vercel |
| Edge Functions (Supabase) | Push to `main` (if functions changed) | GitHub Actions → Supabase |

## Edge Function Deployment

### Automatic (GitHub Actions)

The workflow at `.github/workflows/deploy-edge-functions.yml` runs on every push to `main` that includes changes in `supabase/functions/`.

**How it works:**
1. Compares the push commit to its parent to find changed function directories
2. Deploys only the functions that changed
3. Falls back to deploying all functions if change detection fails
4. Skips internal directories (`_shared`, `_deleted`)

**Required GitHub Secrets:**

| Secret | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Your Supabase personal access token (generate at supabase.com/dashboard/account/tokens) |
| `SUPABASE_PROJECT_ID` | `udldmkqwnxhdeztyqcau` |

Set these in: GitHub repo → Settings → Secrets and variables → Actions.

### Manual Deployment

Use the deploy script when GitHub Actions is unavailable or for hotfixes:

```bash
# Deploy the 10 most commonly changed core functions
./scripts/deploy-functions.sh

# Deploy a single function
./scripts/deploy-functions.sh send-test-email-v2

# Deploy every function in supabase/functions/
./scripts/deploy-functions.sh all
```

**Prerequisites:**
- Must be run from the `brandsinblooms` directory
- Supabase CLI installed (`brew install supabase/tap/supabase`)
- Authenticated with Supabase (`supabase login`)

## Frontend Deployment

The frontend auto-deploys via Vercel on every push to `main`. No additional configuration needed.
