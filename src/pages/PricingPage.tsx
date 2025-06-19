
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PricingPage = () => {
  const navigate = useNavigate();
  const { updateSubscription, subscription } = useSubscription();
  const [isAnnual, setIsAnnual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { user } = useAuth();

  // Debug logging for annual toggle
  const handleAnnualToggle = (checked: boolean) => {
    console.log('Annual toggle clicked:', { from: isAnnual, to: checked });
    setIsAnnual(checked);
    console.log('Annual state updated to:', checked);
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
        // Same-window redirect instead of new tab
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
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      navigate('/');
    } else if (checkout === 'cancelled') {
      toast.error('Checkout was cancelled.');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [navigate]);

  // Debug effect to log pricing changes
  useEffect(() => {
    console.log('Pricing display updated:', {
      isAnnual,
      sproutPrice: isAnnual ? '32' : '39',
      bloomPrice: isAnnual ? '66' : '79'
    });
  }, [isAnnual]);

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

  const addOns = [
    {
      name: "White-Glove Setup",
      price: "$149 one-time",
      description: "We'll load in your brand voice, tone, and first 3 campaigns for you."
    },
    {
      name: "Monthly Strategy Call",
      price: "$49/month",
      description: "Book a 30-min monthly coaching call with our marketing team."
    }
  ];

  const faqs = [
    {
      question: "Is there a free trial?",
      answer: "Yes! We offer a 14-day free trial with no credit card required. You'll have full access to all features during your trial period."
    },
    {
      question: "Can I cancel anytime?",
      answer: "Absolutely. You can cancel your subscription at any time from your account settings. There are no cancellation fees or long-term contracts."
    },
    {
      question: "Do you offer discounts for co-ops or multi-location groups?",
      answer: "Yes! We offer special pricing for garden center cooperatives and multi-location businesses. Contact our sales team for custom pricing options."
    },
    {
      question: "Will this work for my garden center's brand?",
      answer: "Definitely! Our AI learns your unique brand voice and tone from your website and existing content to create personalized marketing materials that sound authentically you."
    },
    {
      question: "What kind of support do you offer?",
      answer: "All plans include email support. Bloom plan subscribers get priority support with faster response times. We also offer optional monthly strategy calls for additional guidance."
    }
  ];

  return (
    <div className="min-h-screen bg-garden-background">
      {/* Hero Section */}
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
              onClick={handleStartTrial}
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

      {/* Pricing Plans Section */}
      <section className="py-12 px-6 bg-white/60">
        <div className="max-w-6xl mx-auto">
          {/* Pricing Toggle with enhanced styling and debugging */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={`text-lg transition-all duration-200 ${!isAnnual ? 'text-garden-green-dark font-semibold' : 'text-gray-600'}`}>
              Monthly
            </span>
            <div className="relative">
              <Switch 
                checked={isAnnual} 
                onCheckedChange={handleAnnualToggle}
                className="data-[state=checked]:bg-garden-green pointer-events-auto cursor-pointer relative z-10"
                style={{ pointerEvents: 'auto' }}
                onClick={() => console.log('Switch clicked directly')}
              />
              {/* Debug indicator */}
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">
                {isAnnual ? 'Annual' : 'Monthly'}
              </div>
            </div>
            <span className={`text-lg transition-all duration-200 ${isAnnual ? 'text-garden-green-dark font-semibold' : 'text-gray-600'}`}>
              Annual
            </span>
            {isAnnual && (
              <Badge className="bg-garden-green text-white ml-2 animate-in slide-in-from-left duration-200">
                Save 17%
              </Badge>
            )}
          </div>

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
                  {isAnnual && (
                    <p className="text-sm text-gray-500 mt-1">Billed annually at $390</p>
                  )}
                </div>
                <p className="text-gray-600 mb-6">Best for solo garden centers</p>
                
                <ul className="space-y-3 mb-8">
                  {sproutFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-garden-green mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  onClick={() => subscription ? handleSelectPlan('sprout') : handleStartTrial()}
                  disabled={loading}
                  className="w-full bg-garden-green hover:bg-garden-green-dark text-white py-3 rounded-xl"
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
                  {isAnnual && (
                    <p className="text-sm text-gray-500 mt-1">Billed annually at $790</p>
                  )}
                </div>
                <p className="text-gray-600 mb-6">Best for teams and busy retailers</p>
                
                <ul className="space-y-3 mb-8">
                  {bloomFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-garden-green mt-0.5 flex-shrink-0" />
                      <span className={`text-gray-700 ${index === 0 ? 'font-semibold' : ''}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  onClick={() => subscription ? handleSelectPlan('bloom') : handleStartTrial()}
                  disabled={loading}
                  className="w-full bg-garden-green hover:bg-garden-green-dark text-white py-3 rounded-xl"
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
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Add-ons Section */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-12 text-garden-green-dark">
            Add-Ons
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {addOns.map((addOn, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-all duration-300 rounded-2xl">
                <CardContent className="pt-2">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-garden-green-dark">
                      {addOn.name}
                    </h3>
                    <span className="text-xl font-bold text-garden-green">
                      {addOn.price}
                    </span>
                  </div>
                  <p className="text-gray-600">{addOn.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 px-6 bg-white/60">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-12 text-garden-green-dark">
            Frequently Asked Questions
          </h2>
          
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border border-gray-200 rounded-xl px-6">
                <AccordionTrigger className="text-left text-garden-green-dark hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA Section */}
      {!subscription && (
        <section className="py-12 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl font-semibold mb-4 text-garden-green-dark">
              Not sure where to start?
            </h2>
            
            <p className="text-base text-gray-600 mb-10">
              Try it free for 14 days — no credit card required.
            </p>
            
            <Button 
              onClick={handleStartTrial}
              className="bg-garden-green hover:bg-garden-green-dark text-white px-12 py-4 text-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              Start Free Trial
            </Button>
          </div>
        </section>
      )}
    </div>
  );
};

export default PricingPage;
