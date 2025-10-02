import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface PricingHeroProps {
  subscription: any;
  onStartTrial: () => void;
  onBuyNow?: () => void;
}

export const PricingHero = ({ subscription, onStartTrial }: PricingHeroProps) => {
  return (
    <section className="py-20 px-6 bg-gradient-to-br from-green-50 to-blue-50">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-bold text-foreground mb-6">
          Simple, Transparent Pricing for Garden Centers
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
          Everything you need to grow your business - AI content creation, CRM, automation, analytics, and more - all for one simple annual price.
        </p>
        
        {!subscription && (
          <Button 
            onClick={onStartTrial}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-lg"
          >
            Start Free Trial
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        )}

        {subscription?.plan === 'expired' && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 mt-6 max-w-md mx-auto">
            <p className="text-destructive font-medium">Your free trial has ended. Choose a plan to continue.</p>
          </div>
        )}

        {subscription?.plan === 'free_trial' && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 mt-6 max-w-md mx-auto">
            <p className="text-primary font-medium">
              You're currently on a free trial. Upgrade to continue access after your trial ends.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
