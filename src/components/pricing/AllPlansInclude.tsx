import { 
  Users, 
  Target, 
  CalendarClock, 
  Send, 
  Globe, 
  BarChart3, 
  Users2, 
  Sparkles 
} from "lucide-react";
import { allPlansFeatures } from "./pricingConfig";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  Target,
  CalendarClock,
  Send,
  Globe,
  BarChart3,
  Users2,
  Sparkles,
};

export const AllPlansInclude = () => {
  return (
    <section className="py-20 px-6 bg-gradient-to-b from-white to-[#f8faf9]">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything in BloomSuite, at every tier
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            No matter which plan you choose, you get access to our complete garden centre marketing platform.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {allPlansFeatures.map((feature, index) => {
            const IconComponent = iconMap[feature.icon] || Sparkles;
            
            return (
              <div 
                key={index}
                className="flex items-start gap-4 p-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-[#2F7A4F]/20 transition-all duration-200"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#2F7A4F]/10 flex items-center justify-center">
                  <IconComponent className="w-5 h-5 text-[#2F7A4F]" />
                </div>
                <span className="text-sm font-medium text-gray-700 pt-2">
                  {feature.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
