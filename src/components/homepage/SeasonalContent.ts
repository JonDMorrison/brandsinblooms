
export const getSeasonalGreeting = () => {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return { emoji: "🌸", text: "Spring is here!" };
  if (month >= 6 && month <= 8) return { emoji: "☀️", text: "Summer vibes!" };
  if (month >= 9 && month <= 11) return { emoji: "🍂", text: "Fall beauty!" };
  return { emoji: "❄️", text: "Winter magic!" };
};

// Fixed function to get a rotating daily welcome message
export const getWelcomeMessage = (businessName?: string) => {
  // Use date to create a predictable but changing rotation
  const date = new Date();
  
  // Calculate day of year more safely
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  
  // Business name or fallback
  const name = businessName || "Garden Center";
  
  // Array of welcome messages with different themes
  const welcomeMessages = [
    // Business-themed greetings
    `Welcome back to your blooming business, ${name}!`,
    `Ready to grow your garden empire today?`,
    `The plants are waiting for you, ${name}!`,
    
    // Seasonal messages
    `${getSeasonalGreeting().emoji} ${getSeasonalGreeting().text} Let's make it count!`,
    `Another beautiful day to nurture growth!`,
    `Garden wisdom awaits you today!`,
    
    // Motivation & fun
    `Let's dig into some marketing magic!`,
    `Planting seeds of success today?`,
    `Green thumbs, green profits!`,
    
    // Time-based
    `Rise and shine! The plants are awake too.`,
    `Good day for garden greatness!`,
    `Welcome to another fruitful day!`,
    
    // Playful
    `Lettuce celebrate another day of growth!`,
    `Aloe there! Ready to grow your business?`,
    `Unbeleafable things await you today!`
  ];
  
  // Pick a message based on the day of the year for daily rotation
  const messageIndex = dayOfYear % welcomeMessages.length;
  return welcomeMessages[messageIndex];
};

