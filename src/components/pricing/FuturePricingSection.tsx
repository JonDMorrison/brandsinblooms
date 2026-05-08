import { futurePricing } from "./pricingConfig";
import { Lock } from "lucide-react";

/**
 * Section 7 — Future pricing comparison.
 *
 * Filters the Seed row out of the rendered table (Seed is no longer
 * part of the public grid) but leaves it in the underlying
 * futurePricing config so any consumer that references it
 * continues to compile. Adds an "Annual savings" column derived
 * from (future − intro) × 12.
 */
export const FuturePricingSection = () => {
  const visibleRows = futurePricing.filter((row) => row.tier !== "Seed");

  return (
    <section className="py-16 md:py-20 px-6 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Future pricing after the Launch Program
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Lock in your rate now. Founding customers save thousands per
            year forever.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* 4-column header: Plan | Intro | Future | Annual savings */}
          <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-200 text-sm md:text-base">
            <div className="p-3 md:p-4 font-semibold text-gray-900">
              Plan
            </div>
            <div className="p-3 md:p-4 font-semibold text-[#3E7C77] text-center">
              Intro Price
            </div>
            <div className="p-3 md:p-4 font-semibold text-gray-500 text-center">
              Future Price
            </div>
            <div className="p-3 md:p-4 font-semibold text-[#1F4341] text-center">
              Annual savings
            </div>
          </div>

          {visibleRows.map((row, index) => {
            const annualSavings = (row.future - row.intro) * 12;

            return (
              <div
                key={row.tier}
                className={`grid grid-cols-4 items-center text-sm md:text-base ${
                  index !== visibleRows.length - 1
                    ? "border-b border-gray-100"
                    : ""
                }`}
              >
                <div className="p-3 md:p-4 font-medium text-gray-900">
                  {row.tier}
                </div>
                <div className="p-3 md:p-4 text-center">
                  <span className="text-lg md:text-xl font-bold text-[#3E7C77]">
                    ${row.intro}
                  </span>
                  <span className="text-gray-500 text-xs md:text-sm">
                    /mo
                  </span>
                </div>
                <div className="p-3 md:p-4 text-center flex items-center justify-center gap-1">
                  <span className="text-lg md:text-xl font-bold text-gray-400 line-through">
                    ${row.future}
                  </span>
                  <span className="text-gray-400 text-xs md:text-sm">
                    /mo
                  </span>
                </div>
                <div className="p-3 md:p-4 text-center">
                  <span className="text-lg md:text-xl font-bold text-[#1F4341]">
                    ${annualSavings.toLocaleString()}
                  </span>
                  <span className="text-gray-500 text-xs md:text-sm block md:inline md:ml-1">
                    /year
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-4 bg-[#E1FFFE] rounded-xl border border-[#3E7C77]/25">
            <Lock className="w-5 h-5 text-[#3E7C77]" />
            <p className="text-base font-semibold text-[#1F4341]">
              Founding customers remain locked into introductory pricing
              for life.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
