import { SmartBlock } from '@/types/smartBlocks';

export const SMART_BLOCK_TEMPLATES: SmartBlock[] = [
  // ESSENTIALS
  {
    id: 'text-only',
    name: 'Text Only',
    description: 'Single column text block for announcements',
    category: 'essentials',
    tags: ['text', 'announcement', 'simple'],
    template: {
      blocks: [{
        block_type: 'text',
        content: {
          title: 'Your Title Here',
          content: 'Add your main content here. Perfect for announcements, updates, or detailed information you want to share with your customers.'
        }
      }]
    }
  },
  {
    id: 'image-only',
    name: 'Image Only',
    description: 'Full-width image block',
    category: 'essentials',
    tags: ['image', 'visual', 'full-width'],
    template: {
      blocks: [{
        block_type: 'image',
        content: {
          alt: 'Featured image',
          alignment: 'center'
        }
      }]
    }
  },
  {
    id: 'text-image-side',
    name: 'Text + Image',
    description: 'Side-by-side text and image layout',
    category: 'essentials',
    tags: ['text', 'image', 'layout'],
    template: {
      blocks: [
        {
          block_type: 'text',
          content: {
            title: 'Section Title',
            content: 'Describe your content here alongside the image.'
          }
        },
        {
          block_type: 'image',
          content: {
            alt: 'Supporting image',
            alignment: 'center'
          }
        }
      ]
    }
  },
  {
    id: 'cta-button',
    name: 'Call-to-Action Button',
    description: 'Prominent button for driving action',
    category: 'essentials',
    tags: ['button', 'cta', 'action'],
    template: {
      blocks: [{
        block_type: 'button',
        content: {
          text: 'Shop Now',
          url: 'https://your-website.com',
          alignment: 'center'
        }
      }]
    }
  },
  {
    id: 'header-subtitle',
    name: 'Header with Subtitle',
    description: 'Professional header for email campaigns',
    category: 'essentials',
    tags: ['header', 'title', 'intro'],
    template: {
      blocks: [{
        block_type: 'header',
        content: {
          title: 'Welcome to Our Newsletter',
          subtitle: 'Your weekly dose of gardening inspiration'
        }
      }]
    }
  },

  // PROMOTIONS
  {
    id: 'featured-product',
    name: 'Featured Product',
    description: 'Showcase a product with image, name, price, and CTA',
    category: 'promotions',
    tags: ['product', 'sale', 'featured'],
    template: {
      blocks: [
        {
          block_type: 'product',
          content: {
            name: 'Premium Garden Tool Set',
            price: '$89.99',
            description: 'Everything you need for a thriving garden. Durable, professional-grade tools.',
            buttonText: 'Shop Now',
            buttonUrl: 'https://your-store.com/product'
          }
        }
      ]
    }
  },
  {
    id: 'sale-banner',
    name: 'Sale Banner',
    description: 'Eye-catching banner for urgent promotions',
    category: 'promotions',
    tags: ['sale', 'urgent', 'banner'],
    template: {
      blocks: [
        {
          block_type: 'header',
          content: {
            title: '🔥 FLASH SALE - 30% OFF',
            subtitle: 'Limited time offer on all garden supplies'
          }
        },
        {
          block_type: 'button',
          content: {
            text: 'Shop Sale Items',
            url: 'https://your-store.com/sale',
            alignment: 'center'
          }
        }
      ]
    }
  },
  {
    id: 'seasonal-offer',
    name: 'Seasonal Offer',
    description: 'Themed promotional block for seasonal campaigns',
    category: 'promotions',
    tags: ['seasonal', 'themed', 'promotion'],
    template: {
      blocks: [
        {
          block_type: 'text',
          content: {
            title: '🌸 Spring Garden Makeover',
            content: 'Transform your outdoor space with our curated spring collection. Fresh plants, tools, and décor to welcome the season.'
          }
        },
        {
          block_type: 'image',
          content: {
            alt: 'Spring garden collection',
            alignment: 'center'
          }
        },
        {
          block_type: 'button',
          content: {
            text: 'Explore Spring Collection',
            url: 'https://your-store.com/spring',
            alignment: 'center'
          }
        }
      ]
    }
  },

  // EVENTS & CLASSES
  {
    id: 'event-announcement',
    name: 'Event Announcement',
    description: 'Promote workshops, classes, or garden events',
    category: 'events',
    tags: ['event', 'workshop', 'date'],
    template: {
      blocks: [
        {
          block_type: 'header',
          content: {
            title: 'Upcoming Workshop',
            subtitle: 'Join us for hands-on learning'
          }
        },
        {
          block_type: 'text',
          content: {
            title: 'Container Gardening Basics',
            content: 'Learn how to create beautiful container gardens perfect for small spaces.\n\n📅 Saturday, March 15th\n⏰ 10:00 AM - 12:00 PM\n📍 Garden Center Main Store'
          }
        },
        {
          block_type: 'button',
          content: {
            text: 'Reserve Your Spot',
            url: 'https://your-store.com/events',
            alignment: 'center'
          }
        }
      ]
    }
  },
  {
    id: 'workshop-promo',
    name: 'Workshop Promo',
    description: 'Detailed workshop promotion with examples',
    category: 'events',
    tags: ['workshop', 'detailed', 'examples'],
    template: {
      blocks: [
        {
          block_type: 'text',
          content: {
            title: 'Master Class: Herb Garden Design',
            content: 'Create a functional and beautiful herb garden that provides fresh ingredients year-round.'
          }
        },
        {
          block_type: 'image',
          content: {
            alt: 'Herb garden example 1',
            alignment: 'center'
          }
        },
        {
          block_type: 'image',
          content: {
            alt: 'Herb garden example 2',
            alignment: 'center'
          }
        },
        {
          block_type: 'image',
          content: {
            alt: 'Herb garden example 3',
            alignment: 'center'
          }
        },
        {
          block_type: 'button',
          content: {
            text: 'Learn More & Register',
            url: 'https://your-store.com/herb-workshop',
            alignment: 'center'
          }
        }
      ]
    }
  },

  // INSPIRATION & EDUCATION
  {
    id: 'gardening-tip',
    name: 'Gardening Tip of the Week',
    description: 'Weekly educational content for subscribers',
    category: 'inspiration',
    tags: ['tip', 'education', 'weekly'],
    template: {
      blocks: [
        {
          block_type: 'header',
          content: {
            title: '💡 Tip of the Week',
            subtitle: 'Expert advice for your garden'
          }
        },
        {
          block_type: 'text',
          content: {
            title: 'Watering Deep, Not Often',
            content: 'Deep, infrequent watering encourages roots to grow deeper, making plants more drought-resistant. Water slowly at the base of plants rather than spraying leaves.'
          }
        },
        {
          block_type: 'image',
          content: {
            alt: 'Proper watering technique demonstration',
            alignment: 'center'
          }
        }
      ]
    }
  },
  {
    id: 'inspirational-quote',
    name: 'Quote + Image',
    description: 'Motivational quote with beautiful imagery',
    category: 'inspiration',
    tags: ['quote', 'inspiration', 'image'],
    template: {
      blocks: [
        {
          block_type: 'image',
          content: {
            alt: 'Inspirational garden scene',
            alignment: 'center'
          }
        },
        {
          block_type: 'text',
          content: {
            title: '"The earth laughs in flowers."',
            content: '— Ralph Waldo Emerson\n\nFind joy in the simple beauty of your garden.'
          }
        }
      ]
    }
  },
  {
    id: 'how-to-list',
    name: 'How-To Guide',
    description: 'Step-by-step instructions with visual elements',
    category: 'inspiration',
    tags: ['howto', 'guide', 'steps'],
    template: {
      blocks: [
        {
          block_type: 'header',
          content: {
            title: 'How to Plant Bulbs for Spring',
            subtitle: 'Simple steps for beautiful blooms'
          }
        },
        {
          block_type: 'text',
          content: {
            title: 'Step-by-Step Guide',
            content: '1. Choose a sunny location with well-draining soil\n2. Dig holes 3 times the height of the bulb\n3. Place bulbs pointed end up\n4. Cover with soil and water thoroughly\n5. Mark the location and wait for spring!'
          }
        },
        {
          block_type: 'image',
          content: {
            alt: 'Bulb planting demonstration',
            alignment: 'center'
          }
        }
      ]
    }
  }
];