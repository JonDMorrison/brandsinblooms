
export const getSeasonalGreeting = () => {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return { emoji: "🌸", text: "Spring is here!" };
  if (month >= 6 && month <= 8) return { emoji: "☀️", text: "Summer vibes!" };
  if (month >= 9 && month <= 11) return { emoji: "🍂", text: "Fall beauty!" };
  return { emoji: "❄️", text: "Winter magic!" };
};

// Gardening-focused welcome messages with plant metaphors
export const getWelcomeMessage = (gardenCenterName?: string, firstName?: string) => {
  // Use date to create a predictable but changing rotation
  const date = new Date();
  
  // Calculate day of year more safely
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  
  // Garden center name or fallback
  const name = gardenCenterName || "Your Garden Center";
  const userFirstName = firstName || "there";
  
  // Array of gardening-focused welcome messages with plant metaphors
  const welcomeMessages = [
    // Garden growth themes
    { text: `Welcome back to your growing garden center, ${name}!`, emoji: "🌱" },
    { text: `Ready to cultivate success today, ${userFirstName}?`, emoji: "🌿" },
    { text: `Time to plant some marketing seeds, ${userFirstName}!`, emoji: "🌰" },
    
    // Seasonal gardening messages
    { text: `${getSeasonalGreeting().emoji} ${getSeasonalGreeting().text} Let's grow your reach, ${userFirstName}!`, emoji: getSeasonalGreeting().emoji },
    { text: `Another day to nurture customer relationships, ${userFirstName}!`, emoji: "🌸" },
    { text: `Gardening wisdom awaits you today, ${userFirstName}!`, emoji: "🧠" },
    
    // Creative & fun gardening
    { text: `Let's dig into some garden magic, ${userFirstName}!`, emoji: "✨" },
    { text: `Planting seeds of engagement today, ${userFirstName}?`, emoji: "📱" },
    { text: `Fresh plants, fresh opportunities, ${userFirstName}!`, emoji: "💚" },
    
    // Success & motivation
    { text: `Rise and shine, ${userFirstName}! Your gardeners are waiting.`, emoji: "🌅" },
    { text: `Good day for garden greatness, ${userFirstName}!`, emoji: "⭐" },
    { text: `Welcome to another fruitful day of growth, ${userFirstName}!`, emoji: "🍎" },
    
    // Playful garden puns
    { text: `Orange you excited for today's content, ${userFirstName}?`, emoji: "🍊" },
    { text: `Berry excited to boost your garden center today, ${userFirstName}!`, emoji: "🍓" },
    { text: `You're grape at gardening, ${userFirstName}!`, emoji: "🍇" },
    { text: `Lettuce create amazing content together, ${userFirstName}!`, emoji: "🥬" },
    { text: `Aloe there, ${userFirstName}! Ready to grow your garden center?`, emoji: "🌵" },
    { text: `Unbeleafable gardening potential ahead, ${userFirstName}!`, emoji: "🍃" },
    
    // Customer engagement themes
    { text: `Time to bloom where your customers are, ${userFirstName}!`, emoji: "🌺" },
    { text: `Your garden center deserves to flourish, ${userFirstName}!`, emoji: "🌻" },
    { text: `Let's help your garden center blossom, ${userFirstName}!`, emoji: "🌷" }
  ];
  
  // Pick a message based on the day of the year for daily rotation
  const messageIndex = dayOfYear % welcomeMessages.length;
  return welcomeMessages[messageIndex];
};

