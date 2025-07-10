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
  const sproutFeatures = ["Weekly AI-generated campaign prompts", "Seasonal content calendar", "Email + social post generation", "1 user", "Unlimited scheduling", "Email support"];
  const bloomFeatures = ["Everything in Sprout, plus:", "Multi-user access", "Custom brand voice tuning", "Priority support", "Annual event reminders", "Image asset library access", "Dedicated success check-in (monthly)"];
  return <section className="py-12 px-6 bg-white/60">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Sprout Plan */}
          <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl">
            <CardContent className="pt-4">
              <h3 className="text-xl font-semibold text-garden-green-dark mb-2">Sprout</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-garden-green-dark">
                  ${isAnnual ? '32' : '39'}
                </span>
                <span className="text-gray-600">/month</span>
                {isAnnual && <p className="text-sm text-gray-500 mt-1">Billed annually at $390</p>}
              </div>
              <p className="text-gray-600 mb-6">Best for solo garden centers</p>
              
              <ul className="space-y-3 mb-8">
                {sproutFeatures.map((feature, index) => <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-garden-green mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </li>)}
              </ul>
              
              <Button onClick={() => subscription ? onSelectPlan('sprout') : onStartTrial()} disabled={loading} className="w-full bg-garden-green hover:bg-garden-green-dark text-white py-4 px-6 rounded-xl text-lg font-semibold transition-all duration-200 hover:scale-105 shadow-xl border-2 border-transparent hover:border-garden-green-dark focus:ring-4 focus:ring-garden-green/30">
                {loadingPlan === 'sprout' ? <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Processing...
                  </div> : subscription ? 'Choose Sprout' : 'Start Free Trial'}
              </Button>
            </CardContent>
          </Card>

          {/* Bloom Plan */}
          <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl relative border-garden-green border-2">
            <CardContent className="pt-4">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-garden-green text-white px-4 py-1 flex items-center gap-1">
                  <Star className="h-4 w-4" />
                  Most Popular
                </Badge>
              </div>
              
              <h3 className="text-xl font-semibold text-garden-green-dark mb-2">Bloom</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-garden-green-dark">
                  ${isAnnual ? '66' : '79'}
                </span>
                <span className="text-gray-600">/month</span>
                {isAnnual && <p className="text-sm text-gray-500 mt-1">Billed annually at $790</p>}
              </div>
              <p className="text-gray-600 mb-6">Best for teams and busy retailers</p>
              
              <ul className="space-y-3 mb-8">
                {bloomFeatures.map((feature, index) => <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-garden-green mt-0.5 flex-shrink-0" />
                    <span className={`text-gray-700 ${index === 0 ? 'font-semibold' : ''}`}>
                      {feature}
                    </span>
                  </li>)}
              </ul>
              
              <Button onClick={() => subscription ? onSelectPlan('bloom') : onStartTrial()} disabled={loading} className="w-full bg-gradient-to-r from-garden-green to-garden-green-dark hover:from-garden-green-dark hover:to-garden-green text-white py-4 px-6 rounded-xl text-lg font-semibold transition-all duration-200 hover:scale-105 shadow-xl border-2 border-transparent hover:border-garden-green focus:ring-4 focus:ring-garden-green/30">
                {loadingPlan === 'bloom' ? <div className="flex items-center gap-2">
                    
                    Processing...
                  </div> : subscription ? 'Choose Bloom' : 'Start Free Trial'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>;
};