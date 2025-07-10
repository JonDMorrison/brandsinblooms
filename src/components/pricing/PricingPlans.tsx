
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Star } from "lucide-react";

interface PricingPlansProps {
  isAnnual: boolean;
  subscription: any;
  loading: boolean;
  loadingPlan: string | null;
  onSelectPlan: (plan: 'sprout' | 'bloom') => void;
  onStartTrial: () => void;
}

export const PricingPlans = ({ 
  isAnnual, 
  subscription, 
  loading, 
  loadingPlan, 
  onSelectPlan, 
  onStartTrial 
}: PricingPlansProps) => {
  const sproutFeatures = [
    "Weekly AI-generated campaign prompts",
    "Seasonal content calendar",
    "Email + social post generation",
    "1 user",
    "Unlimited scheduling",
    "Email support"
  ];

  const bloomFeatures = [
    "Everything in Sprout, plus:",
    "Multi-user access",
    "Custom brand voice tuning",
    "Priority support",
    "Annual event reminders",
    "Image asset library access",
    "Dedicated success check-in (monthly)"
  ];

  return (
    <section className="relative py-12 px-6 overflow-hidden bg-gradient-to-br from-surface-secondary via-surface-primary to-surface-secondary">
      {/* Background decorative elements */}
      <div className="absolute inset-0">
        <div className="absolute top-10 right-10 w-64 h-64 bg-gradient-to-br from-brand-teal-mint/10 to-brand-steel-blue/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-gradient-to-br from-brand-steel-blue/5 to-brand-teal-mint/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Sprout Plan */}
          <Card className="relative group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 rounded-2xl overflow-hidden border border-white/20 bg-white/60 backdrop-blur-sm">
            {/* Decorative background */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-teal-mint/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            <CardContent className="relative p-8 pt-4">
              <h3 className="text-2xl font-bold text-text-primary mb-3 bg-gradient-to-r from-brand-steel-blue to-text-primary bg-clip-text text-transparent">Sprout</h3>
              <div className="mb-6">
                <span className="text-5xl font-bold bg-gradient-to-r from-brand-teal-mint to-brand-steel-blue bg-clip-text text-transparent">
                  ${isAnnual ? '32' : '39'}
                </span>
                <span className="text-text-secondary text-lg">/month</span>
                {isAnnual && (
                  <p className="text-sm text-text-tertiary mt-1 bg-white/40 backdrop-blur-sm rounded-lg px-2 py-1 inline-block">Billed annually at $390</p>
                )}
              </div>
              <p className="text-text-secondary mb-6 font-medium">Best for solo garden centers</p>
              
              <ul className="space-y-4 mb-8">
                {sproutFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="p-1 bg-gradient-to-br from-brand-teal-mint to-brand-steel-blue rounded-full">
                      <CheckCircle className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-text-secondary">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <div className="relative group-hover:scale-105 transition-transform duration-300">
                <Button 
                  onClick={() => subscription ? onSelectPlan('sprout') : onStartTrial()}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-brand-teal-mint to-brand-steel-blue hover:from-brand-steel-blue hover:to-brand-teal-mint text-white py-4 px-6 rounded-xl text-lg font-semibold shadow-2xl border border-white/20 backdrop-blur-sm transition-all duration-300"
                >
                  {loadingPlan === 'sprout' ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Processing...
                    </div>
                  ) : (
                    subscription ? 'Choose Sprout' : 'Start Free Trial'
                  )}
                </Button>
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-brand-teal-mint/20 to-brand-steel-blue/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer"
                  onClick={() => subscription ? onSelectPlan('sprout') : onStartTrial()}
                ></div>
              </div>
            </CardContent>
          </Card>

          {/* Bloom Plan */}
          <Card className="relative group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 rounded-2xl overflow-hidden border-2 border-brand-teal-mint/30 bg-gradient-to-br from-white/80 to-brand-teal-mint/5 backdrop-blur-sm">
            {/* Most Popular Badge */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-20">
              <Badge className="bg-gradient-to-r from-brand-steel-blue to-brand-teal-mint text-white px-8 py-2 rounded-full shadow-2xl border border-white/30 backdrop-blur-sm flex items-center gap-2 whitespace-nowrap z-30">
                <Star className="h-4 w-4 flex-shrink-0" />
                Most Popular
              </Badge>
            </div>

            {/* Decorative background */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-teal-mint/10 via-transparent to-brand-steel-blue/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            <CardContent className="relative p-8 pt-12">
              <h3 className="text-2xl font-bold text-text-primary mb-3 bg-gradient-to-r from-brand-teal-mint to-brand-steel-blue bg-clip-text text-transparent">Bloom</h3>
              <div className="mb-6">
                <span className="text-5xl font-bold bg-gradient-to-r from-brand-steel-blue via-brand-teal-mint to-brand-steel-blue bg-clip-text text-transparent">
                  ${isAnnual ? '66' : '79'}
                </span>
                <span className="text-text-secondary text-lg">/month</span>
                {isAnnual && (
                  <p className="text-sm text-text-tertiary mt-1 bg-white/50 backdrop-blur-sm rounded-lg px-2 py-1 inline-block border border-white/30">Billed annually at $790</p>
                )}
              </div>
              <p className="text-text-secondary mb-6 font-medium">Best for teams and busy retailers</p>
              
              <ul className="space-y-4 mb-8">
                {bloomFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="p-1 bg-gradient-to-br from-brand-steel-blue to-brand-teal-mint rounded-full">
                      <CheckCircle className="h-4 w-4 text-white" />
                    </div>
                    <span className={`text-text-secondary ${index === 0 ? 'font-semibold' : ''}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              
              <div className="relative group-hover:scale-105 transition-transform duration-300">
                <Button 
                  onClick={() => subscription ? onSelectPlan('bloom') : onStartTrial()}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-brand-steel-blue via-brand-teal-mint to-brand-steel-blue hover:from-brand-teal-mint hover:to-brand-steel-blue text-white py-4 px-6 rounded-xl text-lg font-semibold shadow-2xl border border-white/30 backdrop-blur-sm transition-all duration-300"
                >
                  {loadingPlan === 'bloom' ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Processing...
                    </div>
                  ) : (
                    subscription ? 'Choose Bloom' : 'Start Free Trial'
                  )}
                </Button>
                <div className="absolute inset-0 bg-gradient-to-r from-brand-steel-blue/30 to-brand-teal-mint/30 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
