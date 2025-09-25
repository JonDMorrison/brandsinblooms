import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, GraduationCap, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DifferentiatorsSectionProps {
  onTalkToTeam?: () => void;
  showCTA?: boolean;
}

export const DifferentiatorsSection = ({ 
  onTalkToTeam, 
  showCTA = true 
}: DifferentiatorsSectionProps) => {
  const navigate = useNavigate();
  
  const handleTalkToTeam = () => {
    if (onTalkToTeam) {
      onTalkToTeam();
    } else {
      navigate('/auth'); // Default to auth/signup page
    }
  };

  const differentiators = [
    {
      icon: MessageCircle,
      title: "Friendly Human Support",
      description: "Real people, not bots. Our support team knows horticulture and genuinely cares about helping garden center owners succeed. We're here when you need us — for technical help and marketing guidance."
    },
    {
      icon: GraduationCap,
      title: "Unlimited Training Courses",
      description: "Access our full library of step-by-step tutorials, workshops, and strategy courses. Learn how to use BloomSuite effectively and master modern marketing for your garden center — included with your subscription."
    },
    {
      icon: Users,
      title: "Garden Center Community",
      description: "Join a private network of garden center leaders who share ideas, swap strategies, and support one another. You'll never feel like you're figuring out marketing on your own."
    }
  ];

  return (
    <section className="relative py-20 px-6 overflow-hidden bg-gradient-to-br from-primary/8 via-background/95 to-brand-teal-mint/12">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-teal-mint/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header with enhanced styling */}
        <div className="text-center mb-16 animate-fade-in">
          <div className="inline-block px-6 py-2 bg-primary/10 rounded-full mb-6">
            <span className="text-primary font-semibold text-sm uppercase tracking-wide">Why Choose BloomSuite</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-accent via-primary to-brand-teal-mint bg-clip-text text-transparent mb-6 leading-tight">
            More than software —<br />
            <span className="text-primary">a partner for your success</span>
          </h2>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto leading-relaxed font-light">
            With BloomSuite, you don't just get an all-in-one marketing platform.<br />
            <span className="text-accent font-medium">You get a support team, training, and a community that understands your business.</span>
          </p>
        </div>

        {/* Three Differentiators with enhanced design */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 mb-16">
          {differentiators.map((item, index) => {
            const IconComponent = item.icon;
            
            return (
              <div 
                key={index}
                className="group animate-fade-in"
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <Card className="relative h-full bg-white/90 backdrop-blur-xl border-0 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-4 overflow-hidden">
                  {/* Animated gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-brand-teal-mint/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  {/* Top accent border */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-brand-teal-mint to-primary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                  
                  <CardContent className="p-10 text-center relative z-10 h-full flex flex-col">
                    {/* Enhanced icon with multiple layers */}
                    <div className="flex justify-center mb-8">
                      <div className="relative">
                        {/* Outer glow ring */}
                        <div className="absolute inset-0 bg-gradient-to-r from-primary to-brand-teal-mint rounded-3xl blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500 scale-150"></div>
                        
                        {/* Main icon container */}
                        <div className="relative bg-gradient-to-br from-primary via-primary to-brand-teal-mint p-6 rounded-3xl group-hover:scale-110 transition-all duration-500 shadow-2xl">
                          {/* Inner highlight */}
                          <div className="absolute inset-2 bg-gradient-to-br from-white/20 to-transparent rounded-2xl"></div>
                          <IconComponent className="w-10 h-10 text-white relative z-10 drop-shadow-lg" />
                        </div>
                        
                        {/* Animated rings */}
                        <div className="absolute inset-0 border-2 border-primary/20 rounded-3xl animate-ping opacity-0 group-hover:opacity-100"></div>
                      </div>
                    </div>
                    
                    {/* Enhanced title */}
                    <h3 className="text-2xl font-bold text-accent mb-6 group-hover:text-primary transition-colors duration-300 leading-tight">
                      {item.title}
                    </h3>
                    
                    {/* Enhanced description */}
                    <p className="text-muted-foreground leading-relaxed text-base flex-grow group-hover:text-accent/80 transition-colors duration-300">
                      {item.description}
                    </p>
                    
                    {/* Enhanced bottom accent with animation */}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
                      <div className="w-0 group-hover:w-24 h-1.5 bg-gradient-to-r from-primary to-brand-teal-mint transition-all duration-500 rounded-t-full"></div>
                      <div className="w-0 group-hover:w-16 h-0.5 bg-gradient-to-r from-brand-teal-mint to-primary transition-all duration-700 rounded-t-full mt-0.5"></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Enhanced CTA section */}
        {showCTA && (
          <div className="text-center animate-fade-in" style={{ animationDelay: '600ms' }}>
            <div className="relative inline-block">
              {/* Glow effect behind button */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-brand-teal-mint rounded-2xl blur-2xl opacity-30 scale-110"></div>
              
              <Button 
                onClick={handleTalkToTeam}
                size="lg"
                className="relative bg-gradient-to-r from-primary via-primary to-brand-teal-mint hover:from-brand-teal-mint hover:via-primary hover:to-primary text-white py-6 px-12 text-xl font-bold transition-all duration-500 hover:scale-105 shadow-2xl rounded-2xl border-2 border-white/20 backdrop-blur-sm group"
              >
                <MessageCircle className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform duration-300" />
                Talk to Our Team
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 rounded-2xl"></div>
              </Button>
            </div>
            
            <p className="text-lg text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed">
              Schedule a personalized demo and discover how BloomSuite can transform your garden center marketing
            </p>
          </div>
        )}
      </div>
    </section>
  );
};