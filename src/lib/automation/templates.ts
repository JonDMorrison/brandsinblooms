export interface TemplateStep {
  delay: number;
  channel: 'sms' | 'email';
  content: string;
}

export interface AutomationTemplate {
  id: string;
  title: string;
  steps: TemplateStep[];
  triggerType: string;
}

const templates: AutomationTemplate[] = [
  {
    id: 'loyalty_sms',
    title: 'Instant Loyalty SMS',
    triggerType: 'loyalty_join',
    steps: [
      {
        delay: 0,
        channel: 'sms',
        content: 'Welcome to our loyalty program! Enjoy 10% off your next purchase.'
      }
    ]
  },
  {
    id: 'first_purchase_welcome',
    title: 'First Purchase Welcome',
    triggerType: 'first_purchase',
    steps: [
      {
        delay: 0,
        channel: 'email',
        content: 'Thank you for your first purchase! Here\'s what to expect next.'
      }
    ]
  },
  {
    id: 'birthday_sms',
    title: 'Birthday SMS Campaign',
    triggerType: 'birthday',
    steps: [
      {
        delay: 0,
        channel: 'sms',
        content: 'Happy Birthday! Enjoy a special 20% discount on us.'
      }
    ]
  }
];

export const getTemplateForTrigger = (triggerType: string | null): AutomationTemplate | null => {
  if (!triggerType) return null;
  return templates.find(template => template.triggerType === triggerType) || null;
};