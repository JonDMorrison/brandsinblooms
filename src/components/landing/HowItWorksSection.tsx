
import { Card, CardContent } from "@/components/ui/card";
import { Leaf, Calendar, Rocket, TrendingUp } from "lucide-react";

export const HowItWorksSection = () => {
  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20 apple-section-spacing">
          <h2 className="text-4xl font-bold mb-6 text-gray-900 apple-headline-large">
            Complete Marketing Transformation in 4 Steps
          </h2>
          <p className="text-xl text-[#6B7280] apple-body-enhanced max-w-3xl mx-auto">
            From setup to success in under a minute. Our comprehensive platform handles everything automatically.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card className="apple-fade-in-stagger card-interactive text-center p-8 rounded-3xl bg-[#E9F5EC] border-2 border-[#47B881]/10 hover:border-[#47B881]/30 shadow-sm hover:shadow-lg group transition-all duration-300">
            <CardContent className="pt-6 apple-card-spacing">
              <div className="w-14 h-14 bg-[#47B881] text-white rounded-full flex items-center justify-center mb-4 mx-auto shadow-lg">
                <Leaf className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-gray-900 apple-headline-medium">
                AI Brand Analysis
              </h3>
              <p className="text-base text-[#6B7280] leading-relaxed apple-body-enhanced">
                Share your website and our AI instantly learns your brand voice, style, and customer approach.
              </p>
            </CardContent>
          </Card>

          <Card className="apple-fade-in-stagger card-interactive text-center p-8 rounded-3xl bg-[#FEF3C7] border-2 border-[#F4C430]/20 hover:border-[#F4C430]/40 shadow-sm hover:shadow-lg group transition-all duration-300" style={{animationDelay: '0.1s'}}>
            <CardContent className="pt-6 apple-card-spacing">
              <div className="w-14 h-14 bg-[#F4C430] text-white rounded-full flex items-center justify-center mb-4 mx-auto shadow-lg">
                <Calendar className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-gray-900 apple-headline-medium">
                Content Library
              </h3>
              <p className="text-base text-[#6B7280] leading-relaxed apple-body-enhanced">
                Access hundreds of seasonal templates, plant care guides, and marketing campaigns ready to customize.
              </p>
            </CardContent>
          </Card>

          <Card className="apple-fade-in-stagger card-interactive text-center p-8 rounded-3xl bg-[#FDF2F2] border-2 border-[#F28C8C]/20 hover:border-[#F28C8C]/40 shadow-sm hover:shadow-lg group transition-all duration-300" style={{animationDelay: '0.2s'}}>
            <CardContent className="pt-6 apple-card-spacing">
              <div className="w-14 h-14 bg-[#F28C8C] text-white rounded-full flex items-center justify-center mb-4 mx-auto shadow-lg">
                <Rocket className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-gray-900 apple-headline-medium">
                Smart Automation
              </h3>
              <p className="text-base text-[#6B7280] leading-relaxed apple-body-enhanced">
                Set up automated email sequences, social media posting schedules, and customer follow-ups that run themselves.
              </p>
            </CardContent>
          </Card>

          <Card className="apple-fade-in-stagger card-interactive text-center p-8 rounded-3xl bg-[#E0F2FE] border-2 border-[#0EA5E9]/20 hover:border-[#0EA5E9]/40 shadow-sm hover:shadow-lg group transition-all duration-300" style={{animationDelay: '0.3s'}}>
            <CardContent className="pt-6 apple-card-spacing">
              <div className="w-14 h-14 bg-[#0EA5E9] text-white rounded-full flex items-center justify-center mb-4 mx-auto shadow-lg">
                <TrendingUp className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-gray-900 apple-headline-medium">
                Track & Optimize
              </h3>
              <p className="text-base text-[#6B7280] leading-relaxed apple-body-enhanced">
                Monitor campaign performance, customer engagement, and sales impact with comprehensive analytics and insights.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
