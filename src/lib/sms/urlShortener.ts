// URL shortening service for SMS fallback
interface ShortenedUrl {
  originalUrl: string
  shortUrl: string
  expiresAt?: Date
  clickCount: number
}

// Simple in-memory cache for development
// In production, this would be stored in the database
const urlCache = new Map<string, ShortenedUrl>()

export async function shortenUrl(originalUrl: string): Promise<string> {
  // Check cache first
  const cached = urlCache.get(originalUrl)
  if (cached) {
    return cached.shortUrl
  }
  
  // Generate short code
  const shortCode = generateShortCode()
  const shortUrl = `${getBaseUrl()}/l/${shortCode}`
  
  // Store in cache
  urlCache.set(originalUrl, {
    originalUrl,
    shortUrl,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    clickCount: 0
  })
  
  // Also store by short code for reverse lookup
  urlCache.set(shortCode, {
    originalUrl,
    shortUrl,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    clickCount: 0
  })
  
  return shortUrl
}

export async function expandUrl(shortCode: string): Promise<string | null> {
  const cached = urlCache.get(shortCode)
  if (!cached) {
    return null
  }
  
  // Check expiration
  if (cached.expiresAt && cached.expiresAt < new Date()) {
    urlCache.delete(shortCode)
    urlCache.delete(cached.originalUrl)
    return null
  }
  
  // Increment click count
  cached.clickCount++
  
  return cached.originalUrl
}

function generateShortCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function getBaseUrl(): string {
  // In production, this would be your domain
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'https://your-domain.com' // Fallback
}

// Batch URL shortening for multiple URLs
export async function shortenUrls(urls: string[]): Promise<string[]> {
  const promises = urls.map(url => shortenUrl(url))
  return Promise.all(promises)
}