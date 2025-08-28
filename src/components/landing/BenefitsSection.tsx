
import { Card, CardContent } from "@/components/ui/card";
import { LandingPageIcon } from "./LandingPageIcon";
import { Calendar, Sparkles, TrendingUp, Leaf, Clock, Star, Users, Zap, Globe } from "lucide-react";

export const BenefitsSection = () => {
  const benefits = [
    {
      icon: Sparkles,
      title: "AI Content Generation",
      description: "Create professional social media posts, email campaigns, and blog articles in seconds with AI that understands your garden center.",
      bg: "#E9F5EC",
      iconColor: "#47B881"
    },
    {
      icon: Users,
      title: "Customer Management (CRM)",
      description: "Track customer interactions, preferences, and purchase history. Build stronger relationships with personalized communication.",
      bg: "#FEF3C7",
      iconColor: "#F4C430"
    },
    {
      icon: Calendar,
      title: "Social Media Planning",
      description: "Plan, schedule, and manage all your social media content across platforms with our visual content calendar.",
      bg: "#FDF2F2",
      iconColor: "#F28C8C"
    },
    {
      icon: Zap,
      title: "Marketing Automation",
      description: "Set up automated email sequences, welcome series, and follow-up campaigns that nurture customers automatically.",
      bg: "#E0F2FE",
      iconColor: "#0EA5E9"
    },
    {
      icon: Globe,
      title: "Platform Integrations",
      description: "Connect with Facebook, Instagram, Mailchimp, and more. Manage everything from one central dashboard.",
      bg: "#F3E8FF",
      iconColor: "#8B5CF6"
    },
    {
      icon: TrendingUp,
      title: "Advanced Analytics",
      description: "Track campaign performance, customer engagement, ROI, and sales attribution with comprehensive reporting.",
      bg: "#FEF7ED",
      iconColor: "#EA580C"
    },
    {
      icon: Star,
      title: "Content Library",
      description: "Access hundreds of pre-made templates, seasonal campaigns, and plant care content ready to customize and use.",
      bg: "#E9F5EC",
      iconColor: "#47B881"
    },
    {
      icon: Leaf,
      title: "Email Marketing",
      description: "Create beautiful newsletters, promotional campaigns, and plant care tips that drive sales and customer loyalty.",
      bg: "#FEF3C7",
      iconColor: "#F4C430"
    },
    {
      icon: Clock,
      title: "Blog Management",
      description: "Generate SEO-optimized blog posts about plant care, seasonal gardening tips, and product spotlights to drive organic traffic.",
      bg: "#FDF2F2",
      iconColor: "#F28C8C"
    }
  ];

  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold mb-6 text-gray-900">
            What You Get: Everything to Dominate Your Market
          </h2>
          <p className="text-xl text-[#6B7280] max-w-3xl mx-auto">
            Stop paying for multiple tools. Get everything you need to attract customers, increase sales, and build loyalty — all in one platform.
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
