import React from "react";
import { countryCodes } from "@/lib/data/countryCodes";
import { cn } from "@/lib/utils";

interface CountryCodeSelectProps {
  value: string;
  onChange: (dialCode: string) => void;
  disabled?: boolean;
  className?: string;
}

export const CountryCodeSelect: React.FC<CountryCodeSelectProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "flex h-12 w-[148px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {countryCodes.map((country) => (
        <option key={country.code} value={country.dialCode}>
          {country.flag} {country.dialCode} {country.name}
        </option>
      ))}
    </select>
  );
};
