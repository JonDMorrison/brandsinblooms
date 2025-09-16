import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingPageHeader } from '@/components/landing/LandingPageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Target, Smartphone, Users, TrendingUp, Heart, Brain } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, EffectCoverflow } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-coverflow';

export const Home1Page = () => {
  console.log('🏠 Home1Page: Component rendering...');
  
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(2); // Start with slide 3 (index 2) in center

  console.log('🏠 Home1Page: Current slide:', currentSlide);

  const slides = [
    {
      id: 1,
      title: "Nutrition Tracking",
      description: "Track your calories, macros, and nutrients effortlessly",
      icon: BarChart3,
      gradient: "from-blue-50 to-indigo-50",
      iconBg: "bg-blue-500/20",
      iconColor: "text-blue-600"
    },
    {
      id: 2,
      title: "Personalized Goals",
      description: "Set and achieve your health goals with AI guidance",
      icon: Target,
      gradient: "from-green-50 to-emerald-50",
      iconBg: "bg-green-500/20",
      iconColor: "text-green-600"
    },
    {
      id: 3,
      title: "AI Assistant",
      description: "Get intelligent recommendations and insights",
      icon: Brain,
      gradient: "from-purple-50 to-violet-50",
      iconBg: "bg-purple-500/20",
      iconColor: "text-purple-600"
    },
    {
      id: 4,
      title: "Progress Tracking",
      description: "Monitor your health journey with detailed analytics",
      icon: TrendingUp,
      gradient: "from-orange-50 to-amber-50",
      iconBg: "bg-orange-500/20",
      iconColor: "text-orange-600"
    },
    {
      id: 5,
      title: "Wellness Community",
      description: "Connect with others on their health journey",
      icon: Heart,
      gradient: "from-pink-50 to-rose-50",
      iconBg: "bg-pink-500/20",
      iconColor: "text-pink-600"
    }
  ];

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

      {/* Material You Style Slider Section */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Powerful Features</h2>
            <p className="text-gray-300 text-lg">Everything you need to transform your nutrition habits</p>
          </div>
          
          <Swiper
            modules={[Navigation, Pagination]}
            grabCursor={true}
            centeredSlides={true}
            slidesPerView={2.2}
            spaceBetween={16}
            initialSlide={2}
            pagination={{
              clickable: true,
              bulletClass: 'swiper-pagination-bullet !w-2 !h-2 !bg-white/30 !opacity-100 !rounded-full',
              bulletActiveClass: 'swiper-pagination-bullet-active !bg-primary !w-6 !rounded-full',
              dynamicBullets: true,
            }}
            onSlideChange={(swiper) => setCurrentSlide(swiper.activeIndex)}
            breakpoints={{
              320: {
                slidesPerView: 1.2,
                spaceBetween: 12,
              },
              640: {
                slidesPerView: 1.8,
                spaceBetween: 14,
              },
              768: {
                slidesPerView: 2.2,
                spaceBetween: 16,
              },
              1024: {
                slidesPerView: 2.5,
                spaceBetween: 20,
              },
            }}
            className="!pb-16 material-you-slider"
          >
            {slides.map((slide, index) => {
              const Icon = slide.icon;
              const isActive = index === currentSlide;
              
              // Define proper gradients for each slide
              const getGradientClasses = (slideId: number) => {
                switch(slideId) {
                  case 1: return "from-blue-800 to-blue-900";
                  case 2: return "from-green-800 to-green-900"; 
                  case 3: return "from-purple-800 to-purple-900";
                  case 4: return "from-orange-800 to-orange-900";
                  case 5: return "from-pink-800 to-pink-900";
                  default: return "from-gray-800 to-gray-900";
                }
              };
              
              return (
                <SwiperSlide key={slide.id} className="!h-auto">
                  <div className={`
                    relative overflow-hidden rounded-3xl aspect-[3/4] 
                    transition-all duration-500 ease-out
                    ${isActive ? 'scale-105' : 'scale-95 opacity-70'}
                  `}>
                    {/* Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${getGradientClasses(slide.id)} opacity-90`} />
                    
                    {/* Content */}
                    <div className="relative z-10 h-full flex flex-col justify-between p-8 text-white">
                      <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6">
                        <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                          <Icon className="w-10 h-10 text-white" />
                        </div>
                        <div className="space-y-3">
                          <h3 className="text-2xl font-bold leading-tight">{slide.title}</h3>
                          <p className="text-white/80 text-sm leading-relaxed px-2">{slide.description}</p>
                        </div>
                      </div>
                      
                      {/* Bottom accent */}
                      <div className="flex justify-center mt-6">
                        <div className="w-12 h-1 bg-white/30 rounded-full">
                          <div className="w-6 h-1 bg-white rounded-full"></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Material You inspired overlay pattern */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                    
                    {/* Slide label */}
                    <div className="absolute top-4 left-4 bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full">
                      <span className="text-white/90 text-xs font-medium">Feature {index + 1}</span>
                    </div>
                  </div>
                </SwiperSlide>
              );
            })}
          </Swiper>
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