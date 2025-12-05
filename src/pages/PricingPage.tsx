import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { PricingHeroNew } from "@/components/pricing/PricingHeroNew";
import { PricingCardsGrid } from "@/components/pricing/PricingCardsGrid";
import { AllPlansInclude } from "@/components/pricing/AllPlansInclude";
import { WhyThisWorks } from "@/components/pricing/WhyThisWorks";
import { FuturePricingSection } from "@/components/pricing/FuturePricingSection";
import { PricingFAQ } from "@/components/pricing/PricingFAQ";
import { FinalCTANew } from "@/components/pricing/FinalCTANew";

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
        try {
          if (window.top) {
            window.top.location.href = data.url;
          } else {
            window.location.href = data.url;
          }
        } catch {
          window.open(data.url, '_blank', 'noopener,noreferrer');
        }
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

  return (
    <div className="min-h-screen bg-white">
      <LandingPageHeader onLogin={() => navigate('/auth')} showUserMenu={true} />
      <PricingHeroNew />
      <PricingCardsGrid />
      <AllPlansInclude />
      <WhyThisWorks />
      <FuturePricingSection />
      <PricingFAQ />
      <FinalCTANew />
    </div>
  );
};

export default PricingPage;
