import React from 'react';
import { LandingPageHeader } from '@/components/landing/LandingPageHeader';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Share2, 
  Users, 
  Database, 
  Sparkles, 
  Globe, 
  BarChart3, 
  MessageSquare,
  Mail,
  Smartphone,
  Target,
  Clock,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

export const FeaturesPage = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate('/auth');
  };

  const mainFeatures = [
    {
      icon: Calendar,
      title: "Plan All Your Marketing",
      description: "Never miss a seasonal opportunity with our intelligent marketing calendar designed specifically for garden centers.",
      features: [
        "Seasonal content calendar with plant-specific timing",
        "Automated campaign suggestions based on weather and seasons",
        "Inventory-synced promotional planning",
        "Holiday and gardening event integration",
        "Team collaboration and approval workflows"
      ],
      gradient: "from-green-500 to-emerald-600"
    },
    {
      icon: Share2,
      title: "Post Direct To Social",
      description: "Manage all your social media platforms from one place with AI-powered content creation.",
      features: [
        "Multi-platform posting (Facebook, Instagram, Twitter, LinkedIn)",
        "Optimal timing based on your audience engagement",
        "Auto-generated captions with plant care tips",
        "Visual content library with seasonal templates",
        "Hashtag optimization for garden center audience"
      ],
      gradient: "from-blue-500 to-cyan-600"
    },
    {
      icon: Users,
      title: "Customer Personas & Segments",
      description: "Understand your customers better with detailed personas and smart segmentation tools.",
      features: [
        "Automatic customer segmentation by purchase history",
        "Seasonal shopper behavior analysis",
        "Plant preference tracking and recommendations",
        "Geographic and demographic insights",
        "Custom persona creation with AI assistance"
      ],
      gradient: "from-purple-500 to-indigo-600"
    },
    {
      icon: Database,
      title: "The Only CRM Built For Garden Centers",
      description: "Customer relationship management designed around plants, seasons, and garden center workflows.",
      features: [
        "Plant purchase history and care reminders",
        "Seasonal customer journey mapping",
        "Loyalty program integration",
        "Workshop and event attendance tracking",
        "Personalized plant recommendations"
      ],
      gradient: "from-orange-500 to-red-600"
    },
    {
      icon: Sparkles,
      title: "Instant Social, Newsletter and Blog Content",
      description: "AI-powered content generation that understands gardening and your local market.",
      features: [
        "Plant care tips and seasonal advice generation",
        "Local weather-based content suggestions",
        "Product highlight posts with care instructions",
        "Educational blog post creation",
        "Email newsletter templates for each season"
      ],
      gradient: "from-pink-500 to-rose-600"
    },
    {
      icon: Globe,
      title: "Coming Soon: Build And Manage Your Website In Minutes",
      description: "Professional garden center websites with integrated e-commerce and inventory management.",
      features: [
        "Garden center-specific website templates",
        "Integrated plant care guides and blogs",
        "E-commerce with seasonal product catalogs",
        "Workshop and event booking system",
        "Mobile-optimized plant identification tools"
      ],
      gradient: "from-teal-500 to-green-600",
      comingSoon: true
    }
  ];

  const additionalFeatures = [
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Track ROI, customer lifetime value, and seasonal performance metrics."
    },
    {
      icon: MessageSquare,
      title: "SMS Marketing",
      description: "Send timely plant care reminders and seasonal promotions via text."
    },
    {
      icon: Mail,
      title: "Email Automation",
      description: "Nurture leads with educational content and personalized recommendations."
    },
    {
      icon: Smartphone,
      title: "Mobile App",
      description: "Manage your marketing on-the-go with our mobile application."
    },
    {
      icon: Target,
      title: "Lead Generation",
      description: "Capture and convert more leads with garden center-specific forms."
    },
    {
      icon: Clock,
      title: "Automation Workflows",
      description: "Set up complex marketing sequences that run automatically."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <LandingPageHeader onLogin={handleLogin} showUserMenu={false} />
      
      {/* Hero Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-green-50 to-blue-50">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-foreground mb-6">
            Everything Your Garden Center Needs to Thrive
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            From marketing automation to customer management, BloomSuite provides all the tools you need to grow your business and nurture customer relationships.
          </p>
          <Button 
            onClick={() => navigate('/auth')}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-lg"
          >
            Start Free Trial
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Main Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">Core Features</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Six powerful modules designed specifically for garden centers and nurseries
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {mainFeatures.map((feature, index) => (
              <Card key={index} className="relative overflow-hidden group hover:shadow-xl transition-shadow">
                {feature.comingSoon && (
                  <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium z-10">
                    Coming Soon
                  </div>
                )}
                <CardHeader className="pb-4">
                  <div className={`w-16 h-16 rounded-lg bg-gradient-to-r ${feature.gradient} flex items-center justify-center mb-4`}>
                    <feature.icon className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl mb-3">{feature.title}</CardTitle>
                  <p className="text-muted-foreground text-lg">{feature.description}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {feature.features.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Features Section */}
      <section className="py-16 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Additional Features</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Even more tools to help you succeed in every aspect of your garden center marketing
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {additionalFeatures.map((feature, index) => (
              <Card key={index} className="p-6 text-center hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Why Garden Centers Choose BloomSuite</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              See the results that matter most to your business
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 text-center bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardContent className="p-0">
                <div className="text-4xl font-bold text-primary mb-2">40%</div>
                <div className="text-lg font-semibold text-foreground mb-2">Increase in Sales</div>
                <p className="text-muted-foreground">Average sales growth within the first year</p>
              </CardContent>
            </Card>

            <Card className="p-8 text-center bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
              <CardContent className="p-0">
                <div className="text-4xl font-bold text-primary mb-2">75%</div>
                <div className="text-lg font-semibold text-foreground mb-2">Time Saved</div>
                <p className="text-muted-foreground">Less time spent on marketing tasks</p>
              </CardContent>
            </Card>

            <Card className="p-8 text-center bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
              <CardContent className="p-0">
                <div className="text-4xl font-bold text-primary mb-2">3x</div>
                <div className="text-lg font-semibold text-foreground mb-2">Better Engagement</div>
                <p className="text-muted-foreground">Higher customer engagement rates</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-foreground mb-6">
            Ready to Transform Your Garden Center Marketing?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join hundreds of garden centers already using BloomSuite to grow their business. 
            Start your free trial today and see the difference specialized tools can make.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate('/auth')}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-lg"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              onClick={() => navigate('/pricing')}
              variant="outline"
              size="lg"
              className="border-primary text-primary hover:bg-primary/10 px-8 py-3 text-lg"
            >
              View Pricing
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};