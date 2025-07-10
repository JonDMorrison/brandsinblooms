
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
import { SidebarLayout } from "@/components/SidebarLayout";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";

const PricingPage = () => {
  const navigate = useNavigate();
  const { updateSubscription, subscription } = useSubscription();
  const [isAnnual, setIsAnnual] = useState(true);
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
    if (!user) {
      console.log('No user found, redirecting to auth');
      navigate('/auth');
      return;
    }

    setLoading(true);
    setLoadingPlan(plan);
    
    try {
      console.log('=== CHECKOUT DEBUG START ===');
      console.log('User:', { id: user.id, email: user.email });
      console.log('Plan selection:', { plan, billingInterval: isAnnual ? 'annual' : 'monthly' });
      console.log('Current user session:', await supabase.auth.getSession());

      const requestBody = {
        plan: plan,
        billingInterval: isAnnual ? 'annual' : 'monthly'
      };
      
      console.log('Calling create-checkout function with:', requestBody);
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: requestBody
      });

      console.log('=== FUNCTION RESPONSE ===');
      console.log('Data:', data);
      console.log('Error:', error);

      if (error) {
        console.error('=== FUNCTION ERROR ===');
        console.error('Error details:', error);
        
        // More specific error handling
        if (error.message?.includes('Failed to send a request') || error.message?.includes('network')) {
          toast.error('Network error. Please check your connection and try again.');
        } else if (error.message?.includes('authentication') || error.message?.includes('unauthorized')) {
          toast.error('Authentication error. Please try logging out and back in.');
        } else {
          toast.error(`Payment error: ${error.message}`);
        }
        return;
      }

      if (data?.error) {
        console.error('=== FUNCTION RETURNED ERROR ===');
        console.error('Function error:', data.error);
        toast.error(`Error: ${data.error}`);
        return;
      }

      if (data?.url) {
        console.log('=== CHECKOUT SUCCESS ===');
        console.log('Redirecting to:', data.url);
        // Open in new tab to prevent losing the current page
        window.open(data.url, '_blank');
      } else {
        console.error('=== NO CHECKOUT URL ===');
        console.error('Response data:', data);
        toast.error('No checkout URL received. Please try again.');
      }
    } catch (error) {
      console.error('=== UNEXPECTED ERROR ===');
      console.error('Caught error:', error);
      
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        toast.error(`Unexpected error: ${error.message}`);
      } else {
        toast.error('An unexpected error occurred. Please try again.');
      }
    } finally {
      console.log('=== CHECKOUT DEBUG END ===');
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

  const pricingContent = (
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

  if (user) {
    return <SidebarLayout>{pricingContent}</SidebarLayout>;
  }

  return (
    <div className="min-h-screen bg-garden-background">
      <LandingPageHeader 
        onLogin={() => navigate('/auth')}
        showUserMenu={true}
      />
      {pricingContent}
    </div>
  );
};

export default PricingPage;
