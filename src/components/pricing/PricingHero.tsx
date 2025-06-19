
import { Button } from "@/components/ui/button";

interface PricingHeroProps {
  subscription: any;
  onStartTrial: () => void;
}

export const PricingHero = ({ subscription, onStartTrial }: PricingHeroProps) => {
  return (
    <section className="py-24 px-6 text-center">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-bold text-garden-green-dark mb-6 leading-tight">
          Simple Pricing for Growing Garden Centers
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
          Whether you're just getting started or managing a full retail team, we've got a plan to fit your season.
        </p>
        
        {!subscription && (
          <Button 
            onClick={onStartTrial}
            className="bg-garden-green hover:bg-garden-green-dark text-white px-12 py-4 text-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            Start Free Trial
          </Button>
        )}

        {subscription?.plan === 'expired' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
            <p className="text-red-700 font-medium">Your free trial has ended. Choose a plan to continue.</p>
          </div>
        )}

        {subscription?.plan === 'free_trial' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
            <p className="text-blue-700 font-medium">
              You're currently on a free trial. Upgrade to continue access after your trial ends.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
