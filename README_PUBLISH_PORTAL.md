
# Publish Portal Backend

Complete backend infrastructure for the Publish Portal feature including database schema, API endpoints, workers, and testing.

## Environment Variables

Add these to your Supabase Edge Functions secrets:

```bash
# Facebook/Meta Integration
FB_CLIENT_ID=your_facebook_app_id
FB_CLIENT_SECRET=your_facebook_app_secret

# Supabase (auto-configured)
SUPABASE_URL=auto
SUPABASE_ANON_KEY=auto
SUPABASE_SERVICE_ROLE_KEY=auto
```

## Database Schema

The following tables are created by the migration:

- `generated_content` - User's draft content
- `scheduled_posts` - Posts scheduled for publishing
- `post_metrics` - Analytics data for published posts

## API Endpoints

### Edge Functions

- `publish-schedule` - Schedule posts for later publishing
- `publish-now` - Publish posts immediately  
- `publish-reschedule` - Change scheduled publish time
- `publish-delete` - Delete/archive posts

### Workers (Cron Jobs)

Set up these cron jobs in your deployment platform:

- `queue-worker` - Run every minute to process scheduled posts
- `insights-worker` - Run nightly to collect post analytics
- `token-refresh-worker` - Run nightly to refresh expiring tokens

## Setup Instructions

1. **Database Migration**
   ```sql
   -- Run the migration file in Supabase SQL Editor
   -- File: supabase/migrations/20250627_publish_portal.sql
   ```

2. **Deploy Edge Functions**
   ```bash
   # Functions are automatically deployed with Lovable
   # They will be available at:
   # - /functions/v1/publish-schedule
   # - /functions/v1/publish-now
   # - /functions/v1/publish-reschedule
   # - /functions/v1/publish-delete
   # - /functions/v1/queue-worker
   # - /functions/v1/insights-worker
   # - /functions/v1/token-refresh-worker
   ```

3. **Configure Cron Jobs**
   
   For queue processing (every minute):
   ```sql
   SELECT cron.schedule(
     'process-publish-queue',
     '* * * * *',
     $$
     SELECT net.http_post(
       url := 'https://your-project.supabase.co/functions/v1/queue-worker',
       headers := '{"Authorization": "Bearer your_service_role_key"}'::jsonb
     );
     $$
   );
   ```

   For insights collection (daily at 2 AM):
   ```sql
   SELECT cron.schedule(
     'collect-post-insights',
     '0 2 * * *',
     $$
     SELECT net.http_post(
       url := 'https://your-project.supabase.co/functions/v1/insights-worker',
       headers := '{"Authorization": "Bearer your_service_role_key"}'::jsonb
     );
     $$
   );
   ```

   For token refresh (daily at 3 AM):
   ```sql
   SELECT cron.schedule(
     'refresh-social-tokens',
     '0 3 * * *',
     $$
     SELECT net.http_post(
       url := 'https://your-project.supabase.co/functions/v1/token-refresh-worker',
       headers := '{"Authorization": "Bearer your_service_role_key"}'::jsonb
     );
     $$
   );
   ```

4. **Facebook App Configuration**
   - Create a Facebook App at developers.facebook.com
   - Add Facebook Login and Instagram Basic Display products
   - Configure redirect URIs for your domain
   - Add the FB_CLIENT_ID and FB_CLIENT_SECRET to Supabase secrets

## Usage

### Frontend Integration

```typescript
import { PublishAPI } from '@/lib/publishAPI';

// Schedule a post
await PublishAPI.schedulePost({
  contentId: 'content-123',
  caption: 'My post content',
  mediaUrl: 'https://example.com/image.jpg',
  platforms: ['FB', 'IG_FEED'],
  publishAt: '2025-07-01T15:00:00Z'
});

// Publish immediately
await PublishAPI.publishNow({
  contentId: 'content-123',
  caption: 'My post content',
  platforms: ['FB']
});

// Get user's content
const content = await PublishAPI.getGeneratedContent();
const scheduled = await PublishAPI.getScheduledPosts();
```

## Security Features

- Row Level Security (RLS) on all tables
- User authentication via Supabase Auth
- Encrypted token storage
- Rate limiting on API endpoints
- CORS protection

## Error Handling

- Automatic retry for failed posts (up to 3 attempts)
- Token refresh for expiring credentials
- Comprehensive error logging
- Graceful degradation for API failures

## Testing

Run the test suite:

```bash
npm test
```

Tests cover:
- API endpoint validation
- Queue worker functionality
- Error scenarios and retries
- Token refresh logic

## Monitoring

Monitor the system through:
- Supabase Dashboard logs
- Edge Function logs
- Database query performance
- Post success/failure rates

## Migration from Legacy System

The system includes automatic migration of legacy `content_tasks` with status 'approved' to the new `generated_content` table. This runs once per browser session.

## Troubleshooting

**Posts not publishing:**
- Check social connection tokens haven't expired
- Verify Facebook app permissions
- Check queue worker cron job is running

**Token refresh failures:**
- Verify FB_CLIENT_SECRET is correct
- Check Facebook app is not suspended
- Ensure long-lived tokens are being requested

**Missing insights:**
- Instagram Business account required for insights
- Facebook pages need insights permissions
- Wait at least 1 hour after posting before insights are available
