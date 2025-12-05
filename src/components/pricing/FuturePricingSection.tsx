import { futurePricing } from "./pricingConfig";
import { ArrowRight, Lock } from "lucide-react";

export const FuturePricingSection = () => {
  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Future pricing after the Launch Program
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Lock in your rate now before prices increase.
          </p>
        </div>

        {/* Pricing comparison table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
            <div className="p-4 font-semibold text-gray-900">Plan</div>
            <div className="p-4 font-semibold text-[#2F7A4F] text-center">
              Intro Price
            </div>
            <div className="p-4 font-semibold text-gray-500 text-center">
              Future Price
            </div>
          </div>

          {/* Table rows */}
          {futurePricing.map((row, index) => (
            <div 
              key={row.tier}
              className={`grid grid-cols-3 items-center ${
                index !== futurePricing.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <div className="p-4 font-medium text-gray-900">{row.tier}</div>
              <div className="p-4 text-center">
                <span className="text-xl font-bold text-[#2F7A4F]">${row.intro}</span>
                <span className="text-gray-500 text-sm">/mo</span>
              </div>
              <div className="p-4 text-center flex items-center justify-center gap-2">
                <span className="text-xl font-bold text-gray-400 line-through">${row.future}</span>
                <span className="text-gray-400 text-sm">/mo</span>
              </div>
            </div>
          ))}
        </div>

        {/* Lock-in message */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-4 bg-[#2F7A4F]/5 rounded-xl border border-[#2F7A4F]/20">
            <Lock className="w-5 h-5 text-[#2F7A4F]" />
            <p className="text-base font-semibold text-[#2F7A4F]">
              Founding customers remain locked into introductory pricing for life.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
