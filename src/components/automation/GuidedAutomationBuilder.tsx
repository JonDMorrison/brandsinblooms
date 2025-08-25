import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AudienceSelector } from '@/components/crm/AudienceSelector';
import { 
  Users, 
  ShoppingCart, 
  TrendingUp, 
  Leaf,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Clock,
  Mail,
  MessageSquare,
  Lightbulb
} from 'lucide-react';

interface GuidedAutomationBuilderProps {
  onComplete: (automationConfig: any) => void;
  onBack: () => void;
}

const businessGoals = [
  {
    id: 'welcome_new_customers',
    title: 'Welcome New Customers',
    description: 'Build confidence and loyalty with new plant parents',
    icon: Users,
    color: 'bg-blue-100 text-blue-700 border-blue-200'
  },
  {
    id: 'increase_sales',
    title: 'Increase Sales',
    description: 'Drive revenue with promotions and product recommendations',
    icon: ShoppingCart,
    color: 'bg-green-100 text-green-700 border-green-200'
  },
  {
    id: 'educate_customers',
    title: 'Educate & Retain',
    description: 'Share plant care tips and build long-term relationships',
    icon: Leaf,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200'
  },
  {
    id: 'win_back_customers',
    title: 'Win Back Customers',
    description: 'Re-engage customers who haven\'t visited recently',
    icon: TrendingUp,
    color: 'bg-orange-100 text-orange-700 border-orange-200'
  }
];

const triggers = {
  welcome_new_customers: [
    { id: 'loyalty_join', label: 'Customer joins loyalty program', description: 'Perfect for welcome series' },
    { id: 'first_purchase', label: 'Customer makes first purchase', description: 'Follow up after first visit' },
    { id: 'newsletter_signup', label: 'Customer signs up for newsletter', description: 'Nurture email subscribers' }
  ],
  increase_sales: [
    { id: 'weekly_promotion', label: 'Weekly promotion schedule', description: 'Automated weekly specials' },
    { id: 'seasonal_campaign', label: 'Seasonal planting time', description: 'Drive seasonal purchases' },
    { id: 'inventory_clearance', label: 'Clearance items available', description: 'Move excess inventory' }
  ],
  educate_customers: [
    { id: 'plant_care_reminder', label: 'Plant care milestone', description: 'Based on plant type and purchase date' },
    { id: 'seasonal_tips', label: 'Seasonal care tips', description: 'Seasonal gardening advice' },
    { id: 'problem_solving', label: 'Customer asks for help', description: 'Reactive education series' }
  ],
  win_back_customers: [
    { id: 'repeat_purchase_90d', label: '90 days since last purchase', description: 'Standard winback timing' },
    { id: 'repeat_purchase_180d', label: '6 months since last purchase', description: 'Extended absence follow-up' },
    { id: 'abandoned_cart', label: 'Items left in cart', description: 'Cart abandonment recovery' }
  ]
};

const channelPreferences = [
  {
    id: 'email_first',
    title: 'Email First',
    description: 'Start with detailed emails, follow up with SMS',
    channels: ['email', 'sms'],
    icon: Mail,
    recommended: true
  },
  {
    id: 'sms_first', 
    title: 'SMS First',
    description: 'Quick SMS alerts, detailed follow-up via email',
    channels: ['sms', 'email'],
    icon: MessageSquare,
    recommended: false
  },
  {
    id: 'email_only',
    title: 'Email Only',
    description: 'Rich content and detailed messaging',
    channels: ['email'],
    icon: Mail,
    recommended: false
  },
  {
    id: 'sms_only',
    title: 'SMS Only', 
    description: 'Quick, actionable messages',
    channels: ['sms'],
    icon: MessageSquare,
    recommended: false
  }
];

