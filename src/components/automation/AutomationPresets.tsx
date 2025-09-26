import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  MessageSquare, 
  Mail, 
  Clock, 
  Gift, 
  Star,
  TrendingUp,
  Heart
} from 'lucide-react';

interface AutomationPreset {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  badge: string;
  trigger: string;
  steps: Array<{
    channel: 'sms' | 'email';
    delay: string;
    description: string;
  }>;
  analytics: {
    expectedOpens?: string;
    expectedClicks?: string;
    redemptionRate?: string;
  };
}

const presets: AutomationPreset[] = [
  {
    id: 'customer_loyalty_program',
    title: 'Customer Loyalty Program: Ongoing Nurture Series',
    description: 'Welcome new loyalty members, reward them, and keep them engaged with seasonal tips, reminders, and customer appreciation emails over 30 days.',
    icon: Heart,
    color: 'bg-pink-100 text-pink-700 border-pink-200',
    badge: 'Recommended',
    trigger: 'Contact added to Loyalty Members segment',
    steps: [
      {
        channel: 'sms',
        delay: 'Immediate',
        description: 'Welcome SMS with 10% off reward'
      },
      {
        channel: 'email',
        delay: '24 hours later',
        description: 'Thank-you email with store story and website CTA'
      },
      {
        channel: 'email',
        delay: '7 days later',
        description: 'Seasonal gardening tip + loyalty reminder'
      },
      {
        channel: 'sms',
        delay: '14 days later',
        description: 'Gentle reminder about unused 10% reward'
      },
      {
        channel: 'email',
        delay: '30 days later',
        description: 'Store mission & community involvement story'
      }
    ],
    analytics: {
      expectedOpens: '70-80%',
      expectedClicks: '20-30%',
      redemptionRate: '35-45%'
    }
  }
];

interface AutomationPresetsProps {
  onSelectPreset: (preset: AutomationPreset) => void;
  onCreateCustom: () => void;
}

export const AutomationPresets: React.FC<AutomationPresetsProps> = ({
  onSelectPreset,
  onCreateCustom
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Choose an Automation</h2>
        <p className="text-muted-foreground">
          Start with a proven template or build your own from scratch
        </p>
      </div>

      {/* Preset Templates */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          Recommended Presets
        </h3>
        
        {presets.map((preset) => {
          const Icon = preset.icon;
          return (
            <Card 
              key={preset.id}
              className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/50"
              onClick={() => onSelectPreset(preset)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${preset.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{preset.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          {preset.badge}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground mt-2">{preset.description}</p>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Trigger */}
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="font-medium">Trigger:</span>
                  <span className="text-muted-foreground">{preset.trigger}</span>
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Flow:</span>
                  <div className="space-y-2">
                    {preset.steps.map((step, index) => (
                      <div key={index} className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          {step.channel === 'sms' ? (
                            <MessageSquare className="w-4 h-4 text-green-600" />
                          ) : (
                            <Mail className="w-4 h-4 text-blue-600" />
                          )}
                          <Badge variant="outline" className="text-xs">
                            {step.channel.toUpperCase()}
                          </Badge>
                        </div>
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{step.delay}</span>
                        <span>•</span>
                        <span>{step.description}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Analytics Preview */}
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Expected Performance
                  </span>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {preset.analytics.expectedOpens && (
                      <div>
                        <div className="text-muted-foreground">Open Rate</div>
                        <div className="font-medium">{preset.analytics.expectedOpens}</div>
                      </div>
                    )}
                    {preset.analytics.expectedClicks && (
                      <div>
                        <div className="text-muted-foreground">Click Rate</div>
                        <div className="font-medium">{preset.analytics.expectedClicks}</div>
                      </div>
                    )}
                    {preset.analytics.redemptionRate && (
                      <div>
                        <div className="text-muted-foreground">Redemption</div>
                        <div className="font-medium">{preset.analytics.redemptionRate}</div>
                      </div>
                    )}
                  </div>
                </div>

                <Button className="w-full">
                  Use This Template
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Custom Options */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Build Your Own</h3>
        
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onCreateCustom}>
          <CardContent className="p-6 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h4 className="font-medium mb-2">Start from Scratch</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Build a custom automation flow tailored to your specific needs
            </p>
            <Button variant="outline">Create Custom Automation</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};