import { BlockType } from '@/types/emailBuilder';

export interface BloomSuiteBlock {
  id: string;
  name: string;
  content: any;
  block_type: BlockType;
  tags: string[];
  usage_count: number;
  is_bloomsuite_block: boolean;
  created_at: string;
}

export const bloomsuiteDefaultBlocks: BloomSuiteBlock[] = [
  {
    id: 'bs-event-invite',
    name: '🌷 Event Invite Block',
    block_type: 'text' as BlockType,
    tags: ['event', 'promo', 'social'],
    usage_count: 0,
    is_bloomsuite_block: true,
    created_at: new Date().toISOString(),
    content: {
      html: `
        <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 32px; border-radius: 12px; text-align: center; margin: 16px 0;">
          <h2 style="color: #0f766e; font-size: 28px; font-weight: bold; margin: 0 0 16px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Join Us for Spring Garden Party!</h2>
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; max-width: 400px; margin-left: auto; margin-right: auto;">Celebrate the season with fellow garden enthusiasts. Enjoy refreshments, expert tips, and exclusive plant discounts.</p>
          <div style="margin: 24px 0;">
            <img src="https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=400&h=200&fit=crop&auto=format" alt="Garden Party" style="width: 100%; max-width: 400px; height: 200px; object-fit: cover; border-radius: 8px;">
          </div>
          <a href="#" style="display: inline-block; background: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin-top: 16px;">Reserve Your Spot</a>
        </div>
      `
    }
  },
  {
    id: 'bs-product-spotlight',
    name: '🛒 Product Spotlight',
    block_type: 'product' as BlockType,
    tags: ['product', 'promo', 'shop'],
    usage_count: 0,
    is_bloomsuite_block: true,
    created_at: new Date().toISOString(),
    content: {
      html: `
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin: 16px 0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <img src="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=250&fit=crop&auto=format" alt="Featured Plant" style="width: 100%; height: 250px; object-fit: cover;">
          <div style="padding: 24px;">
            <h3 style="color: #0f766e; font-size: 24px; font-weight: bold; margin: 0 0 8px 0;">Monstera Deliciosa</h3>
            <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px 0;">Indoor Plant</p>
            <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 16px 0;">Perfect for adding tropical vibes to any room. Low maintenance and fast-growing with stunning split leaves.</p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #059669; font-size: 24px; font-weight: bold;">$29.99</span>
              <a href="#" style="background: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600;">Add to Cart</a>
            </div>
          </div>
        </div>
      `
    }
  },
  {
    id: 'bs-workshop-promo',
    name: '📅 Workshop Promo',
    block_type: 'text' as BlockType,
    tags: ['workshop', 'event', 'education'],
    usage_count: 0,
    is_bloomsuite_block: true,
    created_at: new Date().toISOString(),
    content: {
      html: `
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 32px; border-radius: 12px; border-left: 6px solid #f59e0b; margin: 16px 0;">
          <div style="display: flex; align-items: center; margin-bottom: 16px;">
            <div style="background: #f59e0b; color: white; padding: 8px 12px; border-radius: 6px; font-weight: bold; font-size: 14px; margin-right: 16px;">WORKSHOP</div>
            <span style="color: #92400e; font-weight: 600;">Saturday, March 15th • 10:00 AM</span>
          </div>
          <h3 style="color: #92400e; font-size: 24px; font-weight: bold; margin: 0 0 12px 0;">Container Gardening Masterclass</h3>
          <p style="color: #451a03; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Learn the secrets of successful container gardening from our master gardener. Includes hands-on planting and take-home container.</p>
          <a href="#" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">RSVP Now - $35</a>
        </div>
      `
    }
  },
  {
    id: 'bs-care-tip',
    name: '🌿 Care Tip of the Week',
    block_type: 'text' as BlockType,
    tags: ['tips', 'education', 'care'],
    usage_count: 0,
    is_bloomsuite_block: true,
    created_at: new Date().toISOString(),
    content: {
      html: `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 24px; margin: 16px 0;">
          <div style="display: flex; align-items: flex-start; gap: 16px;">
            <div style="background: #22c55e; color: white; padding: 12px; border-radius: 50%; flex-shrink: 0;">
              <span style="font-size: 20px;">🌿</span>
            </div>
            <div style="flex: 1;">
              <h4 style="color: #166534; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">Weekly Garden Tip</h4>
              <p style="color: #15803d; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Water your plants early morning or late evening to reduce evaporation and prevent leaf burn. This helps your plants absorb maximum moisture efficiently.</p>
              <a href="#" style="color: #059669; font-weight: 600; text-decoration: none; border-bottom: 1px solid #059669;">Learn More Watering Tips →</a>
            </div>
          </div>
        </div>
      `
    }
  },
  {
    id: 'bs-new-arrivals',
    name: '📬 New Arrivals Banner',
    block_type: 'header' as BlockType,
    tags: ['banner', 'new', 'promo'],
    usage_count: 0,
    is_bloomsuite_block: true,
    created_at: new Date().toISOString(),
    content: {
      html: `
        <div style="background: linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&h=300&fit=crop&auto=format'); background-size: cover; background-position: center; padding: 60px 32px; text-align: center; border-radius: 12px; margin: 16px 0;">
          <h1 style="color: white; font-size: 36px; font-weight: bold; margin: 0 0 16px 0; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);">Fresh Spring Arrivals</h1>
          <p style="color: white; font-size: 18px; margin: 0 0 24px 0; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);">Discover our newest collection of spring plants and garden essentials</p>
          <a href="#" style="background: #059669; color: white; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 18px; display: inline-block; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);">Shop New Arrivals</a>
        </div>
      `
    }
  },
  {
    id: 'bs-pollinator-highlight',
    name: '🐝 Pollinator Highlight',
    block_type: 'text' as BlockType,
    tags: ['pollinator', 'eco', 'education'],
    usage_count: 0,
    is_bloomsuite_block: true,
    created_at: new Date().toISOString(),
    content: {
      html: `
        <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 2px solid #fbbf24; border-radius: 12px; padding: 24px; margin: 16px 0;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 48px; display: block; margin-bottom: 8px;">🐝</span>
            <h3 style="color: #92400e; font-size: 24px; font-weight: bold; margin: 0;">Bee & Butterfly Friendly Plants</h3>
          </div>
          <p style="color: #451a03; font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 20px 0;">Support local pollinators with our specially curated selection of bee and butterfly-friendly plants. Every purchase helps create pollinator corridors in our community.</p>
          <div style="text-align: center;">
            <a href="#" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-right: 12px;">Shop Pollinator Plants</a>
            <a href="#" style="color: #f59e0b; padding: 12px 24px; text-decoration: none; border: 2px solid #f59e0b; border-radius: 6px; font-weight: 600;">Learn More</a>
          </div>
        </div>
      `
    }
  },
  {
    id: 'bs-gift-guide',
    name: '🎁 Gift Guide Block',
    block_type: 'product' as BlockType,
    tags: ['gift', 'holiday', 'product'],
    usage_count: 0,
    is_bloomsuite_block: true,
    created_at: new Date().toISOString(),
    content: {
      html: `
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 16px 0;">
          <h3 style="color: #0f766e; font-size: 24px; font-weight: bold; text-align: center; margin: 0 0 24px 0;">Perfect Garden Gifts</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px;">
            <div style="text-align: center;">
              <img src="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=150&h=150&fit=crop&auto=format" alt="Plant Gift" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;">
              <h4 style="color: #374151; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">Starter Plant Set</h4>
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px 0;">$24.99</p>
              <a href="#" style="background: #059669; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 600;">Shop Now</a>
            </div>
            <div style="text-align: center;">
              <img src="https://images.unsplash.com/photo-1465379944081-7f47de8d74ac?w=150&h=150&fit=crop&auto=format" alt="Garden Tools" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;">
              <h4 style="color: #374151; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">Garden Tool Kit</h4>
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px 0;">$39.99</p>
              <a href="#" style="background: #059669; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 600;">Shop Now</a>
            </div>
            <div style="text-align: center;">
              <img src="https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?w=150&h=150&fit=crop&auto=format" alt="Planters" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;">
              <h4 style="color: #374151; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">Designer Planters</h4>
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px 0;">$19.99</p>
              <a href="#" style="background: #059669; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 600;">Shop Now</a>
            </div>
          </div>
        </div>
      `
    }
  },
  {
    id: 'bs-before-after',
    name: '✨ Before & After Gallery',
    block_type: 'image' as BlockType,
    tags: ['transformation', 'inspiration', 'gallery'],
    usage_count: 0,
    is_bloomsuite_block: true,
    created_at: new Date().toISOString(),
    content: {
      html: `
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 16px 0;">
          <h3 style="color: #0f766e; font-size: 24px; font-weight: bold; text-align: center; margin: 0 0 20px 0;">Garden Transformation</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
            <div style="text-align: center;">
              <img src="https://images.unsplash.com/photo-1472396961693-142e6e269027?w=250&h=200&fit=crop&auto=format" alt="Before" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;">
              <h4 style="color: #6b7280; font-size: 16px; font-weight: 600; margin: 0;">Before</h4>
            </div>
            <div style="text-align: center;">
              <img src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=250&h=200&fit=crop&auto=format" alt="After" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;">
              <h4 style="color: #059669; font-size: 16px; font-weight: 600; margin: 0;">After</h4>
            </div>
          </div>
          <p style="color: #374151; font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 20px 0;">See how our landscape design service transformed this backyard into a thriving garden paradise in just 6 weeks.</p>
          <div style="text-align: center;">
            <a href="#" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Start Your Transformation</a>
          </div>
        </div>
      `
    }
  }
];