export const getSeasonalContent = () => {
  const month = new Date().getMonth() + 1;
  
  if (month >= 3 && month <= 5) {
    // Spring content
    return {
      theme: "Spring Garden Revival",
      posts: [
        {
          type: 'instagram',
          content: `🌸 Spring has officially sprung at Green Thumb Garden Center, and we couldn't be more excited to share this magical season with you! Our greenhouse is absolutely bursting with fresh seedlings, vibrant annuals, and everything you need to transform your outdoor space into a spring paradise.

Whether you're a seasoned gardener or just starting your green journey, our expert team is here to guide you through selecting the perfect plants for your unique space and growing conditions. From colorful pansies and cheerful marigolds to hardy perennials that will return year after year, we've carefully curated a selection that thrives in our local climate.

This week, we're featuring our premium organic soil amendments and natural fertilizers that will give your plants the nutrients they need to flourish. Plus, don't miss our Spring Plant Sale happening all month long - it's the perfect time to stock up on your garden favorites!

What's first on your spring planting list? Drop a comment below and let us know what you're most excited to grow this season! 🌱✨`,
          hashtags: '#SpringGardening #FreshStart #GreenThumb #PlantLovers #SpringSale #OrganicGardening #LocalNursery #GardenLife',
          imageIdea: 'Colorful spring flowers display in greenhouse with customers browsing'
        },
        {
          type: 'facebook',
          content: `🌱 Spring Gardening Workshop this Saturday! Join our experts as we share tips for preparing your garden beds, choosing the right plants for your space, and getting the most out of your spring planting.

This hands-on workshop will cover everything from soil preparation and proper planting techniques to watering schedules and pest prevention. You'll leave with practical knowledge and a starter kit to begin your spring gardening journey.

Whether you're dealing with clay soil, shade challenges, or limited space, our team has solutions that work. We'll also discuss companion planting strategies that can help your garden thrive naturally while reducing maintenance.

Register now - limited spots available! Workshop includes refreshments and a 15% discount on all plants purchased the day of the event.`,
          hashtags: '#SpringWorkshop #GardeningTips #CommunityEvent',
          imageIdea: 'Workshop setup with gardening tools and soil'
        },
        {
          type: 'email',
          content: `Subject: Your Spring Garden Awaits! 🌻

Dear Garden Enthusiasts,

Spring is the perfect time to transform your outdoor space! This week we're featuring our premium soil amendments, organic fertilizers, and a stunning selection of spring perennials.

Our spring collection includes everything you need for a successful growing season:
- Hardy perennials that provide years of beauty
- Colorful annuals for instant impact
- Organic soil conditioners for healthier plants
- Natural pest control solutions

Plus, don't miss our Spring Plant Sale happening all month long - save up to 25% on select varieties!

Visit us this week to see what's blooming and get personalized advice from our gardening experts.

Happy Gardening!
The Green Thumb Team`,
          hashtags: '#SpringNewsletter #PlantSale #GardeningTips',
          imageIdea: 'Newsletter header with spring garden scene'
        },
        {
          type: 'newsletter',
          content: `GREEN THUMB QUARTERLY
Spring Edition - Volume 12

WELCOME TO SPRING!
The season of renewal is here, and we're thrilled to share the latest from Green Thumb Garden Center. This quarter brings exciting new arrivals, expert growing tips, and community events to help you create your dream garden.

FEATURED THIS MONTH
Our spring collection showcases carefully selected varieties that thrive in local conditions. From drought-resistant perennials to pollinator-friendly natives, we've curated plants that bring both beauty and purpose to your landscape.

GARDENING WISDOM
Spring planting success starts with soil preparation. Our experts recommend testing soil pH and adding organic matter before planting. This simple step can dramatically improve plant health and garden productivity throughout the growing season.

COMMUNITY SPOTLIGHT
Thank you to all our customers who participated in last month's community garden project. Together, we planted over 200 native plants that will provide habitat for local wildlife while beautifying our neighborhood.

UPCOMING EVENTS
- Spring Planting Workshop: March 15th
- Native Plant Sale: March 22-24
- Children's Garden Club: Starting April 1st

Stay connected with us for the latest updates and gardening inspiration!`,
          hashtags: '#Quarterly #SpringGardening #CommunityEvents',
          imageIdea: 'Professional newsletter layout with garden photos'
        }
      ]
    };
  } else if (month >= 6 && month <= 8) {
    // Summer content
    return {
      theme: "Summer Heat Solutions",
      posts: [
        {
          type: 'instagram',
          content: `☀️ Summer heat got you worried about your garden? Don't sweat it! Our incredible collection of drought-resistant beauties are here to save the day and keep your outdoor space looking absolutely stunning even during the hottest months of the year.

These hardy perennials, succulents, and heat-loving annuals are nature's champions - they've evolved to thrive in challenging conditions while still providing the color, texture, and beauty you want in your garden. From striking agaves and colorful sedums to vibrant lantana and resilient lavender, these plants prove that water-wise doesn't mean sacrificing style.

Summer gardening is all about working with nature, not against it. Our carefully selected drought-tolerant plants not only survive the heat but actually flourish, requiring minimal water once established.

Stop by this week for personalized advice on creating a drought-resistant garden that works with your specific space, soil, and style preferences. 🌵🏜️`,
          hashtags: '#SummerGardening #DroughtResistant #HeatTolerant #WaterWise #SustainableGardening #XericGardening #LowMaintenance #EcoFriendly',
          imageIdea: 'Display of drought-resistant plants and succulents in summer garden setting'
        },
        {
          type: 'facebook',
          content: `🌻 Summer Herb Workshop Series continues this week! Learn how to grow, harvest, and preserve herbs from your garden. This week we're focusing on basil, oregano, and summer savory.

Join us for an interactive session where you'll discover the secrets of successful herb gardening, from seed to table. We'll cover optimal growing conditions, companion planting strategies, and preservation techniques that will keep your herbs flavorful all year long.

Perfect timing for your summer cooking adventures! Each participant receives a starter herb collection and recipe cards featuring seasonal favorites.`,
          hashtags: '#HerbWorkshop #SummerHerbs #CookingWithHerbs',
          imageIdea: 'Fresh herbs arranged for cooking demonstration'
        },
        {
          type: 'email',
          content: `Subject: Summer Garden Care Made Easy! 🌞

Hello Green Thumbs!

Summer gardening doesn't have to be a struggle! Our latest newsletter features water-saving tips, pest management strategies, and the best plants for summer containers.

BEAT THE HEAT:
- Deep watering techniques that save time and water
- Mulching strategies for moisture retention
- Shade solutions for delicate plants

SUMMER CONTAINER GARDENS:
Create stunning displays that thrive in heat with our expert plant combinations.

Visit us for personalized summer gardening advice and take advantage of our climate-specific plant recommendations.

Keep growing!
Your Garden Center Team`,
          hashtags: '#SummerCare #WaterSaving #ContainerGardening',
          imageIdea: 'Summer container garden arrangements'
        },
        {
          type: 'newsletter',
          content: `GREEN THUMB QUARTERLY
Summer Edition - Volume 13

SUMMER SURVIVAL GUIDE
As temperatures rise, successful gardening means working smarter, not harder. This edition focuses on creating beautiful, sustainable gardens that thrive in summer heat while conserving water and reducing maintenance.

DROUGHT-SMART GARDENING
Discover plants that flourish in hot, dry conditions. Our summer selection emphasizes varieties that provide stunning color and texture while requiring minimal supplemental watering once established.

WATER-WISE TECHNIQUES
Learn professional irrigation strategies that maximize plant health while minimizing water use. From drip irrigation basics to mulching mastery, small changes can make a big difference.

UPCOMING SUMMER EVENTS
- Heat-Tolerant Plant Sale: July 4th weekend
- Evening Garden Tours: Every Friday in July
- Summer Herb Harvest Workshop: July 20th

Stay cool and keep growing!`,
          hashtags: '#SummerQuarterly #DroughtTolerant #WaterWise',
          imageIdea: 'Professional newsletter with summer garden photography'
        }
      ]
    };
  } else if (month >= 9 && month <= 11) {
    // Fall content
    return {
      theme: "Autumn Garden Preparations",
      posts: [
        {
          type: 'instagram',
          content: `🍂 Fall is absolutely nature's grand finale, and right now our garden center is putting on the most spectacular show of the year! Our stunning mums in every shade imaginable, gorgeous asters painting the landscape in purples and whites, and vibrant ornamental kales are creating a breathtaking autumn display.

But here's a secret that many gardeners don't know: fall is actually one of THE BEST times to plant trees and shrubs! While everyone else is thinking about winding down their gardening for the year, smart gardeners are taking advantage of cooler temperatures and autumn rains to establish new plantings.

Fall planting offers so many advantages - less heat stress on new plants, natural rainfall that reduces watering needs, and the opportunity to see exactly how plants will look in your landscape before they go dormant.

What fall colors are calling to your garden this year? Come explore our autumn wonderland! 🌳🍁`,
          hashtags: '#FallColors #Mums #TreePlanting #AutumnGarden #LandscapePlanting #FallPlanting #SeasonalGardening #GardenDesign',
          imageIdea: 'Colorful fall mums and ornamental plants display with autumn trees in background'
        },
        {
          type: 'facebook',
          content: `🌰 Fall Garden Prep Workshop this weekend! Learn the secrets of preparing your garden for winter, proper mulching techniques, and which plants to divide now for next year's garden.

This comprehensive workshop covers essential fall tasks that will set your garden up for success next spring. We'll demonstrate proper pruning techniques, show you how to protect tender plants, and share strategies for extending your growing season.

Workshop participants receive a seasonal care guide, bulb planting tool, and 15% off all fall plants and supplies.`,
          hashtags: '#FallPrep #WinterReady #GardeningWorkshop',
          imageIdea: 'Garden tools and mulch for fall preparation'
        },
        {
          type: 'email',
          content: `Subject: Fall Into Gardening Success! 🍁

Dear Gardening Friends,

Fall is the secret season for gardeners! While others are winding down, smart gardeners are planting bulbs for spring, dividing perennials, and preparing for next year's garden.

FALL PLANTING OPPORTUNITIES:
- Spring bulbs for early color
- Trees and shrubs for long-term beauty
- Cool-season vegetables for extended harvest

DON'T MISS OUR FALL BULB SALE:
Save 30% on premium spring bulbs including tulips, daffodils, crocuses, and specialty varieties.

Happy Fall Gardening!
Green Thumb Garden Center`,
          hashtags: '#FallBulbs #GardenPrep #SpringPlanning',
          imageIdea: 'Variety of spring bulbs for fall planting'
        },
        {
          type: 'newsletter',
          content: `GREEN THUMB QUARTERLY
Fall Edition - Volume 14

AUTUMN OPPORTUNITIES
Fall gardening offers unique opportunities for both immediate enjoyment and long-term garden success. This season's focus is on maximizing autumn beauty while preparing for the year ahead.

FALL PLANTING ADVANTAGES
Cooler temperatures and natural rainfall make fall ideal for establishing new plants. Trees, shrubs, and perennials planted now develop strong root systems over winter, ensuring vigorous growth next spring.

SPRING BULB PLANNING
Now is the time to plant spring bulbs for next year's early color. Our fall bulb selection includes both classic favorites and exciting new varieties that will transform your garden come spring.

SEASONAL MAINTENANCE
Proper fall garden care sets the foundation for next year's success. From dividing perennials to protecting tender plants, autumn tasks ensure a healthy, beautiful garden.

NOVEMBER EVENTS
- Fall Cleanup Workshop: November 2nd
- Winter Protection Clinic: November 16th
- Holiday Wreath Making: November 30th

Embrace the season!`,
          hashtags: '#FallQuarterly #BulbPlanting #SeasonalMaintenance',
          imageIdea: 'Professional newsletter with fall garden scenes'
        }
      ]
    };
  } else {
    // Winter content
    return {
      theme: "Winter Garden Magic",
      posts: [
        {
          type: 'instagram',
          content: `❄️ Think winter means your garden has to disappear until spring? Think again! Winter gardening is one of our absolute favorite topics because there are so many ways to keep beauty, color, and life thriving in your outdoor space even during the coldest months.

Our carefully selected evergreens provide the backbone of winter interest - from towering spruces and fragrant pines to compact junipers and elegant hollies. These year-round champions don't just survive winter; they define it with their rich textures and steadfast presence.

Winter berries add pops of brilliant color against snowy backdrops - think bright red winterberry holly, orange persimmon fruits, and deep purple beautyberry clusters. Cold-hardy ornamental grasses sway gracefully in winter breezes.

Winter is also the perfect time for planning next year's garden! What winter elements are you planning to add? ❄️🌲`,
          hashtags: '#WinterGarden #Evergreens #GardenPlanning #WinterBeauty #SeasonalInterest #WinterLandscape #GardenDesign #YearRoundGarden',
          imageIdea: 'Evergreen plants and winter berry displays with snow accents'
        },
        {
          type: 'facebook',
          content: `🌲 Holiday Wreath Workshop this Saturday! Create beautiful, natural decorations using fresh evergreen boughs, berries, and pinecones from local sources.

Join us for this festive hands-on workshop where you'll learn traditional wreath-making techniques while creating stunning holiday decorations for your home. We'll provide all materials including wire frames, fresh greenery, and natural embellishments.

All materials provided - just bring your creativity! Each participant creates one 18-inch wreath to take home, plus receives a 20% discount on additional holiday greenery.`,
          hashtags: '#HolidayWorkshop #WreathMaking #NaturalDecor',
          imageIdea: 'Workshop table with wreath-making materials'
        },
        {
          type: 'email',
          content: `Subject: Winter Garden Magic Awaits! ⛄

Warm Greetings!

Winter is the perfect time for garden planning and indoor plant care. Our houseplant collection is thriving, and we're here to help you bring green life into your home during the colder months.

WINTER HOUSEPLANT CARE:
- Adjusting watering for dormant season
- Providing adequate humidity in dry indoor air
- Positioning plants for optimal winter light

HOLIDAY GREENERY:
Fresh-cut wreaths, garlands, and arrangements using locally sourced evergreens. Custom designs available for your holiday decorating needs.

Stay warm and keep planning!
Your Winter Garden Team`,
          hashtags: '#WinterNewsletter #Houseplants #IndoorGardening',
          imageIdea: 'Cozy indoor plant display for winter'
        },
        {
          type: 'newsletter',
          content: `GREEN THUMB QUARTERLY
Winter Edition - Volume 15

WINTER WONDER
Winter gardening extends far beyond houseplants and holiday decorations. This season offers unique opportunities to appreciate garden structure, plan improvements, and prepare for the growing year ahead.

INDOOR GARDENING
Bring the garden indoors with our extensive houseplant collection. From low-light champions to statement plants, winter is perfect for expanding your indoor garden and improving air quality.

GARDEN STRUCTURE
Appreciate the "bones" of your garden during winter months. Evergreens, interesting bark, and architectural elements become focal points, revealing design opportunities for enhancement.

PLANNING AND PREPARATION
Winter's quiet months are ideal for garden planning. Review last year's successes and challenges, research new varieties, and design next year's improvements.

WINTER WORKSHOPS
Educational opportunities continue through winter with indoor gardening, design planning, and preparation workshops that set the stage for spring success.

FEBRUARY PREVIEW
- Early seed starting programs
- Garden design consultations
- Houseplant maintenance clinics

Embrace winter's gifts!`,
          hashtags: '#WinterQuarterly #IndoorGardening #GardenPlanning',
          imageIdea: 'Professional newsletter with winter garden and houseplant photos'
        }
      ]
    };
  }
};
