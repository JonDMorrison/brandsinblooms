# Email Domain Setup with Entri

## Overview

BloomSuite uses [Entri Connect](https://www.goentri.com/) for one-click DNS setup, allowing users to configure SPF, DKIM, and DMARC records automatically without manually editing DNS settings.

## Environment Variables

| Variable | Location | Required | Description |
|----------|----------|----------|-------------|
| `VITE_ENTRI_APPLICATION_ID` | Vercel/Lovable | **Yes in prod** | Entri publishable Application ID (safe for frontend) |
| `ENTRI_APPLICATION_ID` | Supabase Secrets | No (has fallback) | Same value, for edge function |
| `ENTRI_API_KEY` | Supabase Secrets | **Yes** | Entri secret key (server-only, never expose) |
| `RESEND_API_KEY` | Supabase Secrets | **Yes** | Resend API key for email domain provisioning |

### Configuration Notes

- `VITE_ENTRI_APPLICATION_ID` is a **publishable key** - safe for frontend
- In development, if not set, falls back to `'bloomsuite'` with a console warning
- In production, missing `VITE_ENTRI_APPLICATION_ID` throws an error (fail loudly)
- `ENTRI_API_KEY` is a **secret key** - must stay server-side only

## Architecture

### Components

1. **Frontend Hook**: `src/hooks/useEntriConnect.ts`
   - Loads the Entri SDK dynamically
   - Opens the Entri modal for DNS configuration
   - Handles success/error callbacks

2. **Edge Function**: `supabase/functions/entri-domain-callback/index.ts`
   - Receives callback after successful Entri setup
   - Creates/updates email_domains record
   - Triggers Resend domain provisioning

3. **Token Edge Function**: `supabase/functions/entri-get-token/index.ts`
   - Fetches JWT token from Entri API
   - Uses `ENTRI_APPLICATION_ID` and `ENTRI_API_KEY`

4. **Domain Service**: `src/lib/email/domainProvisioning.ts`
   - `upsertEmailDomainFromEntriCallback()` - Handles Entri success data
   - `ensureResendDomainForEmailDomain()` - Provisions Resend domain
   - `refreshResendVerificationStatus()` - Checks verification status

5. **UI Component**: `src/components/crm/settings/DomainConnectWizard.tsx`
   - "Automatic Setup" button using Entri
   - "Manual Setup" fallback option

## Configuration

### Centralized Config

Entri configuration is managed in `src/lib/config/emailDomainsConfig.ts`:

```typescript
export const emailDomainsConfig = {
  entriEnabled: true,
  entriAppId: getEntriAppId(),  // Reads from VITE_ENTRI_APPLICATION_ID
  entriScriptUrl: 'https://cdn.goentri.com/entri.js',
  autoSetupRecommended: true,
};
```

## Database Schema

The `email_domains` table includes these Entri-specific columns:

```sql
entri_connection_id TEXT     -- Entri session/connection ID
entri_provider TEXT          -- DNS provider (GoDaddy, Cloudflare, etc.)
is_entri_managed BOOLEAN     -- Whether DNS was set up via Entri
```

## How It Works

### User Flow

1. User enters their domain name
2. User clicks "Automatic Setup (Recommended)"
3. Entri modal opens and detects their DNS provider
4. User authorizes Entri to configure DNS records
5. Entri applies SPF, DKIM, and DMARC records automatically
6. BloomSuite receives success callback with provider info
7. Domain is created in database with `is_entri_managed = true`
8. Resend domain is provisioned for email sending
9. DNS verification begins (usually 5-30 minutes)
10. Once verified, domain enters warmup period

### Fallback Flow

If Entri cannot detect the DNS provider or user prefers manual setup:

1. User clicks "Set up manually"
2. DNS records are displayed in a table
3. User copies records to their DNS provider
4. User clicks "Check DNS" to verify
5. System checks Resend for verification status

## DNS Records

The default email authentication records configured by Entri:

| Type | Host | Value |
|------|------|-------|
| TXT | @ | `v=spf1 include:_spf.resend.com ~all` |
| CNAME | resend._domainkey | `resend._domainkey.resend.com` |
| TXT | _dmarc | `v=DMARC1; p=quarantine; rua=mailto:dmarc@bloomsuite.app` |

## Sending Priority

When selecting a sender for campaigns:

1. **First**: Entri-managed domains with `status` = 'warming_up' or 'active'
2. **Second**: Manually configured domains with verified status
3. **Fallback**: Platform sender (`noreply@bloomsuite.email`)

## Supported DNS Providers

Entri supports 50+ DNS providers including:

- GoDaddy
- Cloudflare
- Namecheap
- Google Domains
- AWS Route 53
- DigitalOcean
- Hover
- Name.com
- And many more...

## Troubleshooting

### Entri modal doesn't open

1. Check that `VITE_ENTRI_APPLICATION_ID` is set
2. Verify the Entri script loaded (check network tab)
3. Check browser console for errors

### DNS not verified after Entri setup

1. Wait 5-30 minutes for DNS propagation
2. Click "Check DNS" to refresh status
3. Verify records in DNS provider dashboard
4. Check for conflicting SPF records

### Domain stuck in "verifying" status

1. DNS propagation can take up to 48 hours
2. Use [MXToolbox](https://mxtoolbox.com/) to check DNS records
3. Contact support if stuck beyond 48 hours

## Adding New DNS Record Templates

To modify the DNS records configured by Entri, edit `src/hooks/useEntriConnect.ts`:

```typescript
const EMAIL_DNS_RECORDS: EntriDnsRecord[] = [
  {
    type: 'TXT',
    host: '@',
    value: 'v=spf1 include:_spf.resend.com ~all',
    ttl: 3600
  },
  // Add more records as needed
];
```

## Security Considerations

- Entri Application ID is public (safe in frontend)
- API keys should only be in backend secrets
- User authentication is verified before domain operations
- Tenant membership is checked before allowing domain changes
