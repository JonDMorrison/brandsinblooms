// Plan My Marketing - Constants
import { SeasonalPlanTheme } from '@/services/seasonalPlanGenerator';

// Legacy static themes (now replaced by seasonal themes)
export const PLAN_THEMES = [
  { 
    id: "fall-planting", 
    label: "Fall Planting",
    description: "Perfect for fall gardening season with planting guides and seasonal tips"
  },
  { 
    id: "houseplant-month", 
    label: "Houseplant Month",
    description: "Indoor plant care, winter houseplant tips, and holiday plant gifts"
  },
  { 
    id: "pollinator-week", 
    label: "Pollinator Week",
    description: "Bee-friendly plants, pollinator gardens, and environmental awareness"
  },
  { 
    id: "holiday-gifting", 
    label: "Holiday Gifting",
    description: "Plant gifts, holiday arrangements, and seasonal decorations"
  },
  { 
    id: "vegetable-starts", 
    label: "Vegetable Starts",
    description: "Seed starting, vegetable gardening, and growing your own food"
  },
  { 
    id: "perennial-spotlight", 
    label: "Perennial Spotlight",
    description: "Long-lasting plants, garden design, and perennial care tips"
  }
];

export type PlanTheme = SeasonalPlanTheme; // Now uses seasonal themes

export interface PlanWizardState {
  month: string;
  themes: PlanTheme[];
  items: PlanItem[];
}

export interface PlanItem {
  id: string;
  type: 'email' | 'sms' | 'facebook' | 'instagram' | 'blog';
  title: string;
  caption: string;
  date: Date;
  enabled: boolean;
  imageUrl?: string;
  imageIdea?: string;
  imageQuery?: string; // AI-generated Unsplash search keyword
  imageMetadata?: {
    alt?: string;
    photographer?: string;
    photographer_url?: string;
    source?: string;
    unsplash_id?: string;
  };
  week: number;
  themeId?: string;
  themeName?: string;
  // Enhanced email fields
  emailSubject?: string;
  emailPreheader?: string;
  notes?: string;
  // Audience targeting
  audienceTarget?: 'all' | 'segments' | 'personas';
  selectedSegmentIds?: string[];
  selectedPersonaIds?: string[];
  // Enhanced blog content
  enhancedContent?: any;
}

// Template content generators
export const generatePlanContent = (theme: PlanTheme, month: string): PlanItem[] => {
  const monthName = new Date(month).toLocaleString('default', { month: 'long' });
  const year = new Date(month).getFullYear();
  
  // Get dates for the month
  const monthDate = new Date(month);
  const firstDay = new Date(year, monthDate.getMonth(), 1);
  const lastDay = new Date(year, monthDate.getMonth() + 1, 0);
  
  // Calculate weeks
  const week1 = new Date(firstDay.getTime() + (7 * 24 * 60 * 60 * 1000));
  const week2 = new Date(firstDay.getTime() + (14 * 24 * 60 * 60 * 1000));
  const week3 = new Date(firstDay.getTime() + (21 * 24 * 60 * 60 * 1000));
  const week4 = new Date(Math.min(firstDay.getTime() + (28 * 24 * 60 * 60 * 1000), lastDay.getTime()));

  const items: PlanItem[] = [
    // Email items
    {
      id: `email-1-${Date.now()}`,
      type: 'email',
      title: `${theme.label} Newsletter - Week 1`,
      caption: `Welcome to ${monthName}! Get ready for ${theme.label.toLowerCase()} with expert tips and seasonal advice.`,
      date: week1,
      enabled: true,
      week: 1
    },
    {
      id: `email-2-${Date.now() + 1}`,
      type: 'email',
      title: `${theme.label} Special Offer`,
      caption: `Don't miss our ${theme.label.toLowerCase()} weekend special! Limited time offers on featured plants and supplies.`,
      date: week3,
      enabled: true,
      week: 3
    },
    
    // SMS items
    {
      id: `sms-1-${Date.now() + 2}`,
      type: 'sms',
      title: `${theme.label} Event Reminder`,
      caption: `🌱 Reminder: Join us this weekend for our ${theme.label} workshop! Learn from the experts.`,
      date: week2,
      enabled: true,
      week: 2
    },
    {
      id: `sms-2-${Date.now() + 3}`,
      type: 'sms',
      title: `Last Week ${theme.label} Promo`,
      caption: `⏰ Last chance! ${theme.label} sale ends soon. Visit us before ${monthName} ends!`,
      date: week4,
      enabled: true,
      week: 4
    },
    
    // Social media posts (Facebook)
    {
      id: `facebook-1-${Date.now() + 4}`,
      type: 'facebook',
      title: `${theme.label} Tips Monday`,
      caption: `Monday Motivation: ${theme.label} tip of the week! 🌿 Check out these expert recommendations for ${monthName}.`,
      date: new Date(firstDay.getTime() + (3 * 24 * 60 * 60 * 1000)), // First Wednesday
      enabled: true,
      week: 1
    },
    {
      id: `facebook-2-${Date.now() + 5}`,
      type: 'facebook',
      title: `${theme.label} Feature Friday`,
      caption: `Feature Friday: Spotlight on ${theme.label.toLowerCase()}! 📸 Share your garden photos with us.`,
      date: new Date(week1.getTime() + (4 * 24 * 60 * 60 * 1000)), // First Friday
      enabled: true,
      week: 1
    },
    {
      id: `facebook-3-${Date.now() + 6}`,
      type: 'facebook',
      title: `${theme.label} Workshop Announcement`,
      caption: `Join us this weekend for hands-on ${theme.label.toLowerCase()} activities! 🛠️ Perfect for beginners and experts alike.`,
      date: new Date(week2.getTime() - (2 * 24 * 60 * 60 * 1000)), // Tuesday of week 2
      enabled: true,
      week: 2
    },
    
    // Social media posts (Instagram)
    {
      id: `instagram-1-${Date.now() + 7}`,
      type: 'instagram',
      title: `${theme.label} Story`,
      caption: `${theme.label} season is here! ✨ Swipe for inspiration and tips. #${theme.id.replace('-', '')} #gardening`,
      date: new Date(firstDay.getTime() + (5 * 24 * 60 * 60 * 1000)), // First Friday
      enabled: true,
      week: 1
    },
    {
      id: `instagram-2-${Date.now() + 8}`,
      type: 'instagram',
      title: `Behind the Scenes ${theme.label}`,
      caption: `Behind the scenes: Preparing for ${theme.label.toLowerCase()} season! 🎬 Our team's favorite picks.`,
      date: new Date(week2.getTime() + (1 * 24 * 60 * 60 * 1000)), // Tuesday of week 2
      enabled: true,
      week: 2
    },
    {
      id: `instagram-3-${Date.now() + 9}`,
      type: 'instagram',
      title: `Customer Spotlight ${theme.label}`,
      caption: `Customer spotlight! 🌟 Amazing ${theme.label.toLowerCase()} results from @customer. Tag us in your photos!`,
      date: new Date(week3.getTime() + (3 * 24 * 60 * 60 * 1000)), // Thursday of week 3
      enabled: true,
      week: 3
    },
    {
      id: `instagram-4-${Date.now() + 10}`,
      type: 'instagram',
      title: `${theme.label} Transformation`,
      caption: `Before & After: ${theme.label} transformation! 🌱➡️🌺 What will you create this ${monthName}?`,
      date: new Date(week4.getTime()), // Monday of week 4
      enabled: true,
      week: 4
    }
  ];

  return items;
};