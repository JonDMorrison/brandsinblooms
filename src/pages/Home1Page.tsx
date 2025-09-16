import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingPageHeader } from '@/components/landing/LandingPageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Target, Smartphone, Users, TrendingUp, Heart, Brain } from 'lucide-react';

export const Home1Page = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      <LandingPageHeader onLogin={handleLogin} />
      
      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                A Simplified Way to Start{' '}
                <span className="text-primary">Losing Weight.</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-lg">
                Track your calories and protein intake with NutriBot. That's it.
              </p>
              <div className="flex items-center gap-4 pt-4">
                <Button 
                  onClick={() => navigate('/auth')}
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-lg rounded-full"
                >
                  Try NutriBot
                </Button>
              </div>
              <div className="flex items-center gap-6 pt-6">
                <div className="text-sm text-muted-foreground">Features:</div>
                <Badge variant="secondary" className="text-xs">Nutrition</Badge>
                <Badge variant="secondary" className="text-xs">Healthy Food</Badge>
                <Badge variant="secondary" className="text-xs">Consultation</Badge>
                <Badge variant="secondary" className="text-xs">AI Bot</Badge>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-3xl p-8 aspect-[9/16] flex items-center justify-center">
                <div className="w-64 h-80 bg-white rounded-2xl shadow-xl p-4 flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <Smartphone className="w-16 h-16 text-primary mx-auto" />
                    <p className="text-sm text-muted-foreground">App Interface Mockup</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Slider Section */}
      <section className="py-16 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="relative overflow-hidden">
            <div className="flex transition-transform duration-500 ease-in-out">
              {/* Slide 1 */}
              <div className="w-full flex-shrink-0 px-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-12 h-96 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <BarChart3 className="w-10 h-10 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">Nutrition Tracking</h3>
                  <p className="text-muted-foreground max-w-md">Track your calories, macros, and nutrients effortlessly</p>
                </div>
              </div>
              
              {/* Slide 2 */}
              <div className="w-full flex-shrink-0 px-4">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-12 h-96 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                    <Target className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">Personalized Goals</h3>
                  <p className="text-muted-foreground max-w-md">Set and achieve your health goals with AI guidance</p>
                </div>
              </div>
              
              {/* Slide 3 - Center/Active */}
              <div className="w-full flex-shrink-0 px-4">
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-3xl p-12 h-96 flex flex-col items-center justify-center text-center space-y-6 ring-2 ring-primary/20">
                  <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center">
                    <Brain className="w-10 h-10 text-purple-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">AI Assistant</h3>
                  <p className="text-muted-foreground max-w-md">Get intelligent recommendations and insights</p>
                </div>
              </div>
              
              {/* Slide 4 */}
              <div className="w-full flex-shrink-0 px-4">
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-3xl p-12 h-96 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-10 h-10 text-orange-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">Progress Tracking</h3>
                  <p className="text-muted-foreground max-w-md">Monitor your health journey with detailed analytics</p>
                </div>
              </div>
              
              {/* Slide 5 */}
              <div className="w-full flex-shrink-0 px-4">
                <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-3xl p-12 h-96 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 bg-pink-500/20 rounded-full flex items-center justify-center">
                    <Heart className="w-10 h-10 text-pink-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">Wellness Community</h3>
                  <p className="text-muted-foreground max-w-md">Connect with others on their health journey</p>
                </div>
              </div>
            </div>
            
            {/* Partial visibility effect - showing 35% of side slides */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Left fade overlay to hide 65% of left side */}
              <div className="absolute left-0 top-0 w-[65%] h-full bg-gradient-to-r from-muted/30 to-transparent z-10"></div>
              {/* Right fade overlay to hide 65% of right side */}
              <div className="absolute right-0 top-0 w-[65%] h-full bg-gradient-to-l from-muted/30 to-transparent z-10"></div>
            </div>

            {/* Navigation dots */}
            <div className="flex justify-center space-x-2 mt-8">
              <button className="w-3 h-3 rounded-full bg-muted-foreground/30"></button>
              <button className="w-3 h-3 rounded-full bg-muted-foreground/30"></button>
              <button className="w-3 h-3 rounded-full bg-primary"></button>
              <button className="w-3 h-3 rounded-full bg-muted-foreground/30"></button>
              <button className="w-3 h-3 rounded-full bg-muted-foreground/30"></button>
            </div>
          </div>
        </div>
      </section>

      {/* AI-Powered Assistant Section */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <Card className="p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardContent className="p-0 text-center space-y-6">
                  <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <Users className="w-12 h-12 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">AI Assistant Interface</h3>
                  <p className="text-muted-foreground">
                    Your personal nutrition coach powered by advanced AI
                  </p>
                  <div className="space-y-2">
                    <Badge className="text-xs">AI-Powered Coaching</Badge>
                    <Badge className="text-xs ml-2">Community & Support</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm">
                Essential AI NutriBot
              </div>
              <h2 className="text-4xl font-bold text-foreground">
                Not Harder Your <span className="text-primary">AI-Powered</span>{' '}
                Nutrition Assistant
              </h2>
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                  <BarChart3 className="w-4 h-4" />
                  Data-Driven Insights
                </div>
                <p className="text-lg text-muted-foreground">
                  It Effortlessly reach your health goals with AI that simplifies tracking and meal planning, allowing 
                  you to focus on progress.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-sm">AI-Powered Coaching</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-sm">Community & Support</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile App Preview Section */}
      <section className="py-16 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-12">
            Effortless <span className="text-primary">Nutrition Tracking</span>,{' '}
            Tailored for You
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-6">
              <CardContent className="p-0 space-y-4">
                <div className="w-full h-40 bg-gradient-to-br from-green-50 to-green-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-16 h-16 text-primary" />
                </div>
                <h3 className="font-semibold">Data-Driven Insights</h3>
                <p className="text-sm text-muted-foreground">
                  Get comprehensive analysis of your nutrition patterns
                </p>
              </CardContent>
            </Card>
            <Card className="p-6 bg-primary text-primary-foreground">
              <CardContent className="p-0 space-y-4">
                <div className="w-full h-40 bg-white/10 rounded-lg flex items-center justify-center">
                  <Smartphone className="w-16 h-16" />
                </div>
                <h3 className="font-semibold">Get Instant Insights On Calories, Macros, And Nutrients</h3>
                <p className="text-sm opacity-90">
                  Real-time tracking and analysis of your daily nutrition
                </p>
              </CardContent>
            </Card>
            <Card className="p-6">
              <CardContent className="p-0 space-y-4">
                <div className="w-full h-40 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex items-center justify-center">
                  <Heart className="w-16 h-16 text-orange-500" />
                </div>
                <h3 className="font-semibold">Not Harder Your AI-Powered Nutrition Assistant</h3>
                <p className="text-sm text-muted-foreground">
                  AI-powered recommendations tailored to your goals
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-2 rounded-full text-sm mb-6">
            Ready to Start Your Health Journey
          </div>
          <h2 className="text-4xl font-bold text-foreground mb-6">
            Your Health Journey Starts Now
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of users who have transformed their nutrition habits with our AI-powered platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate('/auth')}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-lg rounded-full"
            >
              Start Your Journey
            </Button>
            <Button 
              onClick={() => navigate('/about')}
              variant="outline"
              size="lg"
              className="border-primary text-primary hover:bg-primary/10 px-8 py-3 text-lg rounded-full"
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};