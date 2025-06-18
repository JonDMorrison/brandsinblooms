
import { Card, CardContent } from "@/components/ui/card";
import { LandingPageIcon } from "./LandingPageIcon";
import { Calendar, Sparkles, TrendingUp, Leaf, Clock, Star } from "lucide-react";

export const BenefitsSection = () => {
  const benefits = [
    {
      icon: Calendar,
      title: "Year-Round Content Planning",
      description: "Never run out of seasonal content ideas. Our AI creates marketing calendars that align with gardening seasons and holidays.",
      bg: "#E9F5EC",
      iconColor: "#47B881"
    },
    {
      icon: Sparkles,
      title: "Brand Voice Consistency",
      description: "All content matches your unique tone and style, maintaining brand consistency across every platform and campaign.",
      bg: "#FEF3C7",
      iconColor: "#F4C430"
    },
    {
      icon: TrendingUp,
      title: "Data-Driven Optimization",
      description: "Track what works best for your audience and automatically optimize future content for maximum engagement.",
      bg: "#FDF2F2",
      iconColor: "#F28C8C"
    },
    {
      icon: Leaf,
      title: "Plant Care Expertise Built-In",
      description: "Our AI understands gardening, so every piece of content includes valuable plant care tips and seasonal advice.",
      bg: "#E9F5EC",
      iconColor: "#47B881"
    },
    {
      icon: Clock,
      title: "Save 10+ Hours Weekly",
      description: "Automate your entire content creation process and focus on what you do best - helping customers grow amazing gardens.",
      bg: "#FEF3C7",
      iconColor: "#F4C430"
    },
    {
      icon: Star,
      title: "Multi-Platform Ready",
      description: "One campaign creates content for Facebook, Instagram, email newsletters, blogs, and more - all perfectly formatted.",
      bg: "#FDF2F2",
      iconColor: "#F28C8C"
    }
  ];

  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold mb-6 text-gray-900">
            Everything You Need to Grow Your Garden Center
          </h2>
          <p className="text-xl text-[#6B7280] max-w-3xl mx-auto">
            Professional marketing tools designed specifically for garden centers, nurseries, and plant retailers.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <Card 
              key={index} 
              className="apple-fade-in-stagger p-8 rounded-2xl border-2 hover:shadow-lg transition-all duration-300 group"
              style={{ 
                backgroundColor: benefit.bg,
                borderColor: `${benefit.iconColor}20`,
                animationDelay: `${index * 0.1}s`
              }}
            >
              <CardContent className="p-0">
                <div className="mb-6">
                  <LandingPageIcon 
                    icon={benefit.icon}
                    variant="section"
                    theme="neutral"
                    animated={true}
                    containerClassName="shadow-md"
                    style={{ 
                      backgroundColor: 'white',
                      borderColor: `${benefit.iconColor}30`,
                      color: benefit.iconColor
                    }}
                  />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-gray-900">
                  {benefit.title}
                </h3>
                <p className="text-[#6B7280] leading-relaxed">
                  {benefit.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
