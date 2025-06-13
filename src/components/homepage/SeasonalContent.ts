export const getSeasonalGreeting = () => {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return { emoji: "🌸", text: "Spring is here!" };
  if (month >= 6 && month <= 8) return { emoji: "☀️", text: "Summer vibes!" };
  if (month >= 9 && month <= 11) return { emoji: "🍂", text: "Fall beauty!" };
  return { emoji: "❄️", text: "Winter magic!" };
};

// Marketing-focused welcome messages with plant metaphors
export const getWelcomeMessage = (businessName?: string, firstName?: string) => {
  // Use date to create a predictable but changing rotation
  const date = new Date();
  
  // Calculate day of year more safely
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  
  // Business name or fallback
  const name = businessName || "Your Business";
  const userFirstName = firstName || "there";
  
  // Array of marketing-focused welcome messages with plant metaphors
  const welcomeMessages = [
    // Business growth themes
    { text: `Welcome back to your growing business, ${name}!`, emoji: "🌱" },
    { text: `Ready to cultivate success today, ${userFirstName}?`, emoji: "🌿" },
    { text: `Time to plant some marketing seeds, ${userFirstName}!`, emoji: "🌰" },
    
    // Seasonal marketing messages
    { text: `${getSeasonalGreeting().emoji} ${getSeasonalGreeting().text} Let's grow your reach, ${userFirstName}!`, emoji: getSeasonalGreeting().emoji },
    { text: `Another day to nurture customer relationships, ${userFirstName}!`, emoji: "🌸" },
    { text: `Marketing wisdom awaits you today, ${userFirstName}!`, emoji: "🧠" },
    
    // Creative & fun marketing
    { text: `Let's dig into some marketing magic, ${userFirstName}!`, emoji: "✨" },
    { text: `Planting seeds of engagement today, ${userFirstName}?`, emoji: "📱" },
    { text: `Fresh content, fresh opportunities, ${userFirstName}!`, emoji: "💚" },
    
    // Success & motivation
    { text: `Rise and shine, ${userFirstName}! Your audience is waiting.`, emoji: "🌅" },
    { text: `Good day for marketing greatness, ${userFirstName}!`, emoji: "⭐" },
    { text: `Welcome to another fruitful day of growth, ${userFirstName}!`, emoji: "🍎" },
    
    // Playful marketing puns
    { text: `Orange you excited for today's content, ${userFirstName}?`, emoji: "🍊" },
    { text: `Berry excited to boost your business today, ${userFirstName}!`, emoji: "🍓" },
    { text: `You're grape at marketing, ${userFirstName}!`, emoji: "🍇" },
    { text: `Lettuce create amazing content together, ${userFirstName}!`, emoji: "🥬" },
    { text: `Aloe there, ${userFirstName}! Ready to grow your brand?`, emoji: "🌵" },
    { text: `Unbeleafable marketing potential ahead, ${userFirstName}!`, emoji: "🍃" },
    
    // Customer engagement themes
    { text: `Time to bloom where your customers are, ${userFirstName}!`, emoji: "🌺" },
    { text: `Your brand deserves to flourish, ${userFirstName}!`, emoji: "🌻" },
    { text: `Let's help your business blossom, ${userFirstName}!`, emoji: "🌷" }
  ];
  
  // Pick a message based on the day of the year for daily rotation
  const messageIndex = dayOfYear % welcomeMessages.length;
  return welcomeMessages[messageIndex];
};

