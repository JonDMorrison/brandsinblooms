
import { Button } from "@/components/ui/button";

interface PricingHeroProps {
  subscription: any;
  onStartTrial: () => void;
}

export const PricingHero = ({ subscription, onStartTrial }: PricingHeroProps) => {
  return (
    <section className="relative py-12 md:py-16 px-6 text-center overflow-hidden bg-gradient-to-br from-white via-brand-teal-mint/20 to-brand-steel-blue/15">
      {/* Bright Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-brand-teal-mint/40 to-primary/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-primary/35 to-brand-steel-blue/25 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-brand-teal-mint/15 to-white/20 rounded-full blur-3xl"></div>
        <div className="absolute top-32 right-32 w-48 h-48 bg-gradient-to-br from-white/30 to-brand-teal-mint/25 rounded-full blur-2xl"></div>
        <div className="absolute bottom-32 left-32 w-64 h-64 bg-gradient-to-br from-primary/20 to-white/15 rounded-full blur-2xl"></div>
      </div>

      {/* Light overlay for depth */}
      <div className="absolute inset-0 backdrop-blur-sm border border-white"></div>
      
      <div className="relative max-w-4xl mx-auto">
        <div className="bg-white/60 backdrop-blur-md border border-white/50 rounded-2xl p-6 md:p-8 shadow-2xl shadow-brand-teal-mint/10">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight bg-gradient-to-r from-brand-steel-blue via-text-primary to-brand-steel-blue bg-clip-text text-transparent">
            Simple Pricing for Growing Garden Centers
          </h1>
          
          <p className="text-lg md:text-xl lg:text-2xl text-text-secondary mb-6 md:mb-8 max-w-3xl mx-auto leading-relaxed">
            Whether you're just getting started or managing a full retail team, we've got a plan to fit your season.
          </p>
          
          {!subscription && (
            <div className="relative group">
              <Button 
                onClick={onStartTrial}
                className="bg-gradient-to-r from-brand-teal-mint via-brand-teal-mint to-brand-steel-blue hover:from-brand-steel-blue hover:to-brand-teal-mint text-white px-8 py-3 text-lg rounded-2xl shadow-2xl hover:shadow-brand-teal-mint/25 transition-all duration-300 hover:scale-105 border border-white/20"
              >
                Start Free Trial
              </Button>
              <div className="absolute inset-0 bg-gradient-to-r from-brand-teal-mint/20 to-brand-steel-blue/20 rounded-2xl blur-xl group-hover:blur-lg transition-all duration-300"></div>
            </div>
          )}

          {subscription?.plan === 'expired' && (
            <div className="bg-destructive/10 backdrop-blur-sm border border-destructive/20 rounded-2xl p-6 mb-6 max-w-md mx-auto shadow-lg">
              <p className="text-destructive font-medium">Your free trial has ended. Choose a plan to continue.</p>
            </div>
          )}

          {subscription?.plan === 'free_trial' && (
            <div className="bg-brand-teal-mint/10 backdrop-blur-sm border border-brand-teal-mint/20 rounded-2xl p-6 mb-6 max-w-md mx-auto shadow-lg">
              <p className="text-brand-steel-blue font-medium">
                You're currently on a free trial. Upgrade to continue access after your trial ends.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
