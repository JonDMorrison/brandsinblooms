// Garden center-specific automation templates
export interface GardenCenterTemplate {
  id: string;
  name: string;
  description: string;
  category: 'welcome' | 'seasonal' | 'care' | 'sales' | 'retention';
  complexity: 'simple' | 'advanced' | 'expert';
  estimatedSetupTime: number; // minutes
  businessGoal: string;
  triggerType: string;
  channels: ('email' | 'sms')[];
  flow_data: {
    nodes: any[];
    edges: any[];
  };
  preview: {
    stepCount: number;
    emailCount: number;
    smsCount: number;
    delayCount: number;
  };
  performance: {
    avgOpenRate: number;
    avgClickRate: number;
    avgRevenue: number;
  };
  seasonalRelevance?: string[];
  plantTypes?: string[];
}

export const gardenCenterTemplates: GardenCenterTemplate[] = [
  // WELCOME SERIES
  {
    id: 'new-gardener-welcome',
    name: 'New Gardener Welcome Series',
    description: 'Welcome first-time plant parents with care tips and confidence-building guidance',
    category: 'welcome',
    complexity: 'simple',
    estimatedSetupTime: 10,
    businessGoal: 'Welcome new customers and build confidence',
    triggerType: 'loyalty_join',
    channels: ['email', 'sms'],
    flow_data: {
      nodes: [
        { id: 'trigger-1', type: 'trigger', position: { x: 100, y: 50 }, data: { triggerType: 'loyalty_join', label: 'New Customer Signs Up' } },
        { id: 'email-1', type: 'email', position: { x: 100, y: 200 }, data: { 
          subject: 'Welcome to Your Plant Journey! 🌱', 
          content: 'Hi {{first_name}}, Welcome to our garden center family! We\'re here to help you grow beautiful plants and create the garden of your dreams. Get started with our beginner\'s plant care guide.' 
        }},
        { id: 'delay-1', type: 'delay', position: { x: 100, y: 350 }, data: { delayValue: 3, delayUnit: 'days' } },
        { id: 'email-2', type: 'email', position: { x: 100, y: 500 }, data: { 
          subject: 'Your First Plants: What to Expect', 
          content: 'Day 3 check-in! How are your new plants doing? Here are 5 signs your plants are happy and thriving...' 
        }},
        { id: 'delay-2', type: 'delay', position: { x: 100, y: 650 }, data: { delayValue: 7, delayUnit: 'days' } },
        { id: 'sms-1', type: 'sms', position: { x: 100, y: 800 }, data: { 
          content: '🌱 Week 1 complete! Your plants should be settling in nicely. Need help? Reply HELP for tips or visit us anytime!' 
        }}
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'email-1' },
        { id: 'e2', source: 'email-1', target: 'delay-1' },
        { id: 'e3', source: 'delay-1', target: 'email-2' },
        { id: 'e4', source: 'email-2', target: 'delay-2' },
        { id: 'e5', source: 'delay-2', target: 'sms-1' }
      ]
    },
    preview: { stepCount: 6, emailCount: 2, smsCount: 1, delayCount: 2 },
    performance: { avgOpenRate: 68, avgClickRate: 15, avgRevenue: 45 },
    plantTypes: ['all']
  },
  
  // SEASONAL CAMPAIGNS
  {
    id: 'spring-awakening',
    name: 'Spring Awakening Campaign',
    description: 'Get customers excited about spring planting season with timely reminders and offers',
    category: 'seasonal',
    complexity: 'advanced',
    estimatedSetupTime: 20,
    businessGoal: 'Drive spring sales and engagement',
    triggerType: 'seasonal_spring',
    channels: ['email', 'sms'],
    flow_data: {
      nodes: [
        { id: 'trigger-1', type: 'trigger', position: { x: 150, y: 50 }, data: { triggerType: 'seasonal_spring', label: 'Spring Season Starts' } },
        { id: 'email-1', type: 'email', position: { x: 100, y: 200 }, data: { 
          subject: 'Spring is Here! Time to Plant 🌸', 
          content: 'The frost risk is passing and it\'s time to get your garden ready! This week\'s perfect for planting cool-season crops and preparing beds.' 
        }},
        { id: 'sms-1', type: 'sms', position: { x: 250, y: 200 }, data: { 
          content: '🌱 Spring planting season is here! Cool-season veggies can go in now. Visit us for fresh seedlings!' 
        }},
        { id: 'delay-1', type: 'delay', position: { x: 175, y: 350 }, data: { delayValue: 5, delayUnit: 'days' } },
        { id: 'split-1', type: 'split', position: { x: 175, y: 500 }, data: { condition: 'purchased_seeds', label: 'Bought Seeds?' } },
        { id: 'email-2', type: 'email', position: { x: 100, y: 650 }, data: { 
          subject: 'How Are Your Seeds Growing?', 
          content: 'Check-in time! Your seeds should be showing signs of life. Here\'s what to watch for...' 
        }},
        { id: 'email-3', type: 'email', position: { x: 300, y: 650 }, data: { 
          subject: 'Last Chance for Cool-Season Planting!', 
          content: 'Don\'t miss out! This week is your last chance for lettuce, peas, and spinach. Get 20% off all cool-season seeds!' 
        }}
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'email-1' },
        { id: 'e2', source: 'trigger-1', target: 'sms-1' },
        { id: 'e3', source: 'email-1', target: 'delay-1' },
        { id: 'e4', source: 'sms-1', target: 'delay-1' },
        { id: 'e5', source: 'delay-1', target: 'split-1' },
        { id: 'e6', source: 'split-1', target: 'email-2' },
        { id: 'e7', source: 'split-1', target: 'email-3' }
      ]
    },
    preview: { stepCount: 8, emailCount: 3, smsCount: 1, delayCount: 1 },
    performance: { avgOpenRate: 72, avgClickRate: 22, avgRevenue: 125 },
    seasonalRelevance: ['spring'],
    plantTypes: ['vegetables', 'herbs', 'flowers']
  },

  // PLANT CARE SERIES
  {
    id: 'tomato-care-journey',
    name: 'Tomato Growing Journey',
    description: 'Guide customers through the complete tomato growing season with timely care tips',
    category: 'care',
    complexity: 'expert',
    estimatedSetupTime: 35,
    businessGoal: 'Build expertise and increase customer success',
    triggerType: 'plant_care_reminder',
    channels: ['email', 'sms'],
    flow_data: {
      nodes: [
        { id: 'trigger-1', type: 'trigger', position: { x: 200, y: 50 }, data: { triggerType: 'plant_care_reminder', label: 'Tomato Purchase' } },
        { id: 'email-1', type: 'email', position: { x: 200, y: 200 }, data: { 
          subject: 'Your Tomato Success Guide 🍅', 
          content: 'Congrats on your tomato plants! Here\'s your week-by-week care calendar for the best harvest...' 
        }},
        { id: 'delay-1', type: 'delay', position: { x: 200, y: 350 }, data: { delayValue: 14, delayUnit: 'days' } },
        { id: 'sms-1', type: 'sms', position: { x: 200, y: 500 }, data: { 
          content: '🍅 Week 2: Time to check your tomato seedlings! Look for new growth and side shoots. Need support stakes? We have them!' 
        }},
        { id: 'delay-2', type: 'delay', position: { x: 200, y: 650 }, data: { delayValue: 21, delayUnit: 'days' } },
        { id: 'email-2', type: 'email', position: { x: 200, y: 800 }, data: { 
          subject: 'Pruning Time: Maximize Your Tomato Harvest', 
          content: 'Week 5 is crucial! Time to prune suckers and add support. Here\'s exactly how to do it...' 
        }},
        { id: 'delay-3', type: 'delay', position: { x: 200, y: 950 }, data: { delayValue: 28, delayUnit: 'days' } },
        { id: 'split-1', type: 'split', position: { x: 200, y: 1100 }, data: { condition: 'flowering_stage', label: 'Flowering Started?' } },
        { id: 'email-3', type: 'email', position: { x: 100, y: 1250 }, data: { 
          subject: 'Flowers = Future Tomatoes! 🌸', 
          content: 'Great news - flowers mean tomatoes are coming! Here\'s how to ensure good fruit set...' 
        }},
        { id: 'email-4', type: 'email', position: { x: 300, y: 1250 }, data: { 
          subject: 'Troubleshooting: Why No Flowers Yet?', 
          content: 'Don\'t worry if you don\'t see flowers yet. Here are the most common reasons and solutions...' 
        }}
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'email-1' },
        { id: 'e2', source: 'email-1', target: 'delay-1' },
        { id: 'e3', source: 'delay-1', target: 'sms-1' },
        { id: 'e4', source: 'sms-1', target: 'delay-2' },
        { id: 'e5', source: 'delay-2', target: 'email-2' },
        { id: 'e6', source: 'email-2', target: 'delay-3' },
        { id: 'e7', source: 'delay-3', target: 'split-1' },
        { id: 'e8', source: 'split-1', target: 'email-3' },
        { id: 'e9', source: 'split-1', target: 'email-4' }
      ]
    },
    preview: { stepCount: 10, emailCount: 4, smsCount: 1, delayCount: 3 },
    performance: { avgOpenRate: 75, avgClickRate: 28, avgRevenue: 85 },
    seasonalRelevance: ['spring', 'summer'],
    plantTypes: ['tomatoes', 'vegetables']
  },

  // SALES & PROMOTIONS
  {
    id: 'weekend-special-blast',
    name: 'Weekend Special Announcement',
    description: 'Drive weekend traffic with flash sales and special offers',
    category: 'sales',
    complexity: 'simple',
    estimatedSetupTime: 8,
    businessGoal: 'Increase weekend sales and foot traffic',
    triggerType: 'weekly_promotion',
    channels: ['sms', 'email'],
    flow_data: {
      nodes: [
        { id: 'trigger-1', type: 'trigger', position: { x: 150, y: 50 }, data: { triggerType: 'weekly_promotion', label: 'Friday Morning' } },
        { id: 'sms-1', type: 'sms', position: { x: 100, y: 200 }, data: { 
          content: '🌺 WEEKEND SPECIAL: 30% off all flowering plants! Saturday & Sunday only. First come, first served!' 
        }},
        { id: 'email-1', type: 'email', position: { x: 250, y: 200 }, data: { 
          subject: 'This Weekend Only: 30% Off Flowers! 🌸', 
          content: 'Make your garden bloom! This weekend only, save 30% on all flowering plants. Perfect timing for adding color to your garden!' 
        }},
        { id: 'delay-1', type: 'delay', position: { x: 175, y: 350 }, data: { delayValue: 1, delayUnit: 'days' } },
        { id: 'sms-2', type: 'sms', position: { x: 175, y: 500 }, data: { 
          content: '⏰ Last chance! Weekend flower special ends tomorrow. Don\'t miss 30% off all blooming plants!' 
        }}
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'sms-1' },
        { id: 'e2', source: 'trigger-1', target: 'email-1' },
        { id: 'e3', source: 'sms-1', target: 'delay-1' },
        { id: 'e4', source: 'email-1', target: 'delay-1' },
        { id: 'e5', source: 'delay-1', target: 'sms-2' }
      ]
    },
    preview: { stepCount: 5, emailCount: 1, smsCount: 2, delayCount: 1 },
    performance: { avgOpenRate: 82, avgClickRate: 35, avgRevenue: 180 },
    seasonalRelevance: ['spring', 'summer'],
    plantTypes: ['flowers', 'annuals', 'perennials']
  },

  // RETENTION & RE-ENGAGEMENT
  {
    id: 'dormant-customer-winback',
    name: 'Win Back Dormant Customers',
    description: 'Re-engage customers who haven\'t visited in 90+ days with personalized offers',
    category: 'retention',
    complexity: 'advanced',
    estimatedSetupTime: 25,
    businessGoal: 'Reactivate dormant customers and drive repeat visits',
    triggerType: 'repeat_purchase_90d',
    channels: ['email', 'sms'],
    flow_data: {
      nodes: [
        { id: 'trigger-1', type: 'trigger', position: { x: 200, y: 50 }, data: { triggerType: 'repeat_purchase_90d', label: '90 Days No Purchase' } },
        { id: 'email-1', type: 'email', position: { x: 200, y: 200 }, data: { 
          subject: 'We Miss You! What\'s Growing in Your Garden? 🌿', 
          content: 'Hi {{first_name}}, It\'s been a while since we\'ve seen you! How are your plants doing? We\'d love to help with your next garden project.' 
        }},
        { id: 'delay-1', type: 'delay', position: { x: 200, y: 350 }, data: { delayValue: 7, delayUnit: 'days' } },
        { id: 'split-1', type: 'split', position: { x: 200, y: 500 }, data: { condition: 'email_opened', label: 'Opened Email?' } },
        { id: 'sms-1', type: 'sms', position: { x: 100, y: 650 }, data: { 
          content: '🌱 Special for you: 20% off your next visit! We have new arrivals perfect for fall planting. Valid until {{expiry_date}}' 
        }},
        { id: 'email-2', type: 'email', position: { x: 300, y: 650 }, data: { 
          subject: 'Last Chance: 25% Off Everything! 🍂', 
          content: 'We really want to welcome you back! Here\'s 25% off your entire purchase. See what\'s new in our fall collection...' 
        }},
        { id: 'delay-2', type: 'delay', position: { x: 200, y: 800 }, data: { delayValue: 14, delayUnit: 'days' } },
        { id: 'email-3', type: 'email', position: { x: 200, y: 950 }, data: { 
          subject: 'Final Farewell Gift: Free Plant Care Guide 📚', 
          content: 'Even if you\'re shopping elsewhere, we want you to succeed! Download our comprehensive plant care guide - our gift to you.' 
        }}
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'email-1' },
        { id: 'e2', source: 'email-1', target: 'delay-1' },
        { id: 'e3', source: 'delay-1', target: 'split-1' },
        { id: 'e4', source: 'split-1', target: 'sms-1' },
        { id: 'e5', source: 'split-1', target: 'email-2' },
        { id: 'e6', source: 'sms-1', target: 'delay-2' },
        { id: 'e7', source: 'email-2', target: 'delay-2' },
        { id: 'e8', source: 'delay-2', target: 'email-3' }
      ]
    },
    preview: { stepCount: 8, emailCount: 3, smsCount: 1, delayCount: 2 },
    performance: { avgOpenRate: 45, avgClickRate: 18, avgRevenue: 95 },
    plantTypes: ['all']
  }
];

export const getTemplatesByCategory = (category: string) => {
  return gardenCenterTemplates.filter(template => template.category === category);
};

export const getTemplatesByComplexity = (complexity: string) => {
  return gardenCenterTemplates.filter(template => template.complexity === complexity);
};

export const getTemplatesByBusinessGoal = (goal: string) => {
  return gardenCenterTemplates.filter(template => 
    template.businessGoal.toLowerCase().includes(goal.toLowerCase())
  );
};

export const getSeasonalTemplates = (season?: string) => {
  if (!season) return gardenCenterTemplates.filter(t => t.seasonalRelevance);
  return gardenCenterTemplates.filter(template => 
    template.seasonalRelevance?.includes(season.toLowerCase())
  );
};

export const getTemplateById = (id: string) => {
  return gardenCenterTemplates.find(template => template.id === id);
};