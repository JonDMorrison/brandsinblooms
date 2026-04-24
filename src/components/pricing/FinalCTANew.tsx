import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui-legacy/button";
import { ArrowRight, Leaf } from "lucide-react";

export const FinalCTANew = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2F7A4F] to-[#256B42] p-10 md:p-14 text-center">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative">
            {/* Icon */}
            <div className="inline-flex w-14 h-14 rounded-2xl bg-white/10 items-center justify-center mb-6">
              <Leaf className="w-7 h-7 text-white" />
            </div>

            {/* Heading */}
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to grow with BloomSuite?
            </h2>

            {/* Subtext */}
            <p className="text-lg text-white/80 mb-8 max-w-md mx-auto">
              Join the Launch Program and lock in your pricing for life.
            </p>

            {/* CTA Button */}
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="bg-white text-[#2F7A4F] hover:bg-gray-100 font-semibold px-8 py-6 text-base group"
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>

            {/* Supporting text */}
            <p className="text-sm text-white/60 mt-4">
              14-day free trial • No credit card required
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
