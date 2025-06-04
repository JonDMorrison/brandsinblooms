
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Users, Edit, TrendingUp, Star, ArrowRight, Building, Leaf, Sun } from "lucide-react";

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
      <section className="relative px-4 py-24 text-center max-w-6xl mx-auto">
        <div className="absolute top-10 left-10 text-6xl opacity-20">🌱</div>
        <div className="absolute top-20 right-20 text-4xl opacity-30">☀️</div>
        <div className="absolute bottom-10 left-1/4 text-3xl opacity-25">🌿</div>
        
        <h1 className="text-5xl md:text-6xl font-bold text-garden-green-dark mb-6 leading-tight">
          Grow Your Garden Center
          <span className="text-garden-green block mt-2">With Less Effort</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-700 mb-10 max-w-4xl mx-auto leading-relaxed">
          Launch ready-to-go campaigns, connect with your customers, and grow sales — no tech skills required.
        </p>
        
        <Button 
          onClick={handleGetStarted}
          className="bg-warning-500 hover:bg-warning-600 text-warning-foreground px-12 py-4 text-xl rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group mb-4"
        >
          Start in 3 Minutes
          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </Button>
        
        <p className="text-sm text-gray-600 mb-16">
          Takes less than 5 minutes • No credit card required
        </p>
        
        {/* App Preview */}
        <div className="mt-16 relative">
          <div className="w-full h-80 bg-gradient-to-r from-green-50 to-yellow-50 rounded-2xl shadow-2xl border border-green-100 flex flex-col items-center justify-center p-8">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-2xl font-semibold text-garden-green-dark mb-2">Campaign Calendar</h3>
            <p className="text-gray-600 text-center max-w-md">See your seasonal campaigns, track performance, and never miss an opportunity</p>
          </div>
          <div className="absolute -top-4 -right-4 bg-white p-4 rounded-xl shadow-lg border border-green-100">
            <div className="text-sm font-medium text-blue-700">Setup in 3 Minutes</div>
          </div>
        </div>
      </section>

      {/* Value Icons Section */}
      <section className="py-16 px-4 bg-white/60">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 text-center">
            <div className="group cursor-default">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <Sun className="h-10 w-10 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-garden-green-dark mb-2">Pre-written Campaigns</h3>
              <p className="text-gray-600 text-sm">Ready for every season</p>
            </div>

            <div className="group cursor-default">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <Leaf className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-garden-green-dark mb-2">Personalized Content</h3>
              <p className="text-gray-600 text-sm">Matches your unique voice</p>
            </div>

            <div className="group cursor-default">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <Building className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-garden-green-dark mb-2">Professional Support</h3>
              <p className="text-gray-600 text-sm">Expert guidance included</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-20 text-garden-green-dark">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-12">
            <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 relative">
              <CardContent className="pt-6">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-primary-600" />
                </div>
                <div className="text-sm font-medium text-primary-600 mb-2">Save Time</div>
                <h3 className="text-xl font-semibold mb-4 text-garden-green-dark">
                  Choose Your Campaign
                </h3>
                <p className="text-gray-600">
                  Pick from professionally written templates tailored for garden centers and your calendar.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 relative">
              <CardContent className="pt-6">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-warning-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div className="w-16 h-16 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Edit className="h-8 w-8 text-warning-600" />
                </div>
                <div className="text-sm font-medium text-warning-600 mb-2">Stay On Brand</div>
                <h3 className="text-xl font-semibold mb-4 text-garden-green-dark">
                  Personalize It
                </h3>
                <p className="text-gray-600">
                  Upload your photos and tweak the content to match your unique style and voice.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 relative">
              <CardContent className="pt-6">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <div className="w-16 h-16 bg-accent-blue/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
                <div className="text-sm font-medium text-blue-600 mb-2">Reach More Customers</div>
                <h3 className="text-xl font-semibold mb-4 text-garden-green-dark">
                  Publish & Track
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
      <section className="py-24 px-4 bg-white/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-garden-green-dark">
              We've Thought of Everything You Need
            </h2>
            <p className="text-xl text-gray-600">No stress, no guesswork — campaigns built for your calendar</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardContent className="pt-4">
                <div className="text-4xl mb-6">📅</div>
                <h3 className="text-xl font-semibold mb-3 text-garden-green-dark">
                  Pre-written Seasonal Campaigns
                </h3>
                <p className="text-gray-600 mb-2">
                  Spring sales, holiday promotions, and summer workshops — all ready to go.
                </p>
                <p className="text-sm text-gray-500">
                  Perfect timing for every season and event
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardContent className="pt-4">
                <div className="text-4xl mb-6">🎯</div>
                <h3 className="text-xl font-semibold mb-3 text-garden-green-dark">
                  Content Tailored to Your Voice
                </h3>
                <p className="text-gray-600 mb-2">
                  We learn your style and create content that sounds authentically you.
                </p>
                <p className="text-sm text-gray-500">
                  Your customers will recognize your unique personality
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardContent className="pt-4">
                <div className="text-4xl mb-6">📱</div>
                <h3 className="text-xl font-semibold mb-3 text-garden-green-dark">
                  One-click Publishing
                </h3>
                <p className="text-gray-600 mb-2">
                  Post to Instagram, Facebook, email, and your website all at once.
                </p>
                <p className="text-sm text-gray-500">
                  Reach your customers wherever they are
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardContent className="pt-4">
                <div className="text-4xl mb-6">⚡</div>
                <h3 className="text-xl font-semibold mb-3 text-garden-green-dark">
                  Simple Setup
                </h3>
                <p className="text-gray-600 mb-2">
                  No tech experience needed. Get started in minutes, not hours.
                </p>
                <p className="text-sm text-gray-500">
                  Designed for busy garden center owners
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-garden-green-dark">
              Trusted by Garden Centers Across Canada
            </h2>
            <p className="text-xl text-gray-600">Why 100+ garden centers choose Green Thumb Marketing</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 relative hover:shadow-xl transition-all duration-300">
              <CardContent className="pt-4">
                <div className="flex mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 italic text-lg leading-relaxed">
                  "This saved us hours every week. We finally look professional online and our customers notice the difference."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                    L
                  </div>
                  <div>
                    <div className="font-semibold text-garden-green-dark">Linda Chen</div>
                    <div className="text-sm text-gray-600">Owner, Maple Grove Greenhouse</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="p-8 relative hover:shadow-xl transition-all duration-300">
              <CardContent className="pt-4">
                <div className="flex mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 italic text-lg leading-relaxed">
                  "We posted our Spring campaign and sold out of everything in three days. Best investment we've made."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                    C
                  </div>
                  <div>
                    <div className="font-semibold text-garden-green-dark">Carlos Rodriguez</div>
                    <div className="text-sm text-gray-600">Manager, Bloom Market Garden Center</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="p-8 relative hover:shadow-xl transition-all duration-300">
              <CardContent className="pt-4">
                <div className="flex mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 italic text-lg leading-relaxed">
                  "The seasonal content is perfect. It's like having a marketing expert on our team without the cost."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                    M
                  </div>
                  <div>
                    <div className="font-semibold text-garden-green-dark">Maria Thompson</div>
                    <div className="text-sm text-gray-600">Owner, Sunshine Nursery & Garden</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-4 bg-gradient-to-r from-garden-green to-garden-green-dark text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Grow Your Marketing the Easy Way?
          </h2>
          
          <p className="text-xl mb-10 opacity-90">
            Join hundreds of garden centers already growing with our platform
          </p>
          
          <Button 
            onClick={handleGetStarted}
            className="bg-warning-500 hover:bg-warning-600 text-warning-foreground px-12 py-4 text-xl rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group mb-6"
          >
            Get Instant Access
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          
          <p className="text-sm opacity-75 mb-8">
            No credit card required • Takes less than 5 minutes
          </p>
          
          <div className="flex justify-center items-center space-x-8 text-sm opacity-75">
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
