import { Node, Edge } from '@xyflow/react';

// Utility to create preset automation flows that can be loaded into the canvas

export interface PresetFlow {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
}

export const getLoyaltyProgramFlow = (): PresetFlow => {
  const nodes: Node[] = [
    {
      id: 'trigger-loyalty',
      type: 'trigger',
      position: { x: 250, y: 50 },
      data: {
        triggerType: 'loyalty_members_segment',
        label: 'New Loyalty Member',
        conditions: {},
      },
    },
    {
      id: 'sms-immediate',
      type: 'sms',
      position: { x: 250, y: 180 },
      data: {
        content: 'Thanks for joining our Loyalty Program at {{garden_center_name}}! Enjoy 10% off your next visit. Show this message at checkout. Reply STOP to opt out.',
        characterCount: 159,
        editable: true,
        delay: 'Immediate',
      },
    },
    {
      id: 'email-thank-you',
      type: 'email',
      position: { x: 250, y: 310 },
      data: {
        subject: 'Thanks for visiting {{garden_center_name}} — enjoy your reward!',
        content: 'Hi there!\n\nThanks so much for visiting our garden center and joining our loyalty program. We hope you found exactly what you were looking for!\n\nDon\'t forget about your 10% off reward — just show the text message we sent you at checkout on your next visit.',
        template: 'customer_loyalty_program-1',
        editable: true,
        delay: '24 hours',
      },
    },
    {
      id: 'email-seasonal-tip',
      type: 'email',
      position: { x: 250, y: 440 },
      data: {
        subject: 'A quick tip for your garden this week',
        content: 'Hi {{first_name}}!\n\nHere\'s a quick gardening tip to help you make the most of this season:\n\n{{seasonal_tip}}\n\nAs a loyal member, you still have that 10% off reward waiting for you at {{garden_center_name}}.',
        template: 'customer_loyalty_program-2',
        editable: true,
        delay: '7 days',
      },
    },
    {
      id: 'sms-reminder',
      type: 'sms',
      position: { x: 250, y: 570 },
      data: {
        content: 'Hi {{first_name}}, just a reminder you\'ve got 10% off waiting for you at {{garden_center_name}}. Stop by soon and see what\'s new! Reply STOP to opt out.',
        characterCount: 158,
        editable: true,
        delay: '14 days',
      },
    },
    {
      id: 'email-mission',
      type: 'email',
      position: { x: 250, y: 700 },
      data: {
        subject: 'Why we love serving gardeners like you',
        content: 'Hi {{first_name}}!\n\nWe wanted to take a moment to share why {{garden_center_name}} exists. Our mission is simple: to help every gardener in our community grow beautiful, thriving spaces that bring joy and connection to nature.',
        template: 'customer_loyalty_program-4',
        editable: true,
        delay: '30 days',
      },
    },
  ];

  const edges: Edge[] = [
    {
      id: 'e1',
      source: 'trigger-loyalty',
      target: 'sms-immediate',
      type: 'smoothstep',
    },
    {
      id: 'e2',
      source: 'sms-immediate',
      target: 'email-thank-you',
      type: 'smoothstep',
    },
    {
      id: 'e3',
      source: 'email-thank-you',
      target: 'email-seasonal-tip',
      type: 'smoothstep',
    },
    {
      id: 'e4',
      source: 'email-seasonal-tip',
      target: 'sms-reminder',
      type: 'smoothstep',
    },
    {
      id: 'e5',
      source: 'sms-reminder',
      target: 'email-mission',
      type: 'smoothstep',
    },
  ];

  return {
    id: 'customer_loyalty_program',
    name: 'Customer Loyalty Program: Ongoing Nurture Series',
    description: '5-step nurture sequence over 30 days to increase customer retention',
    nodes,
    edges
  };
};

export const getWelcomeNewCustomersFlow = (): PresetFlow => {
  const nodes: Node[] = [
    {
      id: 'trigger-welcome',
      type: 'trigger',
      position: { x: 250, y: 50 },
      data: {
        triggerType: 'loyalty_join',
        label: 'Welcome New Customers',
        conditions: {},
      },
    },
    {
      id: 'email-welcome',
      type: 'email',
      position: { x: 250, y: 200 },
      data: {
        subject: 'Welcome to our loyalty program!',
        content: 'Thank you for joining our loyalty program. Get ready for exclusive offers and rewards!',
        template: 'welcome-email',
        editable: true,
        delay: 'Immediate',
      },
    },
    {
      id: 'sms-welcome',
      type: 'sms',
      position: { x: 250, y: 350 },
      data: {
        content: 'Welcome! Your loyalty account is ready. Reply STOP to opt out.',
        characterCount: 65,
        editable: true,
        delay: '2 days',
      },
    },
  ];

  const edges: Edge[] = [
    {
      id: 'e1',
      source: 'trigger-welcome',
      target: 'email-welcome',
      type: 'smoothstep',
    },
    {
      id: 'e2',
      source: 'email-welcome',
      target: 'sms-welcome',
      type: 'smoothstep',
    },
  ];

  return {
    id: 'welcome_new_customers',
    name: 'Welcome New Customers',
    description: 'Simple 2-step welcome sequence for first-time customers',
    nodes,
    edges
  };
};

export const getPresetFlowById = (presetId: string): PresetFlow | null => {
  switch (presetId) {
    case 'customer_loyalty_program':
      return getLoyaltyProgramFlow();
    case 'welcome_new_customers':
      return getWelcomeNewCustomersFlow();
    default:
      return null;
  }
};

export const getAllPresetFlows = (): PresetFlow[] => {
  return [
    getLoyaltyProgramFlow(),
    getWelcomeNewCustomersFlow()
  ];
};