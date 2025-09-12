import React from 'react';
import { LandingPageHeader } from '@/components/landing/LandingPageHeader';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Leaf, Users, Target, TrendingUp, Heart, Award, Sprout } from 'lucide-react';
import brandInBloomsImage from '@/assets/brands-in-blooms-jon-and-jeff.jpg';

export const AboutPage = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate('/auth');
  };

  const values = [
    {
      icon: Sprout,
      title: "Growth-Focused",
      description: "We believe every garden center has the potential to bloom into something extraordinary."
    },
    {
      icon: Heart,
      title: "Passionate About Plants",
      description: "Our love for gardening drives everything we do, from product features to customer support."
    },
    {
      icon: Users,
      title: "Community-Driven",
      description: "Garden centers are the heart of gardening communities, and we're here to help strengthen those bonds."
    },
    {
      icon: Award,
      title: "Excellence in Service",
      description: "We're committed to providing the highest quality tools and support for your business success."
    }
  ];

  const team = [
    {
      role: "Marketing Expertise",
      description: "Our team includes seasoned digital marketing professionals who understand the unique challenges of seasonal retail businesses."
    },
    {
      role: "Horticulture Knowledge",
      description: "We work with gardening experts who understand plant cycles, seasonal trends, and customer buying patterns."
    },
    {
      role: "Technology Innovation",
      description: "Our developers are constantly improving our AI-powered tools to better serve the garden center industry."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <LandingPageHeader onLogin={handleLogin} showUserMenu={false} />
      
      {/* Hero Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-green-50 to-blue-50">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-foreground mb-6">
            Growing Garden Centers Through Smart Marketing
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            BloomSuite was born from a simple belief: garden centers deserve marketing tools as specialized and nurturing as the plants they sell.
          </p>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-foreground mb-6">Our Story</h2>
              <div className="space-y-4 text-lg text-muted-foreground">
                <p>
                  After years of working with garden centers across the country, we noticed a pattern: 
                  these amazing businesses were struggling with marketing tools that just weren't built 
                  for their industry.
                </p>
                <p>
                  Generic marketing platforms couldn't understand seasonal inventory cycles, customer 
                  planting schedules, or the unique relationship garden centers have with their communities. 
                  That's when we decided to build something different.
                </p>
                <p>
                  BloomSuite is the result of countless conversations with garden center owners, 
                  studying industry trends, and understanding the specific challenges of marketing 
                  plants, soil, tools, and seasonal products.
                </p>
              </div>
            </div>
            <div className="relative">
              <Card className="p-8 bg-gradient-to-br from-green-100 to-blue-100 border-none">
                <CardContent className="p-0">
                  <div className="text-center">
                    <img 
                      src={brandInBloomsImage} 
                      alt="Brands In Blooms Jon And Jeff" 
                      className="w-full h-48 object-cover rounded-lg mb-4"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Why Garden Centers Section */}
      <section className="py-16 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-6">Why We Focus on Garden Centers</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Garden centers aren't just retail stores—they're community hubs, education centers, 
              and guardians of local ecosystems. They deserve specialized tools.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 text-center">
              <CardContent className="p-0">
                <Target className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-3">Seasonal Expertise</h3>
                <p className="text-muted-foreground">
                  We understand planting seasons, holiday rushes, and inventory cycles that generic 
                  platforms miss.
                </p>
              </CardContent>
            </Card>

            <Card className="p-6 text-center">
              <CardContent className="p-0">
                <Users className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-3">Community Focus</h3>
                <p className="text-muted-foreground">
                  Garden centers build communities around growing. Our tools help strengthen 
                  those relationships.
                </p>
              </CardContent>
            </Card>

            <Card className="p-6 text-center">
              <CardContent className="p-0">
                <TrendingUp className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-3">Proven Results</h3>
                <p className="text-muted-foreground">
                  Garden centers using BloomSuite see an average 40% increase in customer 
                  engagement and sales.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Our Values Section */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-6">Our Values</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              These principles guide everything we build and every relationship we nurture.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <Card key={index} className="p-6 text-center hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <value.icon className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-foreground mb-3">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Our Team Section */}
      <section className="py-16 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-6">Our Team</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              A diverse group of marketing experts, horticulturists, and technology innovators 
              united by a passion for helping garden centers thrive.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {team.map((member, index) => (
              <Card key={index} className="p-6">
                <CardContent className="p-0">
                  <h3 className="text-lg font-bold text-foreground mb-3">{member.role}</h3>
                  <p className="text-muted-foreground">{member.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-foreground mb-6">
            Ready to Grow Your Garden Center?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join hundreds of garden centers already using BloomSuite to create better customer 
            relationships and drive more sales.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate('/auth')}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-lg"
            >
              Start Your Free Trial
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