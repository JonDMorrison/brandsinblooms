import { TrendingUp, DollarSign, Zap, BarChart, Users, Shield } from "lucide-react";

const benefits = [
  {
    icon: DollarSign,
    title: "Low barrier to entry",
    description: "Start small and scale as you grow, with no upfront commitment.",
  },
  {
    icon: TrendingUp,
    title: "Competitive pricing",
    description: "Better value than Mailchimp, Klaviyo, and other marketing tools combined.",
  },
  {
    icon: Zap,
    title: "Maximum value",
    description: "Every tier includes the full BloomSuite platform—no feature gating.",
  },
  {
    icon: BarChart,
    title: "Predictable costs",
    description: "Clear pricing with transparent overages. No surprise bills.",
  },
  {
    icon: Users,
    title: "Built for growth",
    description: "Supports garden centres from 1,000 to 100,000+ contacts.",
  },
  {
    icon: Shield,
    title: "Lifetime lock-in",
    description: "Early adopters keep their introductory rate forever.",
  },
];

export const WhyThisWorks = () => {
  return (
    <section className="py-20 px-6 bg-[#f8faf9]">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Why this pricing model works
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Simple, transparent, and designed for garden centres of all sizes.
          </p>
        </div>

        {/* Benefits grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => {
            const IconComponent = benefit.icon;
            
            return (
              <div key={index} className="text-center">
                <div className="inline-flex w-12 h-12 rounded-xl bg-[#2F7A4F]/10 items-center justify-center mb-4">
                  <IconComponent className="w-6 h-6 text-[#2F7A4F]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {benefit.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
