import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ContentBlock {
  id: string
  type: string
  payload_json: any
  sort_order: number
}

interface Campaign {
  id: string
  title: string
  slug: string
  hub_enabled: boolean
  hub_expiry: string
  tenant_id: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const slug = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2]

    if (!slug || slug === 'content-hub') {
      return new Response('Invalid hub URL', { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Find campaign by slug
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, title, slug, hub_enabled, hub_expiry, tenant_id')
      .eq('slug', slug)
      .eq('hub_enabled', true)
      .single()

    if (campaignError || !campaign) {
      console.log('Campaign not found:', campaignError)
      return new Response(generateNotFoundPage(), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      })
    }

    // Check if hub has expired
    if (campaign.hub_expiry && new Date(campaign.hub_expiry) < new Date()) {
      return new Response(generateExpiredPage(campaign), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      })
    }

    // Get content blocks for the campaign
    const { data: blocks, error: blocksError } = await supabase
      .from('content_blocks')
      .select('*')
      .eq('campaign_id', campaign.id)
      .eq('is_active', true)
      .order('sort_order')

    if (blocksError) {
      console.error('Error fetching blocks:', blocksError)
      return new Response('Error loading content', { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Track page view
    const sessionId = generateSessionId()
    const userAgent = req.headers.get('user-agent') || ''
    const referer = req.headers.get('referer') || ''
    
    // Get client IP
    const clientIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown'

    // Log page view (fire and forget)
    supabase.from('hub_views').insert({
      campaign_id: campaign.id,
      session_id: sessionId,
      user_agent: userAgent,
      ip_address: clientIP,
      referrer: referer,
      metadata: { slug }
    }).then(() => {}).catch(() => {})

    // Generate and return the hub page
    const hubHtml = generateHubPage(campaign, blocks || [], sessionId)
    
    return new Response(hubHtml, {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=300' // 5 minute cache
      }
    })

  } catch (error) {
    console.error('Content hub error:', error)
    return new Response('Internal server error', { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function generateSessionId(): string {
  return crypto.randomUUID()
}

function generateNotFoundPage(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Content Not Found</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      margin: 0;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      max-width: 400px;
    }
    h1 { color: #333; margin-bottom: 16px; }
    p { color: #666; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Content Not Found</h1>
    <p>This content hub link may have expired or been removed.</p>
  </div>
</body>
</html>`
}

function generateExpiredPage(campaign: Campaign): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${campaign.title} - Expired</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      margin: 0;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      max-width: 400px;
    }
    h1 { color: #333; margin-bottom: 16px; }
    p { color: #666; line-height: 1.5; }
    .expired-banner {
      background: #ff6b6b;
      color: white;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="expired-banner">⏰ Offer Expired</div>
    <h1>${campaign.title}</h1>
    <p>This special offer has expired. Check back for new deals and updates!</p>
  </div>
</body>
</html>`
}

function generateHubPage(campaign: Campaign, blocks: ContentBlock[], sessionId: string): string {
  const blocksHtml = blocks.map(block => generateBlockHtml(block, campaign.id, sessionId)).join('')
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${campaign.title}</title>
  <meta name="description" content="Special offers and content from ${campaign.title}">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #334155;
      line-height: 1.6;
    }
    .hub-container {
      max-width: 480px;
      margin: 0 auto;
      background: white;
      min-height: 100vh;
    }
    .hub-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px 20px;
      text-align: center;
    }
    .hub-title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .hub-subtitle {
      opacity: 0.9;
      font-size: 16px;
    }
    .hub-content {
      padding: 0 0 40px 0;
    }
    .content-block {
      margin-bottom: 24px;
      border-radius: 12px;
      overflow: hidden;
    }
    .block-image {
      width: 100%;
      height: auto;
      display: block;
    }
    .block-text {
      padding: 20px;
      background: white;
    }
    .block-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #1e293b;
    }
    .block-content {
      color: #64748b;
      line-height: 1.7;
    }
    .offer-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin: 0 16px 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .offer-price {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .price-current {
      font-size: 28px;
      font-weight: 700;
      color: #059669;
    }
    .price-original {
      font-size: 18px;
      color: #94a3b8;
      text-decoration: line-through;
    }
    .btn {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      font-size: 16px;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #2563eb;
    }
    .btn-success { background: #059669; }
    .btn-success:hover { background: #047857; }
    .engagement-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: white;
      border-top: 1px solid #e2e8f0;
      padding: 16px;
      display: flex;
      gap: 12px;
      justify-content: center;
      box-shadow: 0 -2px 8px rgba(0,0,0,0.08);
    }
    .engagement-btn {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .engagement-btn:hover {
      background: #e2e8f0;
    }
    .image-carousel {
      position: relative;
      margin: 0 16px 20px;
    }
    .carousel-container {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      gap: 12px;
      padding: 0 4px;
    }
    .carousel-item {
      flex: 0 0 auto;
      scroll-snap-align: start;
    }
    .carousel-item img {
      width: 280px;
      height: 200px;
      object-fit: cover;
      border-radius: 8px;
    }
    .video-container {
      margin: 0 16px 20px;
      border-radius: 12px;
      overflow: hidden;
    }
    .video-container video {
      width: 100%;
      height: auto;
    }
    .loyalty-widget {
      background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
      color: white;
      padding: 20px;
      margin: 0 16px 20px;
      border-radius: 12px;
      text-align: center;
    }
    .loyalty-points {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .rich-text {
      padding: 0 16px 20px;
    }
    .rich-text h1, .rich-text h2, .rich-text h3 {
      margin-bottom: 12px;
      color: #1e293b;
    }
    .rich-text p {
      margin-bottom: 16px;
    }
    .rich-text ul, .rich-text ol {
      margin-left: 20px;
      margin-bottom: 16px;
    }
    @media (max-width: 480px) {
      .carousel-item img { width: 240px; }
    }
  </style>
</head>
<body>
  <div class="hub-container">
    <div class="hub-header">
      <h1 class="hub-title">${campaign.title}</h1>
      <p class="hub-subtitle">Exclusive offers just for you</p>
    </div>
    
    <div class="hub-content">
      ${blocksHtml}
    </div>
    
    <div class="engagement-bar">
      <button class="engagement-btn" onclick="saveOffer()">
        ❤️ Save
      </button>
      <button class="engagement-btn" onclick="shareHub()">
        🔗 Share
      </button>
      <button class="engagement-btn" onclick="showQR()">
        📱 QR Code
      </button>
    </div>
  </div>

  <script>
    const campaignId = '${campaign.id}';
    const sessionId = '${sessionId}';
    const supabaseUrl = '${Deno.env.get('SUPABASE_URL')}';
    
    // Track interactions
    function trackInteraction(type, blockId = null, metadata = {}) {
      fetch(supabaseUrl + '/functions/v1/hub-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaignId,
          session_id: sessionId,
          interaction_type: type,
          block_id: blockId,
          metadata: metadata
        })
      }).catch(() => {}); // Silent fail
    }
    
    function saveOffer() {
      localStorage.setItem('saved_offer_' + campaignId, 'true');
      trackInteraction('favorite');
      showToast('❤️ Saved to your favorites!');
    }
    
    function shareHub() {
      if (navigator.share) {
        navigator.share({
          title: '${campaign.title}',
          text: 'Check out this special offer!',
          url: window.location.href
        });
      } else {
        navigator.clipboard.writeText(window.location.href);
        showToast('🔗 Link copied to clipboard!');
      }
      trackInteraction('share');
    }
    
    function showQR() {
      trackInteraction('click', null, { action: 'qr_code' });
      // Simple QR implementation would go here
      showToast('📱 QR Code feature coming soon!');
    }
    
    function showToast(message) {
      const toast = document.createElement('div');
      toast.style.cssText = \`
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: #1f2937; color: white; padding: 12px 20px;
        border-radius: 8px; z-index: 1000; font-size: 14px;
        animation: fadeInOut 3s ease-in-out;
      \`;
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
    
    // Track initial page view
    trackInteraction('view');
    
    // Add CSS for toast animation
    const style = document.createElement('style');
    style.textContent = \`
      @keyframes fadeInOut {
        0%, 100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        10%, 90% { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    \`;
    document.head.appendChild(style);
  </script>
</body>
</html>`
}

function generateBlockHtml(block: ContentBlock, campaignId: string, sessionId: string): string {
  const payload = block.payload_json

  switch (block.type) {
    case 'image':
      return `
        <div class="content-block" onclick="trackInteraction('click', '${block.id}')">
          <img src="${payload.url}" alt="${payload.alt || ''}" class="block-image" loading="lazy">
        </div>`

    case 'text':
    case 'rich_text':
      return `
        <div class="content-block rich-text">
          <div class="block-text">
            ${payload.title ? `<h2 class="block-title">${payload.title}</h2>` : ''}
            <div class="block-content">${payload.content || payload.text || ''}</div>
          </div>
        </div>`

    case 'image_carousel':
      const images = payload.images || []
      const carouselImages = images.map((img: any) => 
        `<div class="carousel-item">
          <img src="${img.url}" alt="${img.alt || ''}" loading="lazy">
        </div>`
      ).join('')
      
      return `
        <div class="content-block">
          <div class="image-carousel">
            <div class="carousel-container">
              ${carouselImages}
            </div>
          </div>
        </div>`

    case 'offer_card':
      return `
        <div class="content-block">
          <div class="offer-card" onclick="trackInteraction('click', '${block.id}')">
            <h3 class="block-title">${payload.title || 'Special Offer'}</h3>
            <div class="offer-price">
              <span class="price-current">$${payload.price || '0.00'}</span>
              ${payload.original_price ? `<span class="price-original">$${payload.original_price}</span>` : ''}
            </div>
            <p class="block-content">${payload.description || ''}</p>
            <button class="btn btn-success" onclick="trackInteraction('click', '${block.id}', {action: 'redeem'})">
              ${payload.button_text || 'Redeem Offer'}
            </button>
          </div>
        </div>`

    case 'video':
      return `
        <div class="content-block">
          <div class="video-container">
            <video controls preload="metadata" onclick="trackInteraction('click', '${block.id}')">
              <source src="${payload.url}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
          </div>
        </div>`

    case 'loyalty_widget':
      return `
        <div class="content-block">
          <div class="loyalty-widget" onclick="trackInteraction('click', '${block.id}')">
            <div class="loyalty-points">${payload.points || '0'}</div>
            <p>Loyalty Points Available</p>
            <p style="opacity: 0.9; font-size: 14px; margin-top: 8px;">
              ${payload.message || 'Keep earning points with every purchase!'}
            </p>
          </div>
        </div>`

    case 'coupon':
      return `
        <div class="content-block">
          <div class="offer-card" onclick="trackInteraction('click', '${block.id}')">
            <h3 class="block-title">💰 ${payload.title || 'Coupon'}</h3>
            <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 16px 0;">
              <div style="font-family: monospace; font-size: 20px; font-weight: 700; color: #1e293b;">
                ${payload.code || 'SAVE20'}
              </div>
            </div>
            <p class="block-content">${payload.description || ''}</p>
            <button class="btn" onclick="navigator.clipboard.writeText('${payload.code || 'SAVE20'}'); showToast('Coupon code copied!')">
              Copy Code
            </button>
          </div>
        </div>`

    default:
      return `
        <div class="content-block">
          <div class="block-text">
            <p>Unknown block type: ${block.type}</p>
          </div>
        </div>`
  }
}