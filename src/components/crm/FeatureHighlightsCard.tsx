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
  Sparkles, 
  ChevronRight,
  X,
  HelpCircle
} from 'lucide-react';

export const FeatureHighlightsCard: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const features = [
    {
      icon: Users,
      title: "Smart Personas",
      description: "Pre-built customer groups: Newbie Gardeners, Plant Experts, Seasonal Shoppers",
      color: "text-green-600 bg-green-100"
    },
    {
      icon: Target,
      title: "Auto Segments",
      description: "Sync with Shopify, Square, or VMX to automatically group customers by purchase history",
      color: "text-blue-600 bg-blue-100"
    },
    {
      icon: Mail,
      title: "Campaign Builder",
      description: "Beautiful email templates designed for garden centers with seasonal themes",
      color: "text-purple-600 bg-purple-100"
    },
    {
      icon: MessageSquare,
      title: "SMS Marketing",
      description: "Send timely plant care reminders and seasonal promotions via text",
      color: "text-orange-600 bg-orange-100"
    },
    {
      icon: Zap,
      title: "Automation",
      description: "Welcome series, care reminders, and seasonal campaigns that run themselves",
      color: "text-indigo-600 bg-indigo-100",
      badge: "Coming Soon"
    }
  ];

  if (!isExpanded) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-primary">🌟 What's Inside BloomSuite CRM</h3>
                <p className="text-sm text-muted-foreground">Discover powerful features built for garden centers</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsExpanded(true)}
              className="text-primary hover:text-primary/80"
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
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-primary">
            <Sparkles className="h-5 w-5 mr-2" />
            🌟 What's Inside BloomSuite CRM
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsExpanded(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-muted-foreground">
          Powerful marketing tools designed specifically for garden centers and nurseries
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {features.map((feature, index) => (
          <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-white/60 border border-white/40">
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${feature.color}`}>
              <feature.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center space-x-2">
                <h4 className="font-medium text-foreground">{feature.title}</h4>
                {feature.badge && (
                  <Badge variant="secondary" className="text-xs">
                    {feature.badge}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
        
        <div className="pt-4 border-t border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <HelpCircle className="h-4 w-4" />
              <span>Need help getting started?</span>
            </div>
            <Button variant="outline" size="sm">
              Contact Support
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};