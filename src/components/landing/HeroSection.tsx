
import { Button } from "@/components/ui/button";
import { IPhoneMockup } from "./IPhoneMockup";
import { MobileDashboardPreview } from "./MobileDashboardPreview";
import { ArrowRight } from "lucide-react";
import bloomsuiteLogo from "@/assets/bloomsuite-logo-correct.png";

interface HeroSectionProps {
  onGetStarted: () => void;
}

export const HeroSection = ({ onGetStarted }: HeroSectionProps) => {
  return (
    <section className="relative pt-20 pb-12 px-4 sm:px-6 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 -z-10">
        {/* Gradient Orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#3E5A6B]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#68BEB9]/10 rounded-full blur-3xl" />
        
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(104,190,185,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(104,190,185,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />
      </div>

      <div className="container mx-auto max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left Column - Text Content */}
          <div className="text-center lg:text-left space-y-5">
            {/* Logo */}
            <div className="flex justify-center lg:justify-start">
              <img 
                src={bloomsuiteLogo} 
                alt="BloomSuite" 
                className="w-12 h-12 mb-2"
              />
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-[#1a2f3a] via-[#2c4a58] to-[#1a2f3a] bg-clip-text text-transparent">
                The Most Powerful Marketing Tool
                <br />
                Ever Built for Garden Centers
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-3xl lg:max-w-none leading-relaxed">
              Stop struggling with scattered marketing tools that don't understand your business. BloomSuite gives you everything you need to attract more customers, increase sales, and grow your garden center — all in one powerful platform.
            </p>

            {/* CTA Button */}
            <div className="flex justify-center lg:justify-start">
              <Button 
                onClick={onGetStarted}
                size="lg"
                className="bg-gradient-to-r from-[#68BEB9] to-[#3E5A6B] hover:from-[#5AAEA9] hover:to-[#2E4A5B] text-white shadow-lg shadow-[#68BEB9]/25 hover:shadow-xl hover:shadow-[#68BEB9]/30 transition-all duration-300"
              >
                Get Started In 60 Seconds
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>

            {/* Trust Indicators */}
            <p className="text-sm text-gray-500">
              No credit card required • No technical skills needed • Ready in 60 seconds
            </p>
          </div>

          {/* Right Column - iPhone Mockup */}
          <IPhoneMockup>
            <MobileDashboardPreview />
          </IPhoneMockup>
        </div>
      </div>
    </section>
  );
};
