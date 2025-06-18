
import { Card, CardContent } from "@/components/ui/card";
import { Leaf, Calendar, Rocket } from "lucide-react";

export const HowItWorksSection = () => {
  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20 apple-section-spacing">
          <h2 className="text-4xl font-bold mb-6 text-gray-900 apple-headline-large">
            Transform Your Marketing in 3 Simple Steps
          </h2>
          <p className="text-xl text-[#6B7280] apple-body-enhanced max-w-3xl mx-auto">
            From zero to marketing hero in under a minute. Our streamlined process gets you results immediately.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-10">
          <Card className="apple-fade-in-stagger card-interactive text-center p-10 rounded-3xl bg-[#E9F5EC] border-2 border-[#47B881]/10 hover:border-[#47B881]/30 shadow-sm hover:shadow-lg group transition-all duration-300">
            <CardContent className="pt-8 apple-card-spacing">
              <div className="w-16 h-16 bg-[#47B881] text-white rounded-full flex items-center justify-center mb-6 mx-auto shadow-lg">
                <Leaf className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-semibold mb-6 text-gray-900 apple-headline-medium">
                Share Your Website
              </h3>
              <p className="text-lg text-[#6B7280] leading-relaxed apple-body-enhanced">
                Simply paste your website URL and we'll instantly analyze your brand voice, style, and customer approach to create perfectly matched content.
              </p>
            </CardContent>
          </Card>

          <Card className="apple-fade-in-stagger card-interactive text-center p-10 rounded-3xl bg-[#FEF3C7] border-2 border-[#F4C430]/20 hover:border-[#F4C430]/40 shadow-sm hover:shadow-lg group transition-all duration-300" style={{animationDelay: '0.1s'}}>
            <CardContent className="pt-8 apple-card-spacing">
              <div className="w-16 h-16 bg-[#F4C430] text-white rounded-full flex items-center justify-center mb-6 mx-auto shadow-lg">
                <Calendar className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-semibold mb-6 text-gray-900 apple-headline-medium">
                Review & Customize
              </h3>
              <p className="text-lg text-[#6B7280] leading-relaxed apple-body-enhanced">
                Instantly receive ready-to-publish posts, emails, and content — all fully editable and tailored to your garden center's unique personality.
              </p>
            </CardContent>
          </Card>

          <Card className="apple-fade-in-stagger card-interactive text-center p-10 rounded-3xl bg-[#FDF2F2] border-2 border-[#F28C8C]/20 hover:border-[#F28C8C]/40 shadow-sm hover:shadow-lg group transition-all duration-300" style={{animationDelay: '0.2s'}}>
            <CardContent className="pt-8 apple-card-spacing">
              <div className="w-16 h-16 bg-[#F28C8C] text-white rounded-full flex items-center justify-center mb-6 mx-auto shadow-lg">
                <Rocket className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-semibold mb-6 text-gray-900 apple-headline-medium">
                Publish & Thrive
              </h3>
              <p className="text-lg text-[#6B7280] leading-relaxed apple-body-enhanced">
                Share across all platforms with one click, track performance, and watch your garden center's marketing flourish effortlessly.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
