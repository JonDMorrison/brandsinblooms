# Edge Functions Documentation

## Overview
Edge Functions provide server-side logic for our application, handling complex operations that require security, external API calls, or computational processing.

## Available Edge Functions

### 1. Content Generation (`generate-content`)
**Purpose**: Generate marketing content using AI

**Endpoint**: `/functions/v1/generate-content`

**Parameters**:
```typescript
{
  contentType: 'instagram_post' | 'facebook_post' | 'blog_post' | 'newsletter' | 'video_script';
  prompt: string;
  tone?: string;
  keywords?: string[];
  targetAudience?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  content?: string;
  error?: string;
}
```

**Security**: Authenticated users only, rate limited

### 2. Social Media Publishing (`publish-social`)
**Purpose**: Publish content to Facebook and Instagram

**Endpoint**: `/functions/v1/publish-social`

**Parameters**:
```typescript
{
  platform: 'facebook' | 'instagram';
  content: string;
  mediaUrls?: string[];
  scheduledTime?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  postId?: string;
  error?: string;
}
```

**Security**: OAuth token validation, platform-specific permissions

### 3. Google Analytics Data (`ga-report-data`)
**Purpose**: Fetch Google Analytics reports

**Endpoint**: `/functions/v1/ga-report-data`

**Parameters**:
```typescript
{
  propertyId: string;
  dateRange: number; // days
  metrics?: string[];
  dimensions?: string[];
}
```

**Response**:
```typescript
{
  success: boolean;
  data?: GoogleAnalyticsData;
  error?: string;
}
```

**Security**: Service account authentication, property access validation

### 4. Image Processing (`process-images`)
**Purpose**: Optimize and resize images for social media

**Endpoint**: `/functions/v1/process-images`

**Parameters**:
```typescript
{
  imageUrls: string[];
  formats: ('webp' | 'jpeg' | 'png')[];
  sizes: { width: number; height: number }[];
}
```

**Response**:
```typescript
{
  success: boolean;
  processedImages?: ProcessedImage[];
  error?: string;
}
```

**Security**: File type validation, size limits

### 5. Campaign Analytics (`campaign-analytics`)
**Purpose**: Aggregate campaign performance data

**Endpoint**: `/functions/v1/campaign-analytics`

**Parameters**:
```typescript
{
  campaignId: string;
  dateRange: { start: string; end: string };
  platforms: string[];
}
```

**Response**:
```typescript
{
  success: boolean;
  analytics?: CampaignAnalytics;
  error?: string;
}
```

**Security**: Campaign ownership validation

## Development Guidelines

### Error Handling
All edge functions follow consistent error handling:

```typescript
try {
  // Function logic
  return new Response(
    JSON.stringify({ success: true, data: result }),
    { headers: { 'Content-Type': 'application/json' } }
  );
} catch (error) {
  console.error('Function error:', error);
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }),
    { 
      status: error.status || 500,
      headers: { 'Content-Type': 'application/json' } 
    }
  );
}
```

### Authentication
Standard authentication pattern:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

// Verify JWT token
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  throw new Error('Authorization header required');
}

const { data: { user }, error } = await supabase.auth.getUser(
  authHeader.replace('Bearer ', '')
);

if (error || !user) {
  throw new Error('Invalid authentication');
}
```

### Rate Limiting
Implement rate limiting for resource-intensive functions:

```typescript
// Check rate limit
const rateLimitKey = `rate_limit:${user.id}:${functionName}`;
const rateLimitCount = await redis.get(rateLimitKey);

if (rateLimitCount && parseInt(rateLimitCount) > RATE_LIMIT) {
  throw new Error('Rate limit exceeded');
}

// Increment counter
await redis.incr(rateLimitKey);
await redis.expire(rateLimitKey, RATE_LIMIT_WINDOW);
```

## Deployment

### Environment Variables
Required environment variables for edge functions:

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI (for content generation)
OPENAI_API_KEY=your_openai_key

# Google Analytics
GOOGLE_ANALYTICS_SERVICE_ACCOUNT=your_service_account_json

# Social Media APIs
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret

# Redis (for rate limiting)
REDIS_URL=your_redis_url
```

### Deployment Process
1. Edge functions are deployed automatically via Supabase CLI
2. Environment variables are set in Supabase dashboard
3. Functions are tested in staging environment before production

## Monitoring & Logging

### Logging Standards
All edge functions implement structured logging:

```typescript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  function: 'generate-content',
  user_id: user.id,
  action: 'content_generated',
  metadata: { contentType, promptLength: prompt.length }
}));
```

### Performance Monitoring
- **Execution Time**: Track function execution duration
- **Memory Usage**: Monitor memory consumption
- **Error Rates**: Track success/failure rates
- **Rate Limiting**: Monitor rate limit hits

### Alerts
Set up alerts for:
- High error rates (>5%)
- Slow response times (>5 seconds)
- Rate limit violations
- Authentication failures

## Testing

### Unit Testing
Each edge function has corresponding tests:

```typescript
// tests/edge-functions/generate-content.test.ts
import { assertEquals } from 'https://deno.land/std@0.192.0/testing/asserts.ts';

Deno.test('generate-content: should generate Instagram post', async () => {
  const response = await generateContent({
    contentType: 'instagram_post',
    prompt: 'Summer sale announcement'
  });
  
  assertEquals(response.success, true);
  assertEquals(typeof response.content, 'string');
});
```

### Integration Testing
Test edge functions with real external APIs in staging environment.

### Load Testing
Use tools like `wrk` or `artillery` to test function performance under load.

## Security Considerations

### Input Validation
All inputs are validated using schemas:

```typescript
import { z } from 'https://deno.land/x/zod@v3.21.4/mod.ts';

const generateContentSchema = z.object({
  contentType: z.enum(['instagram_post', 'facebook_post', 'blog_post']),
  prompt: z.string().min(1).max(1000),
  tone: z.string().optional(),
});

const validatedInput = generateContentSchema.parse(requestBody);
```

### API Key Management
- Never expose API keys in client-side code
- Rotate API keys regularly
- Use least-privilege principle for API access

### Data Sanitization
- Sanitize all user inputs before processing
- Validate file uploads and media content
- Implement output encoding to prevent XSS

## Troubleshooting

### Common Issues

**1. Authentication Errors**
- Check JWT token validity
- Verify user permissions
- Ensure correct authorization header format

**2. External API Failures**
- Implement retry logic with exponential backoff
- Check API rate limits and quotas
- Validate API credentials and permissions

**3. Timeout Issues**
- Edge functions have 60-second timeout limit
- Implement chunked processing for large operations
- Use background jobs for long-running tasks

**4. Memory Limits**
- Monitor memory usage in function logs
- Optimize data processing algorithms
- Use streaming for large file operations

### Debug Mode
Enable debug logging in development:

```typescript
const DEBUG = Deno.env.get('DEBUG') === 'true';

if (DEBUG) {
  console.log('Debug info:', { input, processedData });
}
```