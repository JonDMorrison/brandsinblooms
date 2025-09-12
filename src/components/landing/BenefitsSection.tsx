import { Card, CardContent } from "@/components/ui/card";
import { LandingPageIcon } from "./LandingPageIcon";
import { Calendar, Sparkles, TrendingUp, Leaf, Clock, Star, Users, Zap, LifeBuoy } from "lucide-react";
export const BenefitsSection = () => {
  const benefits = [{
    icon: Sparkles,
    title: "AI Content Generation",
    description: "Create professional social media posts, email campaigns, and blog articles in seconds with AI that understands your garden center.",
    bg: "#E9F5EC",
    iconColor: "#47B881"
  }, {
    icon: Users,
    title: "Customer Management (CRM)",
    description: "Track customer interactions, preferences, and purchase history. Build stronger relationships with personalized communication.",
    bg: "#FEF3C7",
    iconColor: "#F4C430"
  }, {
    icon: Calendar,
    title: "Social Media Planning",
    description: "Plan, schedule, and manage all your social media content across platforms with our visual content calendar.",
    bg: "#FDF2F2",
    iconColor: "#F28C8C"
  }, {
    icon: Zap,
    title: "Marketing Automation",
    description: "Set up automated email sequences, welcome series, and follow-up campaigns that nurture customers automatically.",
    bg: "#E0F2FE",
    iconColor: "#0EA5E9"
  }, {
    icon: LifeBuoy,
    title: "Human Support",
    description: "Never get stuck with chatbots or outdated articles. Talk to real humans who understand your garden center and industry best practices.",
    bg: "#FDF2F2",
    iconColor: "#F28C8C"
  }, {
    icon: TrendingUp,
    title: "Advanced Analytics",
    description: "Track campaign performance, customer engagement, ROI, and sales attribution with comprehensive reporting.",
    bg: "#FEF7ED",
    iconColor: "#EA580C"
  }, {
    icon: Star,
    title: "Content Library",
    description: "Access hundreds of pre-made templates, seasonal campaigns, and plant care content ready to customize and use.",
    bg: "#E9F5EC",
    iconColor: "#47B881"
  }, {
    icon: Leaf,
    title: "Email Marketing",
    description: "Create beautiful newsletters, promotional campaigns, and plant care tips that drive sales and customer loyalty.",
    bg: "#FEF3C7",
    iconColor: "#F4C430"
  }, {
    icon: Clock,
    title: "Blog Management",
    description: "Generate SEO-optimized blog posts about plant care, seasonal gardening tips, and product spotlights to drive organic traffic.",
    bg: "#FDF2F2",
    iconColor: "#F28C8C"
  }];
  return <section className="py-24 px-6 bg-offwhite">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold mb-6 text-accent">Everything You Need
To Market Your Garden Center</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Stop paying for multiple tools. Get everything you need to attract customers, increase sales, and build loyalty — all in one platform.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => <Card key={index} className="apple-fade-in-stagger p-8 rounded-2xl border-2 hover:shadow-lg transition-all duration-300 group bg-card border-secondary/20" style={{
          animationDelay: `${index * 0.1}s`
        }}>
              <CardContent className="p-0">
                <div className="mb-6">
                  {index === 0 ? <LandingPageIcon logo="/lovable-uploads/e0b56fe5-9a69-4ed9-a69a-53664e6e4c5d.png" variant="section" theme="neutral" animated={true} containerClassName="shadow-md bg-white border-secondary/30" /> : <LandingPageIcon icon={benefit.icon} variant="section" theme="neutral" animated={true} containerClassName="shadow-md bg-white border-secondary/30 text-secondary" />}
                </div>
                <h3 className="text-xl font-semibold mb-4 text-accent">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </CardContent>
            </Card>)}
        </div>
      </div>
    </section>;
};