import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Zap, 
  Settings, 
  BookOpen, 
  ArrowRight, 
  Users, 
  Mail, 
  MessageSquare,
  Clock,
  Target,
  Sparkles
} from 'lucide-react';

export const AutomationWizardLandingPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Create New Automation - Choose Your Approach';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Choose from proven automation templates or build your own custom workflow from scratch.');
  }, []);

  const automationTypes = [
    {
      id: 'presets',
      title: 'Quick Start with Preset',
      description: 'Choose from proven templates that work',
      icon: <Zap className="h-8 w-8" />,
      badge: 'Recommended',
      badgeVariant: 'default' as const,
      features: [
        'Pre-built workflows that convert',
        'Best practice messaging included',
        'Ready to launch in minutes'
      ],
      cta: 'Browse Presets',
      route: '/crm/automations/new/guide'
    },
    {
      id: 'custom',
      title: 'Custom Build',
      description: 'Full control with drag-and-drop canvas',
      icon: <Settings className="h-8 w-8" />,
      features: [
        'Complete creative freedom',
        'Advanced branching logic',
        'Custom trigger conditions'
      ],
      cta: 'Open Canvas',
      route: '/crm/automations/new/canvas'
    },
    {
      id: 'guided',
      title: 'Guided Builder',
      description: 'Step-by-step wizard for custom automations',
      icon: <BookOpen className="h-8 w-8" />,
      features: [
        'AI-powered recommendations',
        'Guided setup process',
        'Smart template suggestions'
      ],
      cta: 'Start Guide',
      route: '/crm/automations/new/guide?mode=guided'
    }
  ];

  const presetPreviews = [
    {
      id: 'customer_loyalty_program',
      title: 'Customer Loyalty Program',
      subtitle: 'Ongoing Nurture Series',
      description: '5-step nurture sequence over 30 days',
      steps: [
        { icon: <MessageSquare className="h-4 w-4" />, label: 'Welcome SMS', time: 'Immediate' },
        { icon: <Mail className="h-4 w-4" />, label: 'Thank You Email', time: '24 hours' },
        { icon: <Mail className="h-4 w-4" />, label: 'Seasonal Tip', time: '7 days' },
        { icon: <MessageSquare className="h-4 w-4" />, label: 'Reminder SMS', time: '14 days' },
        { icon: <Mail className="h-4 w-4" />, label: 'Mission Story', time: '30 days' }
      ],
      metrics: 'Increases retention by 40%',
      audience: 'Loyalty Members'
    },
    {
      id: 'welcome_new_customers',
      title: 'Welcome New Customers',
      subtitle: 'First Impression Series',
      description: 'Simple 2-step welcome sequence',
      steps: [
        { icon: <Mail className="h-4 w-4" />, label: 'Welcome Email', time: 'Immediate' },
        { icon: <MessageSquare className="h-4 w-4" />, label: 'Follow-up SMS', time: '2 days' }
      ],
      metrics: 'Converts 25% more first-time visitors',
      audience: 'New Customers'
    }
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-semibold text-foreground">Create New Automation</h1>
          <Link to="/crm/automations" aria-label="Back to Automations">
            <Button variant="outline">Back to Automations</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <section className="max-w-6xl mx-auto p-4 md:p-6 space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Choose Your Automation Approach
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start with proven templates for quick wins, or build completely custom workflows from scratch.
            </p>
          </div>

          {/* Automation Type Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {automationTypes.map((type) => (
              <Card key={type.id} className="relative group hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-primary/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        {type.icon}
                      </div>
                      {type.badge && (
                        <Badge variant={type.badgeVariant} className="text-xs">
                          {type.badge}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-xl">{type.title}</CardTitle>
                  <CardDescription className="text-base">{type.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {type.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link to={type.route} className="block">
                    <Button className="w-full group">
                      {type.cta}
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Preview of Popular Presets */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-semibold">Popular Preset Templates</h3>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {presetPreviews.map((preset) => (
                <Card key={preset.id} className="group hover:shadow-md transition-all duration-200">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{preset.title}</CardTitle>
                        <CardDescription className="text-sm font-medium text-primary">
                          {preset.subtitle}
                        </CardDescription>
                        <p className="text-sm text-muted-foreground mt-1">{preset.description}</p>
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0">
                        {preset.steps.length} steps
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Flow Preview */}
                    <div className="space-y-2">
                      {preset.steps.map((step, index) => (
                        <div key={index} className="flex items-center gap-3 text-sm">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="p-1 bg-muted rounded text-muted-foreground">
                              {step.icon}
                            </div>
                            <span className="font-medium">{step.label}</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
                            <Clock className="h-3 w-3" />
                            <span className="text-xs">{step.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Metrics & Audience */}
                    <div className="pt-2 border-t space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Target className="h-4 w-4 text-green-600" />
                        <span className="text-green-600 font-medium">{preset.metrics}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>Target: {preset.audience}</span>
                      </div>
                    </div>

                    <Link to="/crm/automations/new/guide" className="block">
                      <Button variant="outline" className="w-full group">
                        Use This Template
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};