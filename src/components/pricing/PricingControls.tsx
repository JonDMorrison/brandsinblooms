import { cn } from "@/lib/utils";

export type BillingInterval = "monthly" | "annual";
export type Currency = "usd" | "cad";

interface PricingControlsProps {
  billingInterval: BillingInterval;
  onBillingIntervalChange: (next: BillingInterval) => void;
  currency: Currency;
  onCurrencyChange: (next: Currency) => void;
}

const billingButtonBase =
  "h-9 px-4 text-sm font-semibold rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3E7C77] focus-visible:ring-offset-2";

const currencyButtonBase =
  "h-7 px-3 text-xs font-semibold rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3E7C77] focus-visible:ring-offset-2";

export const PricingControls = ({
  billingInterval,
  onBillingIntervalChange,
  currency,
  onCurrencyChange,
}: PricingControlsProps) => {
  return (
    <div
      className="flex flex-col items-center gap-4 mb-10"
      data-testid="pricing-controls"
    >
      {/* Billing-interval toggle — primary control, larger visual weight */}
      <div
        role="tablist"
        aria-label="Billing interval"
        className="inline-flex items-center bg-gray-100 rounded-full p-1 shadow-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={billingInterval === "monthly"}
          data-testid="billing-monthly"
          onClick={() => onBillingIntervalChange("monthly")}
          className={cn(
            billingButtonBase,
            billingInterval === "monthly"
              ? "bg-white text-gray-900 shadow"
              : "text-gray-600 hover:text-gray-900",
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={billingInterval === "annual"}
          data-testid="billing-annual"
          onClick={() => onBillingIntervalChange("annual")}
          className={cn(
            billingButtonBase,
            "flex items-center gap-2",
            billingInterval === "annual"
              ? "bg-white text-gray-900 shadow"
              : "text-gray-600 hover:text-gray-900",
          )}
        >
          <span>Annual</span>
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
              billingInterval === "annual"
                ? "bg-[#3E7C77] text-white"
                : "bg-[#E1FFFE] text-[#1F4341]",
            )}
          >
            Save 17%
          </span>
        </button>
      </div>

      {/* Currency selector — lower visual weight, sits beneath */}
      <div
        role="tablist"
        aria-label="Display currency"
        className="inline-flex items-center bg-white border border-gray-200 rounded-full p-0.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={currency === "usd"}
          data-testid="currency-usd"
          onClick={() => onCurrencyChange("usd")}
          className={cn(
            currencyButtonBase,
            currency === "usd"
              ? "bg-gray-900 text-white"
              : "text-gray-600 hover:text-gray-900",
          )}
        >
          USD
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={currency === "cad"}
          data-testid="currency-cad"
          onClick={() => onCurrencyChange("cad")}
          className={cn(
            currencyButtonBase,
            currency === "cad"
              ? "bg-gray-900 text-white"
              : "text-gray-600 hover:text-gray-900",
          )}
        >
          CAD
        </button>
      </div>
    </div>
  );
};