export const GuidedAutomationBuilder: React.FC<GuidedAutomationBuilderProps> = ({
  onComplete,
  onBack
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedTrigger, setSelectedTrigger] = useState('');
  const [selectedChannels, setSelectedChannels] = useState('');
  const [audienceType, setAudienceType] = useState<'everyone' | 'persona' | 'segment'>('everyone');
  const [selectedPersonas, setSelectedPersonas] = useState<any[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<any[]>([]);
  const [showAudienceSelector, setShowAudienceSelector] = useState(false);

  const currentGoal = businessGoals.find(g => g.id === selectedGoal);
  const availableTriggers = selectedGoal ? triggers[selectedGoal as keyof typeof triggers] : [];
  const currentTrigger = availableTriggers.find(t => t.id === selectedTrigger);
  const currentChannelPref = channelPreferences.find(c => c.id === selectedChannels);

  const generateAutomationStructure = () => {
    // Create a basic automation structure based on selections
    const baseFlow = {
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          position: { x: 100, y: 50 },
          data: { 
            triggerType: selectedTrigger,
            label: currentTrigger?.label || 'Trigger'
          }
        }
      ],
      edges: []
    };

    // Add suggested next steps based on goal and channel preference
    let yPos = 200;
    let lastNodeId = 'trigger-1';

    if (currentChannelPref?.channels.includes('email')) {
      const emailNode: any = {
        id: 'email-1',
        type: 'email',
        position: { x: 100, y: yPos },
        data: {
          subject: `Welcome Message - ${currentGoal?.title}`,
          content: `Personalized message for ${currentGoal?.description.toLowerCase()}`
        }
      };
      baseFlow.nodes.push(emailNode);
      baseFlow.edges.push({ id: 'e1', source: lastNodeId, target: 'email-1' });
      lastNodeId = 'email-1';
      yPos += 150;
    }

    if (currentChannelPref?.channels.includes('sms')) {
      const smsNode: any = {
        id: 'sms-1',
        type: 'sms',
        position: { x: 100, y: yPos },
        data: {
          content: `Quick follow-up message for ${currentGoal?.title.toLowerCase()}`
        }
      };
      baseFlow.nodes.push(smsNode);
      baseFlow.edges.push({ id: 'e2', source: lastNodeId, target: 'sms-1' });
    }

    return {
      name: `${currentGoal?.title} Automation`,
      description: `${currentGoal?.description} - triggered by ${currentTrigger?.label}`,
      flow_data: baseFlow,
      goal: selectedGoal,
      trigger: selectedTrigger,
      channels: currentChannelPref?.channels || ['email'],
      audience: {
        type: audienceType,
        personas: selectedPersonas,
        segments: selectedSegments,
      }
    };
  };

  const handleComplete = () => {
    const automationConfig = generateAutomationStructure();
    onComplete(automationConfig);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return selectedGoal !== '';
      case 2: return selectedTrigger !== '';
      case 3: return selectedChannels !== '';
      case 4: return audienceType === 'everyone' || selectedPersonas.length > 0 || selectedSegments.length > 0;
      default: return false;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Templates
          </Button>
        </div>
        
        <h2 className="text-2xl font-bold">Build Your Custom Automation</h2>
        <p className="text-muted-foreground">
          Let's create an automation that fits your specific needs
        </p>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === currentStep 
                  ? 'bg-primary text-primary-foreground' 
                  : step < currentStep 
                    ? 'bg-green-500 text-white' 
                    : 'bg-muted text-muted-foreground'
              }`}>
                {step < currentStep ? <CheckCircle className="w-4 h-4" /> : step}
              </div>
              {step < 4 && (
                <ArrowRight className={`w-4 h-4 ${step < currentStep ? 'text-green-500' : 'text-muted-foreground'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentStep === 1 && "Step 1: What's your goal?"}
            {currentStep === 2 && "Step 2: What triggers this automation?"}
            {currentStep === 3 && "Step 3: How do you want to communicate?"}
            {currentStep === 4 && "Step 4: Who is this for?"}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Step 1: Business Goal */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Choose the primary goal for this automation. This helps us suggest the best structure and content.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {businessGoals.map((goal) => {
                  const Icon = goal.icon;
                  return (
                    <Card 
                      key={goal.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedGoal === goal.id ? 'ring-2 ring-primary border-primary' : ''
                      }`}
                      onClick={() => setSelectedGoal(goal.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${goal.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium">{goal.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                          </div>
                          {selectedGoal === goal.id && (
                            <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Trigger Selection */}
          {currentStep === 2 && currentGoal && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentGoal.color}`}>
                  <currentGoal.icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium">{currentGoal.title}</div>
                  <div className="text-sm text-muted-foreground">{currentGoal.description}</div>
                </div>
              </div>

              <p className="text-muted-foreground">
                When should this automation trigger? Choose the event that will start your automation.
              </p>
              
              <div className="space-y-3">
                {availableTriggers.map((trigger) => (
                  <Card 
                    key={trigger.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTrigger === trigger.id ? 'ring-2 ring-primary border-primary' : ''
                    }`}
                    onClick={() => setSelectedTrigger(trigger.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{trigger.label}</h3>
                          <p className="text-sm text-muted-foreground">{trigger.description}</p>
                        </div>
                        {selectedTrigger === trigger.id && (
                          <CheckCircle className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Channel Preference */}
          {currentStep === 3 && currentTrigger && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <div>
                  <div className="font-medium">{currentTrigger.label}</div>
                  <div className="text-sm text-muted-foreground">{currentTrigger.description}</div>
                </div>
              </div>

              <p className="text-muted-foreground">
                How would you like to communicate with your customers? We'll create an optimized sequence based on your preference.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {channelPreferences.map((pref) => {
                  const Icon = pref.icon;
                  return (
                    <Card 
                      key={pref.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedChannels === pref.id ? 'ring-2 ring-primary border-primary' : ''
                      }`}
                      onClick={() => setSelectedChannels(pref.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{pref.title}</h3>
                              {pref.recommended && (
                                <Badge variant="secondary" className="text-xs">
                                  <Lightbulb className="w-3 h-3 mr-1" />
                                  Recommended
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{pref.description}</p>
                            <div className="flex items-center gap-1 mt-2">
                              {pref.channels.map((channel, index) => (
                                <Badge key={channel} variant="outline" className="text-xs">
                                  {channel === 'email' ? <Mail className="w-3 h-3 mr-1" /> : <MessageSquare className="w-3 h-3 mr-1" />}
                                  {channel}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          {selectedChannels === pref.id && (
                            <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4: Audience Selection */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Who should receive this automation? You can target everyone or be more specific with personas and segments.
              </p>
              
              <div className="space-y-4">
                {/* Everyone Option */}
                <Card 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    audienceType === 'everyone' ? 'ring-2 ring-primary border-primary' : ''
                  }`}
                  onClick={() => setAudienceType('everyone')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Everyone</h3>
                        <p className="text-sm text-muted-foreground">Send to all customers who meet the trigger criteria</p>
                      </div>
                      {audienceType === 'everyone' && (
                        <CheckCircle className="w-5 h-5 text-primary" />
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Specific Audience Option */}
                <Card 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    audienceType !== 'everyone' ? 'ring-2 ring-primary border-primary' : ''
                  }`}
                  onClick={() => {
                    setAudienceType('segment');
                    setShowAudienceSelector(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Specific Audience</h3>
                        <p className="text-sm text-muted-foreground">Target specific personas or customer segments</p>
                        {(selectedPersonas.length > 0 || selectedSegments.length > 0) && (
                          <div className="flex gap-2 mt-2">
                            {selectedPersonas.map((persona) => (
                              <Badge key={persona.id} variant="secondary">{persona.name}</Badge>
                            ))}
                            {selectedSegments.map((segment) => (
                              <Badge key={segment.id} variant="secondary">{segment.name}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {audienceType !== 'everyone' && (
                        <CheckCircle className="w-5 h-5 text-primary" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Audience Selector Modal */}
              {showAudienceSelector && (
                <AudienceSelector
                  selectedPersonas={selectedPersonas}
                  selectedSegments={selectedSegments}
                  onPersonasChange={setSelectedPersonas}
                  onSegmentsChange={setSelectedSegments}
                  onClose={() => setShowAudienceSelector(false)}
                />
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : onBack()}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {currentStep > 1 ? 'Previous' : 'Back to Templates'}
            </Button>
            
            {currentStep < 4 ? (
              <Button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceed()}
                className="gap-2"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={!canProceed()}
                className="gap-2"
              >
                Create Automation
                <CheckCircle className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};