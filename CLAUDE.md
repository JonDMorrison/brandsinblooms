# Claude Code Context

## Who I Am
Jon Morrison — Canadian entrepreneur running 5 SaaS products. GitHub: JonDMorrison.

## My Agent System
Full context, agent files, and instructions live in ~/Sites/JonCoach/CLAUDE.md
Read that file first for complete context on how I think, my priorities, and agent commands.

## How To Help Me
1. Protect production stability above everything
2. Understand the architecture before making changes
3. Small safe changes over big rewrites
4. Identify the failing layer before proposing fixes
5. Never restructure core systems without understanding the full flow

## Core Rules
- No large rewrites without explicit approval
- Explain what files are affected before changing them
- When debugging: identify layer → explain cause → propose fix → get approval
- Prefer boring reliable solutions over clever ones

## Edge Function Deployment

**GitHub Actions auto-deploys** changed edge functions on every push to `main`. Only functions with actual file changes are deployed (not all 258).

**Required GitHub Secrets** (must be set in repo settings):
- `SUPABASE_ACCESS_TOKEN` — your Supabase personal access token
- `SUPABASE_PROJECT_ID` — `udldmkqwnxhdeztyqcau`

**Manual deploy** (if CI is unavailable or for hotfixes):

```bash
# Deploy all core functions (the 10 most commonly changed)
./scripts/deploy-functions.sh

# Deploy a single function
./scripts/deploy-functions.sh send-test-email-v2

# Deploy every function in supabase/functions/
./scripts/deploy-functions.sh all
```

See `DEPLOYMENT.md` for full pipeline documentation.
