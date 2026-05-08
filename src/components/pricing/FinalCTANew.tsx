import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui-legacy/button";
import { ArrowRight } from "lucide-react";
import { BrandFoliage } from "@/components/brand";

export const FinalCTANew = () => {
  const navigate = useNavigate();

  return (
    <section className="py-16 md:py-20 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="pricing-final-cta">
          <BrandFoliage
            className="pricing-foliage pricing-foliage--bottom-right"
            color="rgba(225, 255, 254, 0.55)"
            aria-hidden="true"
          />
          <BrandFoliage
            className="pricing-foliage pricing-foliage--top-left"
            color="rgba(225, 255, 254, 0.4)"
            aria-hidden="true"
          />

          <h2 className="pricing-final-cta__headline">
            Spend more time on the floor, less on the laptop.
          </h2>

          <p className="pricing-final-cta__subhead">
            Start your 14-day free trial. No credit card required. Lock in
            Early Adopter pricing for life.
          </p>

          <div className="relative z-[1] flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button
              onClick={() => navigate("/auth")}
              size="lg"
              className="bg-[#E1FFFE] text-[#1F4341] hover:bg-white font-semibold px-8 py-6 text-base group min-w-[200px]"
            >
              Start free trial
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-2 border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white hover:border-white/60 font-semibold px-8 py-6 text-base min-w-[200px]"
            >
              <Link to="/contact">Talk to sales</Link>
            </Button>
          </div>

          <p className="pricing-final-cta__support">
            Questions? Email{" "}
            <a href="mailto:support@bloomsuite.app">
              support@bloomsuite.app
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};
