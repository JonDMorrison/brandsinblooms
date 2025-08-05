import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Zap, Sparkles, Users, ArrowRight, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const WebsiteWaitlistPage = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('website_waitlist')
        .insert([{ email, source: 'dashboard' }]);

      if (error) throw error;

      setIsSubmitted(true);
      toast.success('You\'re on the waitlist! We\'ll notify you when it\'s ready.');
    } catch (error) {
      console.error('Error joining waitlist:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You're In!</h2>
            <p className="text-gray-600 mb-6">
              Thanks for joining our website builder waitlist. We'll send you early access when it's ready!
            </p>
            <Button 
              onClick={() => window.history.back()}
              className="w-full"
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50">
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-teal-100 text-teal-700 border-teal-200">
            Coming Soon
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Build Your Website
            <span className="block text-teal-600">In Just Minutes</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Our AI-powered website builder is almost here. Create stunning, professional websites 
            without any coding knowledge. Just describe what you want, and watch it come to life.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="text-center border-0 shadow-lg">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-teal-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Lightning Fast</h3>
              <p className="text-gray-600">
                Go from idea to live website in minutes, not weeks. Our AI understands your vision instantly.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center border-0 shadow-lg">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">AI-Powered Design</h3>
              <p className="text-gray-600">
                Advanced AI creates beautiful, custom designs tailored to your brand and industry.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center border-0 shadow-lg">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Fully Responsive</h3>
              <p className="text-gray-600">
                Every website looks perfect on desktop, tablet, and mobile. No design compromises.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Waitlist Signup */}
        <Card className="max-w-lg mx-auto border-0 shadow-xl">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-teal-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Join the Waitlist</h2>
              <p className="text-gray-600">
                Be among the first to experience our revolutionary website builder. 
                Get early access and exclusive launch pricing.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-center text-lg py-6"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full text-lg py-6 bg-teal-600 hover:bg-teal-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Joining...' : 'Join the Waitlist'}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                🎉 Limited early access • 🔥 Special launch pricing • ⚡ Priority support
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Benefits Section */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-8">Why Join the Waitlist?</h3>
          <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-green-600 font-bold">1</span>
              </div>
              <p className="text-sm text-gray-600">Early Access</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <p className="text-sm text-gray-600">Special Pricing</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <p className="text-sm text-gray-600">Priority Support</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-teal-600 font-bold">4</span>
              </div>
              <p className="text-sm text-gray-600">Shape the Product</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};