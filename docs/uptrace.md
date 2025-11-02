# Uptrace Monitoring

## Overview
We use Uptrace (self-hosted at https://traces.feuzion.com) for comprehensive application monitoring:
- **Error Tracking**: Frontend and backend error capture with full context
- **Distributed Tracing**: End-to-end request tracing from browser to edge functions
- **Performance Monitoring**: Span-based performance analysis
- **User Context**: Correlation of errors and traces with user sessions

## Architecture

### Frontend
- **SDK**: `@uptrace/web` with OpenTelemetry
- **Integration**: Initialized in `src/main.tsx`
- **Utilities**: `src/utils/uptrace.ts`

### Backend (Edge Functions)
- **SDK**: OpenTelemetry Deno SDK
- **Integration**: Each function calls `initUptrace("function-name")`
- **Shared Code**: `supabase/functions/_shared/uptrace.ts`

### Self-Hosted
- All monitoring data stays on our infrastructure (https://traces.feuzion.com)
- No third-party data sharing
- Full control over data retention and privacy

## Configuration

### Frontend Environment Variable
```bash
# .env
VITE_UPTRACE_DSN="https://PROJECT_KEY@traces.feuzion.com/PROJECT_ID"
```

### Backend Secret (Supabase)
Add secret via Lovable or Supabase dashboard:
- **Key**: `UPTRACE_DSN`
- **Value**: `https://PROJECT_KEY@traces.feuzion.com/PROJECT_ID`

### Getting Your DSN
1. Log into Uptrace dashboard at https://traces.feuzion.com
2. Navigate to your project settings
3. Copy the DSN (format: `https://abc123xyz@traces.feuzion.com/456`)

## Usage

### Frontend Error Tracking

```typescript
import { captureException } from '@/utils/uptrace';

try {
  await riskyOperation();
} catch (error) {
  captureException(error, { 
    context: 'operation-name',
    userId: user.id,
    additionalData: 'any-value'
  });
  throw error; // Re-throw if needed
}
```

### Frontend Performance Tracking

```typescript
import { startTransaction, endTransaction } from '@/utils/uptrace';

// Start tracking
const transaction = startTransaction('content.generate', 'user-action');

try {
  const result = await generateContent(params);
  return result;
} finally {
  endTransaction(transaction);
}
```

### Frontend User Context

```typescript
import { setUserContext } from '@/utils/uptrace';

// Call after user logs in
setUserContext(user.id, user.email, {
  subscription: user.subscription,
  companyName: user.companyName
});
```

### Frontend Breadcrumbs

```typescript
import { addBreadcrumb } from '@/utils/uptrace';

// Track user actions
addBreadcrumb('User clicked export button', 'ui-interaction', {
  buttonId: 'export-btn',
  pageUrl: window.location.pathname
});
```

### Backend (Edge Functions)

```typescript
import { 
  initUptrace, 
  captureException, 
  startSpan, 
  endSpan,
  softFail 
} from "../_shared/uptrace.ts";

// Initialize at the top of your function
initUptrace("function-name");

async function handler(req: Request) {
  const span = startSpan("handler-name");
  
  try {
    // Your logic here
    const result = await processRequest(req);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    captureException(error, { 
      functionName: "function-name",
      requestUrl: req.url,
      method: req.method
    });
    
    return new Response(JSON.stringify({ error: "Internal Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    
  } finally {
    endSpan(span);
  }
}

Deno.serve(handler);
```

### Backend Soft Fails (Non-Critical Issues)

```typescript
import { softFail } from "../_shared/uptrace.ts";

// Log warnings that don't require immediate action
if (retryCount > maxRetries) {
  softFail("max_retries_exceeded", {
    taskId: task.id,
    retryCount: retryCount,
    maxRetries: maxRetries
  });
}
```

## Accessing Uptrace Dashboard

### Login
- **URL**: https://traces.feuzion.com
- **Credentials**: [Store securely - ask team lead]

### Key Dashboard Sections

#### 1. Errors Tab
- View all captured errors
- Filter by service (frontend/backend)
- See error frequency, affected users, stack traces

#### 2. Traces Tab
- View all distributed traces
- See end-to-end request flow (frontend → backend → external API)
- Analyze performance bottlenecks
- Filter by duration, status, service

#### 3. Services Tab
- Overview of all services (frontend, edge functions)
- Service health metrics
- Error rates, throughput, latency

#### 4. Metrics Tab (if enabled)
- Custom metrics
- System metrics
- Business metrics

## Verification Checklist

### After Initial Setup

#### Backend Verification
1. ✅ Check edge function logs for: `"Uptrace initialized for [function-name]"`
2. ❌ Should NOT see: `"UPTRACE_DSN not configured"` or `"Invalid Sentry Dsn"`
3. ✅ Trigger test error: `https://[project].supabase.co/functions/v1/[function]?testError=1`
4. ✅ Verify error appears in Uptrace dashboard with full stack trace

#### Frontend Verification
1. ✅ Open browser console, should see: `"Uptrace frontend initialized"`
2. ❌ Should NOT see: `"VITE_UPTRACE_DSN not configured"`
3. ✅ Navigate between pages, check Uptrace for navigation spans
4. ✅ Trigger an error, verify it appears in Uptrace dashboard

#### Integration Verification
1. ✅ User performs action (frontend) → Edge function processes (backend)
2. ✅ Both traces appear in Uptrace
3. ✅ User ID is correlated across both traces
4. ✅ Can follow distributed trace from frontend to backend

## Common Issues

### "UPTRACE_DSN not configured"
**Problem**: Edge function can't find the DSN secret.
**Solution**: 
1. Verify secret is added in Supabase: Project Settings → Edge Functions → Secrets
2. Check secret name is exactly `UPTRACE_DSN` (case-sensitive)
3. Redeploy edge functions after adding secret

### "Uptrace not initialized"
**Problem**: Frontend DSN is invalid or missing.
**Solution**:
1. Check `.env` file has `VITE_UPTRACE_DSN` set
2. Verify DSN format: `https://PROJECT_KEY@traces.feuzion.com/PROJECT_ID`
3. Restart dev server after changing `.env`

### No traces appearing in dashboard
**Problem**: Credentials are wrong or network blocked.
**Solution**:
1. Verify DSN credentials are correct (check Uptrace project settings)
2. Test network access: `curl https://traces.feuzion.com/api/v1/traces`
3. Check browser console for CORS or network errors

### Old "Invalid Sentry Dsn" errors still appearing
**Problem**: Old edge function deployments still running.
**Solution**:
1. Redeploy all edge functions via Lovable or Supabase CLI
2. Wait 2-3 minutes for old instances to shut down
3. Check logs again

### Spans not correlating between frontend/backend
**Problem**: Missing request ID or user ID in context.
**Solution**:
1. Ensure `setUserContext()` is called after login
2. Pass user ID in API requests
3. Use same user ID in both frontend and backend traces

## Monitoring Best Practices

### What to Track

#### Critical Errors (Always Track)
- Authentication failures
- Payment processing errors
- Data corruption or loss
- External API failures (Facebook, Twilio, etc.)
- Database connection errors

#### Performance Issues (Track for Optimization)
- Slow API responses (>2 seconds)
- Database query performance
- Large file uploads/downloads
- Content generation time
- Social media publishing delays

#### User Actions (Track for Analytics)
- Content creation
- Campaign launches
- Social media publishing
- Template usage
- Subscription changes

### What NOT to Track
- Normal user navigation (too noisy)
- Successful operations without context
- Verbose debug logs
- Sensitive data (passwords, API keys, etc.)

### Error Context Best Practices

Always include:
- User ID (if available)
- Request URL or page path
- Operation name or intent
- Relevant IDs (content ID, campaign ID, etc.)

Never include:
- Passwords or API keys
- Full auth tokens
- Personal identifiable information (PII) beyond user ID/email
- Credit card numbers or payment details

## Alerting Setup

### Critical Alerts (Immediate Action Required)

1. **High Error Rate**
   - Condition: Error count > 10 in 5 minutes
   - Action: Check Uptrace dashboard, investigate root cause
   - Notify: Email + Slack

2. **Edge Function Failures**
   - Condition: Function error rate > 50%
   - Action: Check function logs, verify external dependencies
   - Notify: Email + Slack (immediate)

3. **Authentication System Down**
   - Condition: Auth errors > 5 in 1 minute
   - Action: Check Supabase status, verify network
   - Notify: Email + Slack + SMS

### Warning Alerts (Monitor Closely)

1. **Performance Degradation**
   - Condition: P95 response time > 5 seconds for 10 minutes
   - Action: Check slow traces, optimize queries
   - Notify: Email

2. **Soft Fail Rate Increase**
   - Condition: Soft fails > 50 in 10 minutes
   - Action: Review soft fail messages, identify patterns
   - Notify: Email

## Troubleshooting Guide

### Finding Root Cause of an Error

1. **Go to Uptrace Dashboard** → Errors Tab
2. **Click on the error** to see full details
3. **Review stack trace** to identify exact code location
4. **Check context data** for user ID, request params, etc.
5. **Look at related traces** to see what happened before the error
6. **Search logs** for same error pattern or user ID

### Finding Performance Bottlenecks

1. **Go to Traces Tab**
2. **Sort by Duration** (descending)
3. **Click on slow trace** to see span timeline
4. **Identify longest span** in the timeline
5. **Check span attributes** for query details, API calls, etc.
6. **Optimize the identified bottleneck**

### Correlating Frontend → Backend Issues

1. **Find user action in frontend traces** (e.g., "content.generate")
2. **Note the user ID** from span attributes
3. **Search backend traces** for same user ID
4. **View distributed trace** to see full request flow
5. **Identify where the issue occurred** (frontend, backend, external API)

### Debugging Distributed Trace

Example distributed trace for content publishing:
```
Frontend: user.action.publish (200ms)
  → API call (50ms)
    → Edge Function: publish-task (1500ms)
      → Database query (100ms)
      → Facebook API call (1300ms) ← SLOW!
      → Database update (100ms)
```

To fix:
1. Identify slow span (Facebook API: 1300ms)
2. Check if this is normal or a regression
3. Add retry logic or timeout
4. Consider async processing for slow operations

## Maintenance

### Regular Tasks

#### Daily
- Review error dashboard for new issues
- Check alert notifications

#### Weekly
- Review performance trends
- Analyze slow traces
- Check soft fail patterns

#### Monthly
- Review and update alert thresholds
- Archive or delete old traces (if needed)
- Update documentation with new patterns

### Trace Retention
- **Default**: 30 days
- **Critical errors**: Export and archive if needed
- **Performance baselines**: Save monthly snapshots

## Team Onboarding

### For New Developers

1. **Get access** to Uptrace dashboard (ask team lead)
2. **Read this document** thoroughly
3. **Review existing traces** to understand normal patterns
4. **Add tracking to new features** using examples above
5. **Test locally** before deploying (check console for "Uptrace initialized")

### Adding Tracking to New Features

Checklist:
- [ ] Add error tracking with `captureException()`
- [ ] Add performance tracking with `startTransaction()` / `endTransaction()`
- [ ] Add user context if user-specific
- [ ] Test that traces appear in Uptrace dashboard
- [ ] Add relevant context data (IDs, operation names, etc.)
- [ ] Document any new trace patterns in this file

## Additional Resources

- **Uptrace Documentation**: https://uptrace.dev/get/
- **OpenTelemetry Docs**: https://opentelemetry.io/docs/
- **Uptrace Dashboard**: https://traces.feuzion.com
- **Internal Runbook**: `docs/operations.md`

## Support

For issues with Uptrace integration:
1. Check this document first
2. Search existing traces for similar errors
3. Ask in #engineering Slack channel
4. Contact team lead if unresolved
