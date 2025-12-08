import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  ArrowRight, 
  Store, 
  Users, 
  Zap, 
  Shield,
  Clock,
  RefreshCw,
  Mail,
  MessageSquare,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SquareOnboardingGuide = () => {
  const navigate = useNavigate();

  const steps = [
    {
      number: 1,
      title: "Create Your BloomSuite Account",
      description: "Sign up for BloomSuite and complete your company profile with your business details.",
      details: [
        "Go to BloomSuite and create an account",
        "Complete your company profile with business name and details",
        "Set your brand colors and logo for consistent email campaigns"
      ],
      icon: Store,
      time: "5 minutes"
    },
    {
      number: 2,
      title: "Navigate to Integrations",
      description: "Access the integrations hub to connect your Square account.",
      details: [
        "Click on 'Integrations' in the main navigation menu",
        "Find the 'Square' integration card in the POS Integrations section",
        "Click 'Connect' to begin the authorization process"
      ],
      icon: Zap,
      time: "1 minute"
    },
    {
      number: 3,
      title: "Authorize Square Connection",
      description: "Securely connect your Square account using OAuth authentication.",
      details: [
        "A new window will open to Square's authorization page",
        "Log in with your Square account credentials",
        "Review the permissions requested by BloomSuite",
        "Click 'Allow' to authorize the connection",
        "The window will close automatically after successful connection"
      ],
      icon: Shield,
      time: "2 minutes"
    },
    {
      number: 4,
      title: "Initial Customer Sync",
      description: "BloomSuite will automatically import your customer data from Square.",
      details: [
        "Customer names, emails, and phone numbers are imported",
        "Purchase history and transaction data is synchronized",
        "Customers are automatically segmented based on behavior",
        "First-time vs. returning customers are identified"
      ],
      icon: RefreshCw,
      time: "5-10 minutes (depending on customer count)"
    },
    {
      number: 5,
      title: "Set Up Automations",
      description: "Configure automated marketing workflows triggered by Square purchases.",
      details: [
        "Navigate to 'Automations' in the CRM section",
        "Create automations for: First Purchase Welcome, Post-Purchase Follow-up, Review Requests, Birthday Campaigns",
        "Automations trigger in real-time when purchases occur in Square",
        "Customize email/SMS content for each automation"
      ],
      icon: Zap,
      time: "15-30 minutes"
    },
    {
      number: 6,
      title: "Verify Real-Time Webhooks",
      description: "Confirm that purchase events are triggering automations correctly.",
      details: [
        "Make a test purchase in Square (can use sandbox mode)",
        "Check that the customer appears in BloomSuite CRM",
        "Verify automation emails/SMS are queued or sent",
        "Review automation logs for successful execution"
      ],
      icon: CheckCircle2,
      time: "5 minutes"
    }
  ];

  const benefits = [
    {
      title: "Automatic Customer Import",
      description: "All your Square customers are automatically synced to BloomSuite",
      icon: Users
    },
    {
      title: "Real-Time Purchase Triggers",
      description: "Automations fire instantly when customers make purchases",
      icon: Zap
    },
    {
      title: "Purchase History Tracking",
      description: "Track lifetime value, purchase frequency, and customer segments",
      icon: Store
    },
    {
      title: "Multi-Channel Marketing",
      description: "Send automated emails and SMS based on purchase behavior",
      icon: Mail
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/integrations')}
            className="mb-4"
          >
            <ChevronRight className="h-4 w-4 rotate-180 mr-2" />
            Back to Integrations
          </Button>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="h-16 w-16 bg-black rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-2xl">□</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold">Square Integration Guide</h1>
              <p className="text-muted-foreground">Complete onboarding guide for connecting Square to BloomSuite</p>
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Total Time: ~30-45 minutes
            </Badge>
            <Badge variant="outline">POS Integration</Badge>
            <Badge variant="outline">Real-Time Sync</Badge>
          </div>
        </div>

        {/* Benefits Overview */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Why Connect Square?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <benefit.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{benefit.title}</h4>
                    <p className="text-xs text-muted-foreground">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Prerequisites */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Prerequisites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Active Square account with at least one location
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Admin access to your Square account
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                BloomSuite account with completed company profile
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Customer email/phone data in Square (for marketing campaigns)
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Step by Step Guide */}
        <div className="space-y-4 mb-8">
          <h2 className="text-2xl font-bold">Step-by-Step Setup</h2>
          
          {steps.map((step, index) => (
            <Card key={step.number} className="relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                    {step.number}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">{step.title}</h3>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {step.time}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mb-4">{step.description}</p>
                    <ul className="space-y-2">
                      {step.details.map((detail, detailIndex) => (
                        <li key={detailIndex} className="flex items-start gap-2 text-sm">
                          <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
              
              {index < steps.length - 1 && (
                <div className="absolute left-[1.15rem] -bottom-4 h-8 w-0.5 bg-border z-10" />
              )}
            </Card>
          ))}
        </div>

        {/* Automation Examples */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Recommended Automations for Square
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  First Purchase Welcome
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Triggers immediately when a customer makes their first purchase. Welcome them and encourage a second visit.
                </p>
                <Badge variant="secondary">Trigger: first_purchase</Badge>
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Review Request (5 Days Post-Purchase)
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Ask customers to leave a review 5 days after their purchase when the experience is still fresh.
                </p>
                <Badge variant="secondary">Trigger: review_request</Badge>
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Win-Back Campaign (90 Days Inactive)
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Re-engage customers who haven't purchased in 90 days with a special offer.
                </p>
                <Badge variant="secondary">Trigger: order.completed (with delay)</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Troubleshooting */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Troubleshooting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Connection fails during authorization</h4>
                <p className="text-sm text-muted-foreground">
                  Ensure you're logged into the correct Square account and have admin permissions. Try clearing browser cache and attempting again.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Customers not syncing</h4>
                <p className="text-sm text-muted-foreground">
                  Check that your Square customers have email addresses. Customers without emails cannot be synced for email marketing.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Automations not triggering</h4>
                <p className="text-sm text-muted-foreground">
                  Verify the automation is set to "Active" and the trigger type matches the event. Check automation logs for error messages.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-xl mb-1">Ready to Connect?</h3>
                <p className="text-primary-foreground/80">Start syncing your Square customers and automating your marketing.</p>
              </div>
              <Button 
                variant="secondary" 
                size="lg"
                onClick={() => navigate('/integrations')}
                className="flex items-center gap-2"
              >
                Go to Integrations
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SquareOnboardingGuide;
