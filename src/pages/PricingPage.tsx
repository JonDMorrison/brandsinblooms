
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PricingHero } from "@/components/pricing/PricingHero";
import { PricingToggle } from "@/components/pricing/PricingToggle";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { AddOnsSection } from "@/components/pricing/AddOnsSection";
import { FAQSection } from "@/components/pricing/FAQSection";
import { FinalCTA } from "@/components/pricing/FinalCTA";

const PricingPage = () => {
  const navigate = useNavigate();
  const { updateSubscription, subscription } = useSubscription();
  const [isAnnual, setIsAnnual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { user } = useAuth();

  const handleAnnualToggle = (checked: boolean) => {
    setIsAnnual(checked);
  };

  const handleStartTrial = () => {
    navigate('/auth');
  };

  const handleSelectPlan = async (plan: 'sprout' | 'bloom') => {
    if (!subscription || !user) {
      navigate('/auth');
      return;
    }

    setLoading(true);
    setLoadingPlan(plan);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          plan: plan,
          billingInterval: isAnnual ? 'annual' : 'monthly'
        }
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
      setLoadingPlan(null);
    }
  };

  // Check for checkout success/cancel in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const checkout = urlParams.get('checkout');
    
    if (checkout === 'success') {
      toast.success('Payment successful! Your subscription is now active.');
      window.history.replaceState({}, document.title, window.location.pathname);
      navigate('/');
    } else if (checkout === 'cancelled') {
      toast.error('Checkout was cancelled.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-garden-background">
      <PricingHero 
        subscription={subscription}
        onStartTrial={handleStartTrial}
      />

      <section className="py-12 px-6 bg-white/60">
        <div className="max-w-6xl mx-auto">
          <PricingToggle 
            isAnnual={isAnnual}
            onToggle={handleAnnualToggle}
          />

          <PricingPlans
            isAnnual={isAnnual}
            subscription={subscription}
            loading={loading}
            loadingPlan={loadingPlan}
            onSelectPlan={handleSelectPlan}
            onStartTrial={handleStartTrial}
          />
        </div>
      </section>

      <AddOnsSection />
      <FAQSection />
      <FinalCTA 
        subscription={subscription}
        onStartTrial={handleStartTrial}
      />
    </div>
  );
};

export default PricingPage;
