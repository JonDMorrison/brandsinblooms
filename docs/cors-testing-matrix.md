# CORS Testing Matrix for BloomSuite Form Endpoints

## Base URL

```
https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1
```

---

## Test Cases

### 1. OPTIONS Preflight - get-form-config

```bash
curl -i -X OPTIONS \
  "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/get-form-config" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: content-type"
```

**Expected Response:**
```
HTTP/2 204
access-control-allow-origin: *
access-control-allow-methods: GET, OPTIONS
access-control-allow-headers: content-type
access-control-max-age: 86400
```

---

### 2. OPTIONS Preflight - submit-form

```bash
curl -i -X OPTIONS \
  "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/submit-form" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

**Expected Response:**
```
HTTP/2 204
access-control-allow-origin: *
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-headers: content-type
access-control-max-age: 86400
```

---

### 3. GET Config - Valid embed_key

```bash
curl -i -X GET \
  "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/get-form-config?embed_key=abcdef1234567890abcdef1234567890" \
  -H "Origin: https://example.com"
```

**Expected Response (404 if form doesn't exist):**
```
HTTP/2 404
access-control-allow-origin: *
access-control-allow-methods: GET, OPTIONS
access-control-allow-headers: content-type
content-type: application/json

{"error":"Form not found"}
```

---

### 4. GET Config - Invalid embed_key format

```bash
curl -i -X GET \
  "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/get-form-config?embed_key=invalid" \
  -H "Origin: https://example.com"
```

**Expected Response:**
```
HTTP/2 400
access-control-allow-origin: *
access-control-allow-methods: GET, OPTIONS
access-control-allow-headers: content-type
content-type: application/json

{"error":"Invalid embed_key format"}
```

---

### 5. GET Config - Missing embed_key

```bash
curl -i -X GET \
  "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/get-form-config" \
  -H "Origin: https://example.com"
```

**Expected Response:**
```
HTTP/2 400
access-control-allow-origin: *
access-control-allow-methods: GET, OPTIONS
access-control-allow-headers: content-type
content-type: application/json

{"error":"embed_key query parameter is required"}
```

---

### 6. POST Submit - Valid submission

```bash
curl -i -X POST \
  "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/submit-form" \
  -H "Origin: https://example.com" \
  -H "Content-Type: application/json" \
  -d '{
    "embed_key": "abcdef1234567890abcdef1234567890",
    "data": {
      "email": "test@example.com",
      "first_name": "Test"
    },
    "meta": {
      "page_url": "https://example.com/contact",
      "referrer": "https://google.com"
    }
  }'
```

**Expected Response (404 if form doesn't exist):**
```
HTTP/2 404
access-control-allow-origin: *
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-headers: content-type
content-type: application/json

{"error":"Form not found"}
```

---

### 7. POST Submit - Missing embed_key

```bash
curl -i -X POST \
  "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/submit-form" \
  -H "Origin: https://example.com" \
  -H "Content-Type: application/json" \
  -d '{"data": {"email": "test@example.com"}}'
```

**Expected Response:**
```
HTTP/2 400
access-control-allow-origin: *
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-headers: content-type
content-type: application/json

{"error":"embed_key is required"}
```

---

### 8. POST Submit - Invalid embed_key format

```bash
curl -i -X POST \
  "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/submit-form" \
  -H "Origin: https://example.com" \
  -H "Content-Type: application/json" \
  -d '{"embed_key": "bad-key", "data": {}}'
```

**Expected Response:**
```
HTTP/2 400
access-control-allow-origin: *
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-headers: content-type
content-type: application/json

{"error":"Invalid embed_key format"}
```

---

### 9. Rate Limit Test (429)

```bash
# Run this 6+ times quickly to trigger rate limit
for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST \
    "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/submit-form" \
    -H "Content-Type: application/json" \
    -d '{"embed_key": "abcdef1234567890abcdef1234567890", "data": {"email": "test@example.com"}}'
done
```

**Expected Response (after limit exceeded):**
```
HTTP/2 429
access-control-allow-origin: *
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-headers: content-type
retry-after: 60
content-type: application/json

{"error":"Rate limit exceeded: 5 submissions per minute"}
```

---

### 10. Method Not Allowed (405)

```bash
# POST to get-form-config (should be GET)
curl -i -X POST \
  "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/get-form-config" \
  -H "Origin: https://example.com" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```
HTTP/2 405
access-control-allow-origin: *
access-control-allow-methods: GET, OPTIONS
access-control-allow-headers: content-type
content-type: application/json

{"error":"Method not allowed"}
```

---

## Verification Checklist

| Test | Endpoint | Status | CORS Headers Present |
|------|----------|--------|---------------------|
| OPTIONS preflight | get-form-config | 204 | ✅ |
| OPTIONS preflight | submit-form | 204 | ✅ |
| GET valid key | get-form-config | 200/404 | ✅ |
| GET invalid key | get-form-config | 400 | ✅ |
| GET missing key | get-form-config | 400 | ✅ |
| POST valid | submit-form | 200/404 | ✅ |
| POST missing key | submit-form | 400 | ✅ |
| POST invalid key | submit-form | 400 | ✅ |
| Rate limited | submit-form | 429 | ✅ |
| Wrong method | get-form-config | 405 | ✅ |
| Wrong method | submit-form | 405 | ✅ |

---

## Key CORS Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `Access-Control-Allow-Origin` | `*` | Allow any origin |
| `Access-Control-Allow-Methods` | `GET, POST, OPTIONS` | Allowed HTTP methods |
| `Access-Control-Allow-Headers` | `content-type` | Allowed request headers |
| `Access-Control-Max-Age` | `86400` | Cache preflight for 24 hours |

---

## Troubleshooting

### CORS errors in browser console

If you see `No 'Access-Control-Allow-Origin' header`:
1. Check the function is deployed (`supabase functions deploy`)
2. Verify the OPTIONS handler returns 204 with headers
3. Check all error responses include CORS headers

### Preflight not cached

If preflight requests fire on every call:
1. Verify `Access-Control-Max-Age: 86400` is present
2. Check browser DevTools → Network → filter by "preflight"
3. Some browsers limit max-age (Chrome caps at 2 hours)

### 502 errors

If you get 502 Bad Gateway:
1. Check function logs: `supabase functions logs get-form-config`
2. Verify function deployed correctly
3. Check for runtime errors in function code
