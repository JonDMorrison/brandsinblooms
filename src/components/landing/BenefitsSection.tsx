
import { Card, CardContent } from "@/components/ui/card";
import { LandingPageIcon } from "./LandingPageIcon";
import { Calendar, Sparkles, FileText, Megaphone, Zap, CheckCircle } from "lucide-react";

export const BenefitsSection = () => {
  const benefits = [
    {
      icon: Calendar,
      title: "Weekly Content Engine",
      description: "Fresh content delivered every week, perfectly timed for your garden center's seasonal needs.",
      theme: "spring" as const
    },
    {
      icon: Sparkles,
      title: "Brand Voice Matching",
      description: "AI learns your unique tone and style to create content that sounds authentically you.",
      theme: "summer" as const
    },
    {
      icon: FileText,
      title: "Fully Customizable",
      description: "Edit, tweak, and personalize every piece of content to match your exact needs.",
      theme: "autumn" as const
    },
    {
      icon: Megaphone,
      title: "All-in-One Distribution",
      description: "Post to social media, send newsletters, and update your website all from one place.",
      theme: "winter" as const
    },
    {
      icon: Zap,
      title: "Ridiculously Fast Setup",
      description: "Get started in under a minute. No complicated onboarding or technical setup required.",
      theme: "spring" as const
    },
    {
      icon: CheckCircle,
      title: "Built for Garden Centers",
      description: "Industry-specific templates and seasonal content designed specifically for garden centers.",
      theme: "neutral" as const
    }
  ];

  return (
    <section className="py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold text-center mb-16 text-black">
          Everything You Need to Grow Without Hiring a Marketing Team
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <Card 
              key={index}
              className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl bg-garden-sage border border-gray-200 group"
            >
              <CardContent className="pt-4">
                <div className="flex items-center gap-4 mb-4">
                  <LandingPageIcon 
                    icon={benefit.icon} 
                    variant="feature" 
                    theme={benefit.theme}
                    animated={true}
                  />
                  <h3 className="text-xl font-semibold text-black">
                    {benefit.title}
                  </h3>
                </div>
                <p className="text-base text-gray-600">
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
