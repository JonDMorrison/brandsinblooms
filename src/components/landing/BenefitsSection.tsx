
import { Card, CardContent } from "@/components/ui/card";
import { LandingPageIcon } from "./LandingPageIcon";
import { Calendar, Sparkles, FileText, Megaphone, Zap, CheckCircle } from "lucide-react";

export const BenefitsSection = () => {
  const benefits = [
    {
      icon: Calendar,
      title: "Weekly Content Engine",
      description: "Fresh, seasonally-perfect content delivered every week, automatically timed for your garden center's peak moments.",
      theme: "spring" as const
    },
    {
      icon: Sparkles,
      title: "Brand Voice Mastery",
      description: "Our AI learns your unique tone and personality, creating content that sounds authentically you, every single time.",
      theme: "summer" as const
    },
    {
      icon: FileText,
      title: "Infinitely Customizable",
      description: "Every piece of content is fully editable. Tweak, personalize, and make it perfect for your specific audience.",
      theme: "autumn" as const
    },
    {
      icon: Megaphone,
      title: "All-Platform Publishing",
      description: "Seamlessly distribute to social media, send newsletters, and update your website — all from one beautiful dashboard.",
      theme: "winter" as const
    },
    {
      icon: Zap,
      title: "Lightning-Fast Setup",
      description: "Get started in under 60 seconds. No complicated onboarding, no technical knowledge required.",
      theme: "spring" as const
    },
    {
      icon: CheckCircle,
      title: "Garden Center Expertise",
      description: "Industry-specific templates, seasonal strategies, and content designed exclusively for plant and garden businesses.",
      theme: "neutral" as const
    }
  ];

  return (
    <section className="py-24 px-6 bg-gradient-to-b from-white to-garden-background/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20 apple-section-spacing">
          <h2 className="text-4xl font-bold mb-6 text-black apple-headline-large">
            Everything You Need to Grow
          </h2>
          <p className="text-xl text-gray-600 apple-body-enhanced max-w-3xl mx-auto">
            Transform your marketing without hiring a full team. Get professional results with tools designed specifically for garden centers.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <Card 
              key={index}
              className="apple-fade-in-stagger card-interactive p-10 rounded-3xl bg-white border-2 border-gray-100 hover:border-garden-green/20 apple-warm-neutral shadow-sm hover:shadow-2xl group"
              style={{animationDelay: `${index * 0.1}s`}}
            >
              <CardContent className="pt-6 apple-card-spacing">
                <div className="flex items-start gap-6 mb-6">
                  <LandingPageIcon 
                    icon={benefit.icon} 
                    variant="feature" 
                    theme={benefit.theme}
                    animated={true}
                    containerClassName="apple-icon-container apple-garden-icon"
                  />
                  <div className="flex-1">
                    <h3 className="text-2xl font-semibold text-black mb-3 apple-headline-medium">
                      {benefit.title}
                    </h3>
                  </div>
                </div>
                <p className="text-lg text-gray-600 leading-relaxed apple-body-enhanced">
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
