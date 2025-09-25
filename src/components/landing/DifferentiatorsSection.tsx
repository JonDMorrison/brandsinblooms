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
    <section className="py-16 px-6 bg-gradient-to-br from-primary/5 via-background/50 to-brand-teal-mint/10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-accent mb-4">
            More than software — a partner for your success
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
            With BloomSuite, you don't just get an all-in-one marketing platform. 
            You get a support team, training, and a community that understands your business.
          </p>
        </div>

        {/* Three Differentiators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {differentiators.map((item, index) => {
            const IconComponent = item.icon;
            
            return (
              <Card 
                key={index}
                className="bg-white/95 backdrop-blur-sm border border-primary/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 group relative overflow-hidden"
              >
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <CardContent className="p-8 text-center relative z-10">
                  {/* Icon */}
                  <div className="flex justify-center mb-6">
                    <div className="bg-gradient-to-r from-primary to-brand-teal-mint p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-lg">
                      <IconComponent className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-xl font-bold text-accent mb-4 group-hover:text-primary transition-colors duration-300">
                    {item.title}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-muted-foreground leading-relaxed text-sm">
                    {item.description}
                  </p>
                  
                  {/* Bottom accent line */}
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0 group-hover:w-16 h-1 bg-gradient-to-r from-primary to-brand-teal-mint transition-all duration-300 rounded-t-full" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* CTA Button */}
        {showCTA && (
          <div className="text-center">
            <Button 
              onClick={handleTalkToTeam}
              size="lg"
              className="bg-gradient-to-r from-primary to-brand-teal-mint hover:from-brand-teal-mint hover:to-primary text-white py-3 px-8 text-lg font-semibold transition-all duration-300 hover:scale-105 shadow-lg rounded-xl"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Talk to Our Team
            </Button>
            
            <p className="text-sm text-muted-foreground mt-4">
              Schedule a personalized demo and discover how BloomSuite can transform your garden center marketing
            </p>
          </div>
        )}
      </div>
    </section>
  );
};