export const getSeasonalContent = () => {
  const month = new Date().getMonth() + 1;
  
  if (month >= 3 && month <= 5) {
    // Spring marketing content
    return {
      theme: "Spring Marketing Revival",
      posts: [
        {
          type: 'instagram',
          content: `🌸 Spring has officially arrived, and we couldn't be more excited to share this season of renewal and fresh opportunities with you! Our marketing approach is flourishing with new strategies, innovative campaigns, and everything you need to transform your brand presence into a springtime sensation.

Whether you're a seasoned business owner or just starting your entrepreneurial journey, our expert team is here to guide you through selecting the perfect marketing strategies for your unique audience and business goals. From vibrant social media campaigns and engaging email newsletters to compelling video content that resonates year-round, we've carefully cultivated approaches that thrive in today's digital landscape.

This week, we're featuring our premium content creation services and organic growth strategies that will give your brand the visibility it needs to flourish. Plus, don't miss our Spring Marketing Campaign happening all month long - it's the perfect time to plant the seeds for sustainable business growth!

What's first on your spring marketing list? Drop a comment below and let us know what you're most excited to grow this season! 🌱✨`,
          hashtags: '#SpringMarketing #FreshStart #BrandGrowth #MarketingStrategy #ContentCreation #DigitalMarketing #BusinessGrowth #MarketingTips',
          imageIdea: 'Vibrant spring-themed marketing materials with fresh, colorful design elements'
        },
        {
          type: 'facebook',
          content: `🌱 Spring Marketing Workshop this Saturday! Join our experts as we share strategies for refreshing your brand message, choosing the right platforms for your audience, and getting the most out of your spring campaigns.

This hands-on workshop will cover everything from content planning and audience engagement to campaign optimization and performance tracking. You'll leave with actionable strategies and a starter toolkit to launch your spring marketing initiatives.

Whether you're dealing with limited budgets, audience challenges, or time constraints, our team has solutions that work. We'll also discuss cross-platform strategies that can help your marketing efforts grow naturally while reducing complexity.

Register now - limited spots available! Workshop includes resources and a 15% discount on all marketing services booked the day of the event.`,
          hashtags: '#SpringWorkshop #MarketingTips #BusinessEvent',
          imageIdea: 'Workshop setup with marketing materials and planning tools'
        },
        {
          type: 'email',
          content: `Subject: Your Spring Marketing Transformation Awaits! 🌻

Dear Business Leaders,

Spring is the perfect time to refresh your marketing approach! This week we're featuring our premium content strategies, organic growth techniques, and a stunning collection of spring campaign ideas.

Our spring marketing collection includes everything you need for a successful season:
- Engaging content frameworks that provide lasting impact
- Seasonal campaigns for immediate results
- Organic growth strategies for sustainable success
- Performance tracking solutions for better ROI

Plus, don't miss our Spring Marketing Package happening all month long - save up to 25% on select services!

Visit us this week to see what's blooming in marketing and get personalized advice from our strategy experts.

Happy Marketing!
Your Growth Team`,
          hashtags: '#SpringNewsletter #MarketingPackage #BusinessGrowth',
          imageIdea: 'Newsletter header with spring business growth imagery'
        },
        {
          type: 'newsletter',
          content: `MARKETING GROWTH QUARTERLY
Spring Edition - Volume 12

WELCOME TO SPRING MARKETING!
The season of renewal is here, and we're thrilled to share the latest marketing strategies and growth opportunities. This quarter brings exciting new approaches, expert insights, and community initiatives to help you create your dream marketing results.

FEATURED THIS MONTH
Our spring marketing collection showcases carefully selected strategies that thrive in today's business climate. From audience-focused content to performance-driven campaigns, we've curated approaches that bring both engagement and measurable results to your business.

MARKETING WISDOM
Spring campaign success starts with audience research. Our experts recommend understanding your customer journey and adding value-driven content before launching campaigns. This fundamental step can dramatically improve engagement and business growth throughout the season.

COMMUNITY SPOTLIGHT
Thank you to all our clients who participated in last month's collaborative marketing initiative. Together, we launched over 200 pieces of content that generated significant engagement while building stronger brand communities.

UPCOMING EVENTS
- Spring Campaign Workshop: March 15th
- Content Strategy Bootcamp: March 22-24
- Business Growth Accelerator: Starting April 1st

Stay connected with us for the latest updates and marketing inspiration!`,
          hashtags: '#Quarterly #SpringMarketing #BusinessEvents',
          imageIdea: 'Professional newsletter layout with spring marketing themes'
        }
      ]
    };
  } else if (month >= 6 && month <= 8) {
    // Summer marketing content
    return {
      theme: "Summer Marketing Momentum",
      posts: [
        {
          type: 'instagram',
          content: `☀️ Summer marketing got you worried about engagement drops? Don't sweat it! Our incredible collection of high-impact strategies are here to save the day and keep your brand visibility absolutely soaring even during the traditionally slower months of the year.

These proven techniques, engagement boosters, and audience-focused campaigns are marketing champions - they've evolved to thrive in challenging seasonal conditions while still providing the reach, interaction, and business results you want. From dynamic social media content and targeted email sequences to compelling video marketing and resilient SEO strategies, these approaches prove that summer slowdown doesn't mean sacrificing growth.

Summer marketing is all about working with seasonal behaviors, not against them. Our carefully selected high-performance strategies not only survive the summer lull but actually flourish, requiring minimal adjustment once implemented.

Stop by this week for personalized advice on creating a summer marketing plan that works with your specific audience, industry, and business goals. 🌊🏖️`,
          hashtags: '#SummerMarketing #HighImpact #AudienceEngagement #SeasonalStrategy #DigitalMarketing #ContentStrategy #BusinessGrowth #MarketingMomentum',
          imageIdea: 'Dynamic summer marketing visuals with high-energy campaign elements'
        },
        {
          type: 'facebook',
          content: `🌻 Summer Content Workshop Series continues this week! Learn how to create, optimize, and distribute content that engages your audience during the summer months. This week we're focusing on visual content, storytelling, and seasonal campaigns.

Join us for an interactive session where you'll discover the secrets of successful summer marketing, from strategy to execution. We'll cover optimal content types, audience engagement tactics, and performance measurement techniques that will keep your marketing effective all season long.

Perfect timing for your summer business initiatives! Each participant receives a starter content toolkit and strategy templates featuring seasonal favorites.`,
          hashtags: '#ContentWorkshop #SummerMarketing #EngagementStrategies',
          imageIdea: 'Fresh content marketing materials arranged for workshop demonstration'
        },
        {
          type: 'email',
          content: `Subject: Summer Marketing Made Easy! 🌞

Hello Growth Champions!

Summer marketing doesn't have to be a struggle! Our latest newsletter features engagement-boosting tips, audience retention strategies, and the best approaches for summer campaigns.

BEAT THE SUMMER SLUMP:
- Attention-grabbing content techniques that save time and resources
- Engagement strategies for maintaining audience interest
- Seasonal solutions for consistent performance

SUMMER CAMPAIGN IDEAS:
Create stunning marketing initiatives that thrive in summer with our expert strategy combinations.

Visit us for personalized summer marketing advice and take advantage of our season-specific recommendations.

Keep growing!
Your Marketing Team`,
          hashtags: '#SummerMarketing #EngagementBoost #CampaignStrategy',
          imageIdea: 'Summer marketing campaign arrangements'
        },
        {
          type: 'newsletter',
          content: `MARKETING GROWTH QUARTERLY
Summer Edition - Volume 13

SUMMER MARKETING SURVIVAL GUIDE
As temperatures rise and attention spans shorten, successful marketing means working smarter, not harder. This edition focuses on creating beautiful, sustainable campaigns that thrive in summer while maintaining engagement and reducing effort.

SUMMER-SMART STRATEGIES
Discover approaches that flourish in challenging conditions. Our summer selection emphasizes techniques that provide stunning results and engagement while requiring minimal maintenance once established.

ATTENTION-WISE TECHNIQUES
Learn professional engagement strategies that maximize audience retention while minimizing resource use. From automated sequences to content repurposing mastery, small changes can make a big difference.

UPCOMING SUMMER EVENTS
- High-Impact Campaign Workshop: July 4th weekend
- Evening Strategy Sessions: Every Friday in July
- Summer Content Creation Workshop: July 20th

Stay cool and keep growing!`,
          hashtags: '#SummerQuarterly #EngagementStrategies #MarketingWisdom',
          imageIdea: 'Professional newsletter with summer marketing photography'
        }
      ]
    };
  } else if (month >= 9 && month <= 11) {
    // Fall marketing content
    return {
      theme: "Autumn Marketing Harvest",
      posts: [
        {
          type: 'instagram',
          content: `🍂 Fall is absolutely marketing's grand finale, and right now our strategy collection is putting on the most spectacular performance of the year! Our stunning campaign frameworks in every approach imaginable, powerful conversion tactics painting results in remarkable numbers, and vibrant customer engagement strategies are creating a breathtaking autumn business landscape.

But here's a secret that many marketers don't know: fall is actually one of THE BEST times to launch major campaigns and initiatives! While everyone else is thinking about winding down their marketing efforts for the year, smart business owners are taking advantage of increased consumer activity and holiday preparation seasons to establish new market presence.

Fall marketing offers so many advantages - higher audience engagement, natural seasonal relevance that reduces content creation needs, and the opportunity to capture attention before the holiday rush begins.

What fall strategies are calling to your business this year? Come explore our autumn marketing wonderland! 🎯🍁`,
          hashtags: '#FallMarketing #AutumnStrategy #CampaignLaunch #HolidayPrep #SeasonalMarketing #ConversionBoost #BusinessStrategy #MarketingHarvest',
          imageIdea: 'Rich autumn-themed marketing materials with harvest and results imagery'
        },
        {
          type: 'facebook',
          content: `🌰 Fall Marketing Prep Workshop this weekend! Learn the secrets of preparing your business for holiday season, proper campaign planning techniques, and which strategies to implement now for next quarter's success.

This comprehensive workshop covers essential fall marketing tasks that will set your business up for success through the end of the year. We'll demonstrate proper audience segmentation techniques, show you how to protect your marketing budget, and share strategies for extending your campaign effectiveness.

Workshop participants receive a seasonal planning guide, campaign calendar template, and 15% off all fall marketing services.`,
          hashtags: '#FallPrep #HolidayReady #MarketingWorkshop',
          imageIdea: 'Marketing planning tools and campaign calendars for fall preparation'
        },
        {
          type: 'email',
          content: `Subject: Fall Into Marketing Success! 🍁

Dear Marketing Friends,

Fall is the secret season for business growth! While others are winding down, smart marketers are planning holiday campaigns, optimizing conversion funnels, and preparing for next quarter's success.

FALL MARKETING OPPORTUNITIES:
- Holiday campaign planning for maximum impact
- Year-end promotions and customer appreciation
- Strategic planning for Q1 success

DON'T MISS OUR FALL STRATEGY SALE:
Save 30% on premium marketing services including campaign development, content creation, and performance optimization.

Happy Fall Marketing!
Your Growth Strategy Team`,
          hashtags: '#FallMarketing #BusinessPrep #HolidayPlanning',
          imageIdea: 'Variety of fall-themed marketing materials and planning documents'
        },
        {
          type: 'newsletter',
          content: `MARKETING GROWTH QUARTERLY
Fall Edition - Volume 14

AUTUMN OPPORTUNITIES
Fall marketing offers unique opportunities for both immediate results and long-term business success. This season's focus is on maximizing autumn engagement while preparing for the year ahead.

FALL CAMPAIGN ADVANTAGES
Increased consumer activity and holiday preparation make fall ideal for launching new initiatives. Campaigns started now develop strong audience connections over winter, ensuring vigorous growth next spring.

HOLIDAY PLANNING
Now is the time to prepare holiday marketing for maximum impact. Our fall strategy selection includes both classic approaches and exciting new techniques that will transform your business results come holiday season.

SEASONAL MAINTENANCE
Proper fall marketing preparation sets the foundation for next year's success. From audience segmentation to campaign optimization, autumn tasks ensure a healthy, profitable business.

NOVEMBER EVENTS
- Holiday Campaign Workshop: November 2nd
- Year-End Strategy Clinic: November 16th
- Content Planning Session: November 30th

Embrace the season!`,
          hashtags: '#FallQuarterly #HolidayPlanning #SeasonalStrategy',
          imageIdea: 'Professional newsletter with fall marketing scenes'
        }
      ]
    };
  } else {
    // Winter marketing content
    return {
      theme: "Winter Marketing Planning",
      posts: [
        {
          type: 'instagram',
          content: `❄️ Think winter means your marketing has to hibernate until spring? Think again! Winter marketing is one of our absolute favorite topics because there are so many ways to keep engagement, conversions, and business growth thriving in your strategy even during the quietest months.

Our carefully selected evergreen campaigns provide the backbone of winter marketing - from year-round email sequences and consistent social media presence to strategic content marketing and reliable SEO foundations. These always-on champions don't just survive winter; they define it with their consistent performance and steadfast results.

Winter planning also adds strategic preparation opportunities - think detailed customer research, comprehensive strategy development, and thorough market analysis. Smart business owners use winter's natural reflection period for planning next year's major initiatives.

Winter is also the perfect time for optimizing existing campaigns! What winter strategies are you planning to implement? ❄️📈`,
          hashtags: '#WinterMarketing #EvergreenStrategy #BusinessPlanning #MarketingOptimization #CustomerResearch #StrategicPlanning #YearRoundGrowth #MarketingFoundation',
          imageIdea: 'Professional winter planning visuals with strategy and analysis elements'
        },
        {
          type: 'facebook',
          content: `🌲 Holiday Campaign Workshop this Saturday! Create beautiful, effective marketing using proven strategies, engagement techniques, and conversion optimization from industry experts.

Join us for this strategic hands-on workshop where you'll learn professional campaign development techniques while creating stunning holiday marketing for your business. We'll provide all frameworks, templates, and strategic guidance.

All materials provided - just bring your creativity! Each participant creates one complete holiday campaign to implement, plus receives a 20% discount on additional marketing services.`,
          hashtags: '#HolidayWorkshop #CampaignPlanning #MarketingSuccess',
          imageIdea: 'Workshop table with marketing planning materials'
        },
        {
          type: 'email',
          content: `Subject: Winter Marketing Magic Awaits! ⛄

Warm Greetings!

Winter is the perfect time for marketing planning and audience nurturing. Our strategy collection is thriving, and we're here to help you bring new life into your business during the quieter months.

WINTER MARKETING CARE:
- Adjusting campaigns for seasonal consumer behavior
- Providing adequate engagement in competitive markets
- Positioning content for optimal winter conversion

HOLIDAY MARKETING:
Fresh campaign ideas, engagement strategies, and conversion optimization using proven techniques. Custom strategies available for your holiday marketing needs.

Stay warm and keep planning!
Your Winter Marketing Team`,
          hashtags: '#WinterNewsletter #MarketingPlanning #BusinessStrategy',
          imageIdea: 'Cozy winter marketing planning scene'
        },
        {
          type: 'newsletter',
          content: `MARKETING GROWTH QUARTERLY
Winter Edition - Volume 15

WINTER WONDER
Winter marketing extends far beyond holiday campaigns and year-end promotions. This season offers unique opportunities to appreciate business foundations, plan improvements, and prepare for the growing year ahead.

STRATEGIC PLANNING
Bring your marketing vision to life with our extensive strategy development process. From audience analysis to campaign frameworks, winter is perfect for expanding your marketing foundation and improving business results.

BUSINESS STRUCTURE
Appreciate the "bones" of your business during winter months. Core offerings, customer journeys, and foundational messaging become focal points, revealing optimization opportunities for enhancement.

PLANNING AND PREPARATION
Winter's quiet months are ideal for marketing planning. Review last year's successes and challenges, research new approaches, and design next year's improvements.

WINTER WORKSHOPS
Educational opportunities continue through winter with strategic planning, campaign development, and preparation workshops that set the stage for spring success.

FEBRUARY PREVIEW
- Early campaign development programs
- Marketing design consultations
- Business growth strategy clinics

Embrace winter's gifts!`,
          hashtags: '#WinterQuarterly #MarketingPlanning #BusinessStrategy',
          imageIdea: 'Professional newsletter with winter business planning photos'
        }
      ]
    };
  }
};
