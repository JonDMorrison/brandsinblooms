# CORS Testing Guide for Form Edge Functions

This document provides curl commands to verify CORS handling for the `get-form-config` and `submit-form` edge functions.

## Current CORS Configuration

Both edge functions implement:
- `Access-Control-Allow-Origin: *` (any origin)
- `Access-Control-Allow-Methods: GET, POST, OPTIONS` (submit-form) / `GET, OPTIONS` (get-form-config)
- `Access-Control-Allow-Headers: content-type`
- `Access-Control-Max-Age: 86400` (24-hour preflight cache)

All responses (200, 400, 404, 429, 500) include CORS headers via the `jsonResponse()` helper.

---

## Test Matrix

Replace these values before testing:
- `PROJECT_ID`: `udldmkqwnxhdeztyqcau`
- `VALID_EMBED_KEY`: A real 32-char hex embed key from your forms table
- `INVALID_EMBED_KEY`: `00000000000000000000000000000000`

### Base URLs

```bash
export API_BASE="https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1"
export VALID_KEY="your_32_char_embed_key_here"
export INVALID_KEY="00000000000000000000000000000000"
```

---

## 1. get-form-config

### ✅ OPTIONS Preflight
```bash
curl -i -X OPTIONS "$API_BASE/get-form-config" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: content-type"
```

**Expected:**
```
HTTP/2 204
access-control-allow-origin: *
access-control-allow-methods: GET, OPTIONS
access-control-allow-headers: content-type
access-control-max-age: 86400
```

### ✅ GET Success (200)
```bash
curl -i "$API_BASE/get-form-config?embed_key=$VALID_KEY" \
  -H "Origin: https://example.com"
```

**Expected:**
```
HTTP/2 200
access-control-allow-origin: *
content-type: application/json
...
{"form_id":"...","fields_json":[...],...}
```

### ❌ GET 400 (Invalid embed_key format)
```bash
curl -i "$API_BASE/get-form-config?embed_key=invalid" \
  -H "Origin: https://example.com"
```

**Expected:**
```
HTTP/2 400
access-control-allow-origin: *
...
{"error":"Invalid embed_key format"}
```

### ❌ GET 404 (Form not found)
```bash
curl -i "$API_BASE/get-form-config?embed_key=$INVALID_KEY" \
  -H "Origin: https://example.com"
```

**Expected:**
```
HTTP/2 404
access-control-allow-origin: *
...
{"error":"Form not found"}
```

### ❌ GET 405 (Wrong method)
```bash
curl -i -X POST "$API_BASE/get-form-config?embed_key=$VALID_KEY" \
  -H "Origin: https://example.com"
```

**Expected:**
```
HTTP/2 405
access-control-allow-origin: *
...
{"error":"Method not allowed"}
```

---

## 2. submit-form

### ✅ OPTIONS Preflight
```bash
curl -i -X OPTIONS "$API_BASE/submit-form" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

**Expected:**
```
HTTP/2 204
access-control-allow-origin: *
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-headers: content-type
access-control-max-age: 86400
```

### ✅ POST Success (200)
```bash
curl -i -X POST "$API_BASE/submit-form" \
  -H "Origin: https://example.com" \
  -H "Content-Type: application/json" \
  -d '{
    "embed_key": "'$VALID_KEY'",
    "data": {
      "email": "test@example.com",
      "first_name": "Test",
      "last_name": "User"
    },
    "meta": {
      "page_url": "https://example.com/contact"
    }
  }'
```

**Expected:**
```
HTTP/2 200
access-control-allow-origin: *
...
{"success":true,"message":"..."}
```

### ❌ POST 400 (Missing embed_key)
```bash
curl -i -X POST "$API_BASE/submit-form" \
  -H "Origin: https://example.com" \
  -H "Content-Type: application/json" \
  -d '{"data": {"email": "test@example.com"}}'
```

**Expected:**
```
HTTP/2 400
access-control-allow-origin: *
...
{"error":"embed_key is required"}
```

### ❌ POST 400 (Invalid embed_key format)
```bash
curl -i -X POST "$API_BASE/submit-form" \
  -H "Origin: https://example.com" \
  -H "Content-Type: application/json" \
  -d '{"embed_key": "invalid", "data": {}}'
```

**Expected:**
```
HTTP/2 400
access-control-allow-origin: *
...
{"error":"Invalid embed_key format"}
```

### ❌ POST 404 (Form not found)
```bash
curl -i -X POST "$API_BASE/submit-form" \
  -H "Origin: https://example.com" \
  -H "Content-Type: application/json" \
  -d '{"embed_key": "'$INVALID_KEY'", "data": {}}'
```

**Expected:**
```
HTTP/2 404
access-control-allow-origin: *
...
{"error":"Form not found"}
```

### ❌ POST 429 (Rate limited)
```bash
# Run this 6+ times quickly to trigger rate limit
for i in {1..7}; do
  curl -i -X POST "$API_BASE/submit-form" \
    -H "Origin: https://example.com" \
    -H "Content-Type: application/json" \
    -d '{"embed_key": "'$VALID_KEY'", "data": {"email": "test'$i'@example.com"}}'
  echo ""
done
```

**Expected (6th+ request):**
```
HTTP/2 429
access-control-allow-origin: *
retry-after: 60
...
{"error":"Rate limit exceeded: 5 submissions per minute"}
```

### ❌ POST 405 (Wrong method)
```bash
curl -i -X GET "$API_BASE/submit-form" \
  -H "Origin: https://example.com"
```

**Expected:**
```
HTTP/2 405
access-control-allow-origin: *
...
{"error":"Method not allowed"}
```

---

## Browser Console Test

For quick browser testing, open DevTools Console on any website:

```javascript
// Test preflight + GET
fetch('https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/get-form-config?embed_key=YOUR_KEY')
  .then(r => console.log('Status:', r.status, 'CORS OK:', r.headers.get('access-control-allow-origin')))
  .catch(e => console.error('CORS Error:', e));

// Test preflight + POST
fetch('https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/submit-form', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ embed_key: 'YOUR_KEY', data: { email: 'test@example.com' } })
})
  .then(r => console.log('Status:', r.status, 'CORS OK:', r.headers.get('access-control-allow-origin')))
  .catch(e => console.error('CORS Error:', e));
```

---

## Verification Checklist

| Scenario | get-form-config | submit-form |
|----------|-----------------|-------------|
| OPTIONS returns 204 | ✅ | ✅ |
| 200 includes CORS | ✅ | ✅ |
| 400 includes CORS | ✅ | ✅ |
| 404 includes CORS | ✅ | ✅ |
| 405 includes CORS | ✅ | ✅ |
| 429 includes CORS | N/A (in-memory) | ✅ |
| 500 includes CORS | ✅ | ✅ |

---

## Implementation Notes

Both functions use a centralized `jsonResponse()` helper:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}
```

This ensures **all** responses include CORS headers, preventing browser CORS errors even on error responses.
