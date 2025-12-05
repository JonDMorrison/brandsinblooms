import { Badge } from "@/components/ui/badge";
import { Leaf } from "lucide-react";

export const PricingHeroNew = () => {
  return (
    <section className="relative py-20 md:py-28 px-6 overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#f8faf9] via-white to-white" />
      
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-[#2F7A4F]/5 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#2F7A4F]/3 rounded-full blur-3xl" />
      
      <div className="relative max-w-4xl mx-auto text-center">
        {/* Badge */}
        <Badge 
          variant="outline" 
          className="mb-6 px-4 py-2 text-sm font-medium border-[#2F7A4F]/30 text-[#2F7A4F] bg-[#2F7A4F]/5"
        >
          <Leaf className="w-4 h-4 mr-2" />
          Early Adopter Launch Program
        </Badge>
        
        {/* Title */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6">
          Pricing for every stage
          <br />
          <span className="text-[#2F7A4F]">of growth</span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
          Choose the BloomSuite plan that matches your garden centre's size and ambitions.
        </p>
        
        {/* Supporting text */}
        <p className="text-sm md:text-base text-gray-500 max-w-xl mx-auto">
          Join our <span className="font-semibold text-[#2F7A4F]">Launch Program for Early Adopters</span> and 
          lock in introductory pricing for life.
        </p>
      </div>
    </section>
  );
};
