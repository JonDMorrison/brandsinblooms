
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Paintbrush, 
  Clock, 
  Zap, 
  Layout, 
  Image,
  ArrowRight
} from 'lucide-react';

interface EmailBuilderModeSelectorProps {
  onModeSelect: (mode: 'simple' | 'advanced') => void;
  defaultMode?: 'simple' | 'advanced';
}

export const EmailBuilderModeSelector: React.FC<EmailBuilderModeSelectorProps> = ({
  onModeSelect,
  defaultMode
}) => {
  const handleModeSelect = (mode: 'simple' | 'advanced') => {
    // Store user preference
    localStorage.setItem('email_builder_preferred_mode', mode);
    onModeSelect(mode);
  };

  const modes = [
    {
      id: 'simple' as const,
      title: 'Simple Email',
      subtitle: 'Quick & Easy',
      description: 'Perfect for announcements, updates, and quick messages',
      icon: MessageSquare,
      features: [
        'Clean text editor',
        'Subject line + message',
        'Personalization tokens',
        'Mobile optimized'
      ],
      useCase: 'Just need a quick message? Choose Simple.',
      color: 'bg-green-50 border-green-200 hover:bg-green-100',
      iconColor: 'text-green-600'
    },
    {
      id: 'advanced' as const,
      title: 'Advanced Newsletter',
      subtitle: 'Full Design Control',
      description: 'Complete drag-and-drop builder with rich media support',
      icon: Paintbrush,
      features: [
        'Drag & drop blocks',
        'Images & media',
        'Custom layouts',
        'Real-time preview'
      ],
      useCase: 'Want full design control? Use the Advanced Builder.',
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      iconColor: 'text-blue-600'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Choose Your Email Builder</h2>
        <p className="text-muted-foreground">
          Select the editor that best fits your campaign needs
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {modes.map((mode) => {
          const IconComponent = mode.icon;
          const isDefault = defaultMode === mode.id;
          
          return (
            <Card 
              key={mode.id}
              className={`relative cursor-pointer transition-all duration-200 ${mode.color} ${
                isDefault ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => handleModeSelect(mode.id)}
            >
              <CardContent className="p-6">
                {isDefault && (
                  <Badge className="absolute -top-2 -right-2 bg-primary text-primary-foreground">
                    Last Used
                  </Badge>
                )}
                
                <div className="flex items-start gap-4 mb-4">
                  <div className={`p-3 rounded-lg bg-white shadow-sm ${mode.iconColor}`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-1">{mode.title}</h3>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      {mode.subtitle}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {mode.description}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium mb-3">{mode.useCase}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {mode.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm font-medium">
                  {mode.id === 'simple' ? (
                    <>
                      <Clock className="h-4 w-4" />
                      2-3 minutes to create
                    </>
                  ) : (
                    <>
                      <Layout className="h-4 w-4" />
                      10-15 minutes to design
                    </>
                  )}
                </div>

                <Button 
                  className="w-full mt-4 gap-2"
                  variant={mode.id === 'simple' ? 'default' : 'outline'}
                >
                  Start {mode.title}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-2">
          💡 <strong>Pro tip:</strong> You can switch between modes during creation
        </p>
        <p className="text-xs text-muted-foreground">
          Your preferred mode will be remembered for future campaigns
        </p>
      </div>
    </div>
  );
};