export const getSeasonalContent = () => {
  const month = new Date().getMonth() + 1;
  
  if (month >= 3 && month <= 5) {
    // Spring garden content
    return {
      theme: "Spring Garden Revival",
      posts: [
        {
          type: 'instagram',
          content: `🌸 Spring has officially arrived, and we couldn't be more excited to share this season of renewal and fresh possibilities with you! Our garden center is flourishing with new arrivals, expert advice, and everything you need to transform your outdoor space into a springtime paradise.

Whether you're a seasoned gardener or just starting your green thumb journey, our expert team is here to guide you through selecting the perfect plants for your unique space and growing conditions. From vibrant spring flowers and fresh vegetable starts to hardy perennials and everything in between, we've carefully curated varieties that thrive in our local climate.

This week, we're featuring our premium soil amendments and organic fertilizers that will give your garden the nutrients it needs to flourish. Plus, don't miss our Spring Planting Workshop happening all month long - it's the perfect time to learn about soil preparation and plant selection!

What's first on your spring planting list? Drop a comment below and let us know what you're most excited to grow this season! 🌱✨`,
          hashtags: '#SpringGardening #FreshStart #PlantLovers #GardenLife #SpringPlanting #LocalGardening #GrowYourOwn #GardenCenter',
          imageIdea: 'Vibrant spring garden display with colorful flowers and fresh plantings'
        },
        {
          type: 'facebook',
          content: `🌱 Spring Planting Workshop this Saturday! Join our gardening experts as we share tips for soil preparation, choosing the right plants for your space, and getting the most out of your spring garden.

This hands-on workshop will cover everything from seed starting and transplanting to companion planting and natural pest management. You'll leave with practical knowledge and a starter plant to begin your spring garden.

Whether you're dealing with clay soil, shade challenges, or limited space, our team has solutions that work. We'll also discuss succession planting strategies that can keep your harvest going all season long.

Register now - limited spots available! Workshop includes materials and a 15% discount on all plants purchased the day of the event.`,
          hashtags: '#SpringWorkshop #GardeningTips #LocalEvent',
          imageIdea: 'Workshop setup with gardening tools and plant starts'
        },
        {
          type: 'email',
          content: `Subject: Your Spring Garden Transformation Awaits! 🌻

Dear Gardening Friends,

Spring is the perfect time to refresh your garden! This week we're featuring our premium plant selection, organic soil amendments, and a stunning collection of spring bloomers.

Our spring garden collection includes everything you need for a successful season:
- Flowering perennials that provide lasting beauty
- Vegetable starts for immediate planting success
- Organic fertilizers for healthy soil and plants
- Garden tools and accessories for every gardener

Plus, don't miss our Spring Garden Sale happening all month long - save up to 25% on select plants and garden supplies!

Visit us this week to see what's blooming in the greenhouse and get personalized advice from our gardening experts.

Happy Gardening!
Your Garden Center Team`,
          hashtags: '#SpringNewsletter #GardenSale #PlantLovers',
          imageIdea: 'Newsletter header with spring garden and plant imagery'
        },
        {
          type: 'newsletter',
          content: `GARDEN CENTER QUARTERLY
Spring Edition - Volume 12

WELCOME TO SPRING GARDENING!
The season of renewal is here, and we're thrilled to share the latest plants, growing tips, and garden inspiration. This quarter brings exciting new varieties, expert workshops, and community garden initiatives to help you create your dream outdoor space.

FEATURED THIS MONTH
Our spring plant collection showcases carefully selected varieties that thrive in our local climate. From early-blooming perennials to heat-tolerant vegetables, we've curated plants that bring both beauty and bounty to your garden.

GARDENING WISDOM
Spring success starts with soil preparation. Our experts recommend testing your soil and adding compost before planting. This fundamental step can dramatically improve plant performance and garden productivity throughout the growing season.

COMMUNITY SPOTLIGHT
Thank you to all our customers who participated in last month's seed swap event. Together, we shared over 200 varieties of heirloom seeds while building stronger gardening connections in our community.

UPCOMING EVENTS
- Spring Planting Workshop: March 15th
- Vegetable Gardening Series: March 22-24
- Native Plant Sale: Starting April 1st

Stay connected with us for the latest garden inspiration and growing tips!`,
          hashtags: '#Quarterly #SpringGardening #CommunityEvents',
          imageIdea: 'Professional newsletter layout with spring garden photography'
        }
      ]
    };
  } else if (month >= 6 && month <= 8) {
    // Summer garden content
    return {
      theme: "Summer Garden Success",
      posts: [
        {
          type: 'instagram',
          content: `☀️ Summer heat got your garden worried? Don't sweat it! Our incredible collection of heat-tolerant plants are here to save the day and keep your garden absolutely thriving even during the hottest months of the year.

These drought-champion varieties, heat-loving annuals, and water-wise perennials are summer superstars - they've evolved to thrive in challenging conditions while still providing the color, fragrance, and harvest you want. From vibrant zinnias and marigolds to heat-loving herbs and resilient succulents, these plants prove that summer doesn't mean sacrificing beauty.

Summer gardening is all about working with the season, not against it. Our carefully selected heat-tolerant varieties not only survive summer's intensity but actually flourish, requiring minimal water once established.

Stop by this week for personalized advice on creating a summer garden that works with your specific microclimate and watering schedule. 🌊🏖️`,
          hashtags: '#SummerGardening #HeatTolerant #DroughtResistant #WaterWise #SummerPlants #LocalGardening #GardenCenter #SummerSuccess',
          imageIdea: 'Colorful summer garden display with heat-tolerant plants and flowers'
        },
        {
          type: 'facebook',
          content: `🌻 Summer Gardening Workshop Series continues this week! Learn how to create, maintain, and harvest from your summer garden. This week we're focusing on water-wise gardening, heat stress management, and succession planting.

Join us for an interactive session where you'll discover the secrets of successful summer gardening, from plant selection to irrigation techniques. We'll cover mulching strategies, companion planting for pest control, and harvesting tips that will keep your garden productive all season long.

Perfect timing for your summer planting! Each participant receives a starter collection of heat-tolerant plants and seeds featuring summer favorites.`,
          hashtags: '#SummerWorkshop #WaterWise #GardeningTips',
          imageIdea: 'Summer garden workshop with drought-tolerant plants displayed'
        },
        {
          type: 'email',
          content: `Subject: Beat the Heat with Smart Summer Gardening! 🌞

Hello Garden Enthusiasts!

Summer doesn't have to mean struggling gardens! Our latest newsletter features water-saving tips, heat-tolerant plant selections, and the best strategies for summer garden success.

BEAT THE SUMMER HEAT:
- Drought-resistant plants that save water and effort
- Mulching techniques that retain moisture and cool soil
- Watering strategies for maximum efficiency

SUMMER GARDEN STARS:
Create stunning summer displays that thrive in heat with our expert plant combinations and care advice.

Visit us for personalized summer gardening advice and take advantage of our heat-loving plant specials.

Keep growing!
Your Garden Center Team`,
          hashtags: '#SummerGardening #WaterWise #HeatTolerant',
          imageIdea: 'Summer garden with drought-tolerant plants and efficient watering'
        },
        {
          type: 'newsletter',
          content: `GARDEN CENTER QUARTERLY
Summer Edition - Volume 13

SUMMER GARDENING MASTERY
As temperatures rise and rainfall becomes unpredictable, successful gardening means working smarter, not harder. This edition focuses on creating beautiful, sustainable gardens that thrive in challenging summer conditions.

HEAT-SMART PLANT SELECTION
Discover varieties that flourish in challenging conditions. Our summer selection emphasizes plants that provide stunning color and fragrance while requiring minimal water once established.

WATER-WISE TECHNIQUES
Learn professional irrigation strategies that maximize plant health while minimizing water use. From drip irrigation to mulching mastery, small changes can make a big difference.

UPCOMING SUMMER EVENTS
- Water-Wise Gardening Workshop: July 4th weekend
- Evening Garden Tours: Every Friday in July
- Summer Harvest Festival: July 20th

Stay cool and keep growing!`,
          hashtags: '#SummerQuarterly #WaterWise #HeatTolerant',
          imageIdea: 'Professional newsletter with summer garden photography'
        }
      ]
    };
  } else if (month >= 9 && month <= 11) {
    // Fall garden content
    return {
      theme: "Autumn Garden Glory",
      posts: [
        {
          type: 'instagram',
          content: `🍂 Fall is absolutely gardening's grand finale, and right now our plant selection is putting on the most spectacular show of the year! Our stunning mums in every color imaginable, gorgeous fall perennials painting the landscape in warm hues, and vibrant autumn vegetables are creating a breathtaking fall garden paradise.

But here's a secret that many gardeners don't know: fall is actually one of THE BEST times to plant trees, shrubs, and perennials! While everyone else is thinking about putting their gardens to bed, smart gardeners are taking advantage of cooler temperatures and autumn rains to establish new plantings.

Fall planting offers so many advantages - less watering stress, natural seasonal establishment that strengthens root systems, and the opportunity to secure the best plant selections before winter.

What fall treasures are calling to your garden this year? Come explore our autumn garden wonderland! 🎯🍁`,
          hashtags: '#FallGardening #AutumnPlanting #FallColors #Mums #FallPerennials #TreePlanting #LocalGardening #GardenCenter',
          imageIdea: 'Rich autumn garden display with colorful mums and fall foliage'
        },
        {
          type: 'facebook',
          content: `🌰 Fall Planting Workshop this weekend! Learn the secrets of fall garden preparation, proper planting techniques, and which varieties to plant now for next year's success.

This comprehensive workshop covers essential fall gardening tasks that will set your garden up for success through winter and into next spring. We'll demonstrate proper planting depth, show you how to protect tender plants, and share strategies for extending your growing season.

Workshop participants receive a fall planting guide, seasonal care calendar, and 15% off all trees and shrubs.`,
          hashtags: '#FallPlanting #GardeningWorkshop #TreesAndShrubs',
          imageIdea: 'Fall planting demonstration with trees and garden tools'
        },
        {
          type: 'email',
          content: `Subject: Fall Into Garden Success! 🍁

Dear Gardening Friends,

Fall is prime time for garden investment! While others are winding down, smart gardeners are planting trees, establishing perennials, and preparing for next year's spectacular garden.

FALL PLANTING ADVANTAGES:
- Cooler temperatures reduce transplant stress
- Autumn rains provide natural irrigation
- Root establishment happens during ideal conditions

DON'T MISS OUR FALL TREE SALE:
Save 30% on shade trees, flowering trees, and ornamental varieties that will transform your landscape.

Happy Fall Gardening!
Your Garden Center Team`,
          hashtags: '#FallPlanting #TreeSale #GardenInvestment',
          imageIdea: 'Beautiful fall garden with newly planted trees and autumn colors'
        },
        {
          type: 'newsletter',
          content: `GARDEN CENTER QUARTERLY
Fall Edition - Volume 14

AUTUMN OPPORTUNITIES
Fall gardening offers unique opportunities for both immediate beauty and long-term garden success. This season's focus is on maximizing autumn's advantages while preparing for the year ahead.

FALL PLANTING ADVANTAGES
Cooler temperatures and autumn moisture make fall ideal for establishing trees and perennials. Plants installed now develop strong root systems over winter, ensuring vigorous growth next spring.

SEASONAL BEAUTY
Our fall plant selection includes both classic favorites and exciting new varieties that will transform your autumn landscape with stunning color and texture.

GARDEN MAINTENANCE
Proper fall garden care sets the foundation for next year's success. From leaf management to plant protection, autumn tasks ensure a healthy, productive garden.

NOVEMBER EVENTS
- Tree Planting Workshop: November 2nd
- Fall Garden Cleanup Clinic: November 16th
- Holiday Wreath Making: November 30th

Embrace the season!`,
          hashtags: '#FallQuarterly #TreePlanting #SeasonalGardening',
          imageIdea: 'Professional newsletter with fall garden scenes'
        }
      ]
    };
  } else {
    // Winter garden content
    return {
      theme: "Winter Garden Care",
      posts: [
        {
          type: 'instagram',
          content: `❄️ Think winter means your garden has to go dormant until spring? Think again! Winter gardening is one of our absolute favorite topics because there are so many ways to keep beauty, interest, and even harvests thriving in your garden even during the coldest months.

Our carefully selected evergreen plants provide the backbone of winter gardens - from stunning conifers and broad-leaved evergreens to winter-blooming camellias and hellebores. These year-round champions don't just survive winter; they define it with their structure and seasonal interest.

Winter also adds unique opportunities - think berry-producing shrubs for wildlife, ornamental grasses that provide movement and texture, and even cold-hardy vegetables that actually improve in flavor after frost.

Winter is also the perfect time for garden planning! What winter interests are you planning to add? ❄️🌿`,
          hashtags: '#WinterGardening #Evergreens #WinterInterest #ColdHardy #WinterBeauty #GardenPlanning #LocalGardening #GardenCenter',
          imageIdea: 'Beautiful winter garden with evergreens and winter interest plants'
        },
        {
          type: 'facebook',
          content: `🌲 Holiday Wreath Workshop this Saturday! Create beautiful, natural decorations using fresh evergreens, berries, and seasonal elements from local sources.

Join us for this festive hands-on workshop where you'll learn professional wreath-making techniques while creating stunning holiday decorations for your home. We'll provide all materials including wire frames, fresh evergreen boughs, and decorative elements.

All materials provided - just bring your creativity! Each participant creates one large wreath to take home, plus receives a 20% discount on additional holiday plants and decorations.`,
          hashtags: '#HolidayWorkshop #WreathMaking #HolidayDecorating',
          imageIdea: 'Holiday wreath-making workshop with evergreen materials'
        },
        {
          type: 'email',
          content: `Subject: Winter Garden Magic Awaits! ⛄

Warm Greetings!

Winter is the perfect time for garden reflection and planning. Our evergreen selection is thriving, and we're here to help you bring year-round beauty into your landscape.

WINTER GARDEN CARE:
- Protecting tender plants from freeze damage
- Providing adequate water during dry winter periods
- Positioning plants for optimal winter interest

HOLIDAY PLANTS:
Fresh wreaths, garlands, and live holiday trees using sustainable, locally-sourced evergreens. Custom arrangements available for your holiday decorating needs.

Stay warm and keep planning!
Your Garden Center Team`,
          hashtags: '#WinterNewsletter #EvergreensWinterGarden #HolidayPlants',
          imageIdea: 'Cozy winter garden scene with evergreens and holiday decorations'
        },
        {
          type: 'newsletter',
          content: `GARDEN CENTER QUARTERLY
Winter Edition - Volume 15

WINTER WONDER
Winter gardening extends far beyond holiday decorations and houseplant care. This season offers unique opportunities to appreciate garden structure, plan improvements, and prepare for the growing year ahead.

EVERGREEN EXCELLENCE
Bring your garden vision to life with our extensive evergreen selection. From foundation plantings to specimen trees, evergreens provide year-round structure and beauty while supporting local wildlife.

GARDEN STRUCTURE
Appreciate the "bones" of your garden during winter months. Evergreen plants, ornamental grasses, and interesting bark become focal points, revealing opportunities for enhancement.

PLANNING AND PREPARATION
Winter's quiet months are ideal for garden planning. Review last year's successes and challenges, research new varieties, and design next year's improvements.

WINTER WORKSHOPS
Educational opportunities continue through winter with holiday decorating, houseplant care, and garden planning workshops that set the stage for spring success.

FEBRUARY PREVIEW
- Early seed starting programs
- Garden design consultations
- Pruning workshops

Embrace winter's gifts!`,
          hashtags: '#WinterQuarterly #Evergreens #GardenPlanning',
          imageIdea: 'Professional newsletter with winter garden photography'
        }
      ]
    };
  }
};
