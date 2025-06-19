
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
      console.log('=== CHECKOUT DEBUG START ===');
      console.log('User:', { id: user.id, email: user.email });
      console.log('Plan selection:', { plan, billingInterval: isAnnual ? 'annual' : 'monthly' });
      console.log('Subscription state:', subscription);

      const requestBody = {
        plan: plan,
        billingInterval: isAnnual ? 'annual' : 'monthly'
      };
      
      console.log('Sending request to create-checkout with body:', requestBody);
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: requestBody
      });

      console.log('=== SUPABASE FUNCTION RESPONSE ===');
      console.log('Raw response data:', data);
      console.log('Raw response error:', error);

      if (error) {
        console.error('=== SUPABASE FUNCTION ERROR ===');
        console.error('Error object:', error);
        console.error('Error message:', error.message);
        console.error('Error context:', error.context);
        
        // Show user-friendly error messages based on error type
        if (error.message?.includes('Failed to send a request')) {
          toast.error('Service temporarily unavailable. Please check your connection and try again.');
        } else if (error.message?.includes('configuration')) {
          toast.error('Payment system is not configured. Please contact support.');
        } else if (error.message?.includes('authentication')) {
          toast.error('Authentication required. Please sign in and try again.');
        } else {
          toast.error(`Checkout failed: ${error.message || 'Unknown error'}`);
        }
        return;
      }

      if (data?.error) {
        console.error('=== FUNCTION RETURNED ERROR ===');
        console.error('Function error:', data.error);
        console.error('Function error details:', data.details);
        toast.error(`Error: ${data.error}${data.details ? ` - ${data.details}` : ''}`);
        return;
      }

      if (data?.url) {
        console.log('=== CHECKOUT SUCCESS ===');
        console.log('Redirecting to Stripe checkout:', data.url);
        window.location.href = data.url;
      } else {
        console.error('=== INVALID RESPONSE ===');
        console.error('No checkout URL received. Full response:', data);
        toast.error('Invalid response from payment system. Please try again.');
      }
    } catch (error) {
      console.error('=== NETWORK ERROR ===');
      console.error('Caught error:', error);
      console.error('Error type:', typeof error);
      console.error('Error constructor:', error?.constructor?.name);
      
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      
      toast.error('Network error. Please check your connection and try again.');
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
