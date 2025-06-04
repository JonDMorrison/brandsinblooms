import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Users, Edit, TrendingUp, Star, ArrowRight } from "lucide-react";

interface LandingPageProps {
  onGetStarted?: () => void;
}

export const LandingPage = ({ onGetStarted }: LandingPageProps) => {
  const handleGetStarted = () => {
    if (onGetStarted) {
      onGetStarted();
    } else {
      // Fallback for when used in preview mode
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-garden-background via-garden-sage to-garden-background">
      {/* Hero Section */}
      <section className="relative px-4 py-20 text-center max-w-6xl mx-auto">
        <div className="absolute top-10 left-10 text-6xl opacity-20">🌱</div>
        <div className="absolute top-20 right-20 text-4xl opacity-30">☀️</div>
        <div className="absolute bottom-10 left-1/4 text-3xl opacity-25">🌿</div>
        
        <h1 className="text-5xl md:text-6xl font-bold text-garden-green-dark mb-6 leading-tight">
          Marketing Help Built for
          <span className="text-garden-green block mt-2">Garden Centers</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
          Grow your business with ready-to-go campaigns, seasonal content, and expert support — all in one place.
        </p>
        
        <Button 
          onClick={handleGetStarted}
          className="bg-warning-500 hover:bg-warning-600 text-warning-foreground px-12 py-4 text-xl rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
        >
          Get Started
          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </Button>
        
        <div className="mt-16 relative">
          <div className="w-full h-64 bg-gradient-to-r from-green-100 to-yellow-100 rounded-2xl shadow-xl flex items-center justify-center text-8xl">
            🌻🌿🏪
          </div>
          <div className="absolute -bottom-4 -left-4 bg-white p-4 rounded-xl shadow-lg">
            <div className="text-sm font-medium text-green-700">+127% Sales Growth</div>
          </div>
          <div className="absolute -top-4 -right-4 bg-white p-4 rounded-xl shadow-lg">
            <div className="text-sm font-medium text-blue-700">3 Minutes Setup</div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 bg-white/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 text-garden-green-dark">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center p-8 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-garden-green-dark">
                  1. Choose Your Campaign
                </h3>
                <p className="text-gray-600">
                  Pick from professionally written templates and ideas tailored for garden centers.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-8 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Edit className="h-8 w-8 text-warning-600" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-garden-green-dark">
                  2. Personalize It
                </h3>
                <p className="text-gray-600">
                  Upload your photos and tweak the content to match your unique style and voice.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-8 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-accent-blue/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-garden-green-dark">
                  3. Publish & Track
                </h3>
                <p className="text-gray-600">
                  Send it out to your customers and see what performs best with detailed analytics.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 text-garden-green-dark">
            Everything You Need to Succeed
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 hover:shadow-lg transition-all hover:-translate-y-1">
              <CardContent className="pt-4">
                <div className="text-3xl mb-4">📅</div>
                <h3 className="font-semibold mb-2 text-garden-green-dark">
                  Pre-written Seasonal Campaigns
                </h3>
                <p className="text-sm text-gray-600">
                  Spring sales, holiday promotions, and summer workshops - all ready to go.
                </p>
              </CardContent>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-all hover:-translate-y-1">
              <CardContent className="pt-4">
                <div className="text-3xl mb-4">🎯</div>
                <h3 className="font-semibold mb-2 text-garden-green-dark">
                  Content Tailored to Your Voice
                </h3>
                <p className="text-sm text-gray-600">
                  We learn your style and create content that sounds authentically you.
                </p>
              </CardContent>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-all hover:-translate-y-1">
              <CardContent className="pt-4">
                <div className="text-3xl mb-4">📱</div>
                <h3 className="font-semibold mb-2 text-garden-green-dark">
                  One-click Publishing
                </h3>
                <p className="text-sm text-gray-600">
                  Post to Instagram, Facebook, email, and your website all at once.
                </p>
              </CardContent>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-all hover:-translate-y-1">
              <CardContent className="pt-4">
                <div className="text-3xl mb-4">⚡</div>
                <h3 className="font-semibold mb-2 text-garden-green-dark">
                  Simple Setup
                </h3>
                <p className="text-sm text-gray-600">
                  No tech experience needed. Get started in minutes, not hours.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 bg-white/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 text-garden-green-dark">
            What Garden Center Owners Say
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 relative">
              <CardContent className="pt-4">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 italic">
                  "This saved us hours every week. We finally look professional online and our customers notice the difference."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                    L
                  </div>
                  <div>
                    <div className="font-semibold text-garden-green-dark">Linda</div>
                    <div className="text-sm text-gray-600">Owner, Maple Grove Greenhouse</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="p-8 relative">
              <CardContent className="pt-4">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 italic">
                  "We posted our Spring campaign and sold out of everything in three days. Best investment we've made."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                    C
                  </div>
                  <div>
                    <div className="font-semibold text-garden-green-dark">Carlos</div>
                    <div className="text-sm text-gray-600">Manager, Bloom Market</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="p-8 relative">
              <CardContent className="pt-4">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 italic">
                  "The seasonal content is perfect. It's like having a marketing expert on our team without the cost."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                    M
                  </div>
                  <div>
                    <div className="font-semibold text-garden-green-dark">Maria</div>
                    <div className="text-sm text-gray-600">Owner, Sunshine Nursery</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-garden-green to-garden-green-dark text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Grow Your Marketing the Easy Way?
          </h2>
          
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of garden centers already growing with our platform
          </p>
          
          <Button 
            onClick={handleGetStarted}
            className="bg-warning-500 hover:bg-warning-600 text-warning-foreground px-12 py-4 text-xl rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group mb-4"
          >
            Start Your First Campaign
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          
          <p className="text-sm opacity-75">
            No credit card required. Just a few simple questions to get started.
          </p>
          
          <div className="mt-8 flex justify-center items-center space-x-8 text-sm opacity-75">
            <span className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-2" />
              3-minute setup
            </span>
            <span className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-2" />
              Expert support
            </span>
            <span className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-2" />
              Cancel anytime
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
