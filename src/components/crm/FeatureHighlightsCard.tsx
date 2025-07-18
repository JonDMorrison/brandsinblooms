
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Target, 
  Mail, 
  MessageSquare, 
  Zap, 
  ChevronRight,
  X,
  HelpCircle
} from 'lucide-react';

export const FeatureHighlightsCard: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const features = [
    {
      icon: Users,
      title: "Customer Segmentation",
      description: "Create targeted groups based on behavior and purchase history"
    },
    {
      icon: Target,
      title: "Smart Targeting",
      description: "Automatically sync with your POS system for real-time insights"
    },
    {
      icon: Mail,
      title: "Email Campaigns",
      description: "Professional email templates with drag-and-drop editor"
    },
    {
      icon: MessageSquare,
      title: "SMS Marketing",
      description: "Send timely text messages with high engagement rates"
    },
    {
      icon: Zap,
      title: "Marketing Automation",
      description: "Set up workflows that run automatically based on customer actions",
      badge: "Coming Soon"
    }
  ];

  if (!isExpanded) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Platform Features</h3>
                <p className="text-sm text-gray-600">See what you can accomplish</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsExpanded(true)}
              className="text-gray-600 hover:text-gray-900"
            >
              Learn More
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-gray-900">
            <Target className="h-5 w-5 mr-2 text-primary" />
            Platform Features
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsExpanded(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-gray-600">
          Powerful marketing tools for growing businesses
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {features.map((feature, index) => (
          <div key={index} className="flex items-start space-x-3 p-3 rounded-lg border border-gray-100">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50">
              <feature.icon className="h-4 w-4 text-gray-600" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center space-x-2">
                <h4 className="font-medium text-gray-900">{feature.title}</h4>
                {feature.badge && (
                  <Badge variant="secondary" className="text-xs">
                    {feature.badge}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
        
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <HelpCircle className="h-4 w-4" />
              <span>Need help getting started?</span>
            </div>
            <Button variant="outline" size="sm">
              Get Support
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
