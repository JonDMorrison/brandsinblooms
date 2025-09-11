import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Star, Leaf } from "lucide-react";

interface PricingPlansProps {
  subscription: any;
  loading: boolean;
  onSelectPlan: () => void;
  onStartTrial: () => void;
}
export const PricingPlans = ({
  subscription,
  loading,
  onSelectPlan,
  onStartTrial
}: PricingPlansProps) => {
  const bloomSuiteFeatures = [
    "Complete AI-powered content creation suite",
    "Advanced seasonal marketing campaigns", 
    "Multi-channel content distribution",
    "Smart CRM with customer lifecycle tracking",
    "Automated email marketing sequences",
    "Social media scheduling & management",
    "Performance analytics & insights",
    "Custom brand voice & style training",
    "Priority support & dedicated success manager",
    "Unlimited team members",
    "Advanced automation workflows",
    "Custom integrations & API access"
  ];

  return (
    <section className="py-16 px-6 bg-white/60">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-accent mb-4">
            One Complete Solution for Garden Centers
          </h2>
          <p className="text-xl text-muted-foreground">
            Everything you need to grow your business, all in one platform
          </p>
        </div>
        
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 rounded-2xl relative border-primary border-2 bg-gradient-to-br from-white to-background/50">
            <CardContent className="pt-4">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-primary to-brand-teal-mint text-white px-6 py-2 flex items-center gap-2 text-lg">
                  <Leaf className="h-5 w-5" />
                  BloomSuite Complete
                </Badge>
              </div>
              
              <div className="text-center mb-8 mt-4">
                <h3 className="text-2xl font-bold text-accent mb-4">BloomSuite</h3>
                <div className="mb-6">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-bold text-primary">$2,999</span>
                    <span className="text-xl text-muted-foreground">/year</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    That's just $250/month - billed annually
                  </p>
                  <p className="text-xs text-primary font-medium mt-1">
                    Save thousands compared to using separate tools
                  </p>
                </div>
              </div>
              
              <ul className="space-y-4 mb-10">
                {bloomSuiteFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-accent-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <div className="space-y-4">
                <Button 
                  onClick={() => subscription ? onSelectPlan() : onStartTrial()} 
                  disabled={loading} 
                  size="lg"
                  className="w-full bg-gradient-to-r from-primary to-brand-teal-mint hover:from-brand-teal-mint hover:to-primary text-white py-6 px-8 rounded-xl text-xl font-semibold transition-all duration-300 hover:scale-105 shadow-2xl border-2 border-transparent hover:border-white/20"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                      Processing...
                    </div>
                  ) : subscription ? (
                    'Upgrade to BloomSuite'
                  ) : (
                    'Start Free Trial'
                  )}
                </Button>
                
                {!subscription && (
                  <p className="text-center text-sm text-muted-foreground">
                    30-day free trial • No credit card required • Cancel anytime
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};