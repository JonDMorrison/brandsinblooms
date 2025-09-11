import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

import { PricingHero } from "@/components/pricing/PricingHero";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { FAQSection } from "@/components/pricing/FAQSection";
import { FinalCTA } from "@/components/pricing/FinalCTA";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { FullWidthLayout } from "@/components/FullWidthLayout";

const PricingPage = () => {
  const navigate = useNavigate();
  const { refreshSubscription, subscription } = useSubscription();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleStartTrial = () => {
    navigate('/auth');
  };

  const handleSelectPlan = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          plan: 'bloomsuite',
          billingInterval: 'year'
        }
      });

      if (error) {
        console.error('Checkout error:', error);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        console.error('No checkout URL received');
      }
    } catch (error) {
      console.error('Unexpected error during checkout:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check for checkout success/cancel in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const checkout = urlParams.get('checkout');
    
    if (checkout === 'success') {
      refreshSubscription();
      window.history.replaceState({}, document.title, window.location.pathname);
      navigate('/');
    } else if (checkout === 'cancelled') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [navigate, refreshSubscription]);

  if (user) {
    return (
      <FullWidthLayout>
        <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-muted/30">
          <PricingHero subscription={subscription} onStartTrial={handleStartTrial} />
          <PricingPlans 
            subscription={subscription}
            loading={loading}
            onSelectPlan={handleSelectPlan}
            onStartTrial={handleStartTrial}
          />
          <FAQSection />
          <FinalCTA subscription={subscription} onStartTrial={handleStartTrial} />
        </div>
      </FullWidthLayout>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-muted/30">
      <LandingPageHeader onLogin={() => navigate('/auth')} />
      <PricingHero subscription={subscription} onStartTrial={handleStartTrial} />
      <PricingPlans 
        subscription={subscription}
        loading={loading}
        onSelectPlan={handleSelectPlan}
        onStartTrial={handleStartTrial}
      />
      <FAQSection />
      <FinalCTA subscription={subscription} onStartTrial={handleStartTrial} />
    </div>
  );
};

export default PricingPage;