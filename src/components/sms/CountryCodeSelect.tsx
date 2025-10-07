import React from 'react';
import { countryCodes } from '@/lib/data/countryCodes';

interface CountryCodeSelectProps {
  value: string;
  onChange: (dialCode: string) => void;
  disabled?: boolean;
}

export const CountryCodeSelect: React.FC<CountryCodeSelectProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="flex h-10 w-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {countryCodes.map((country) => (
        <option key={country.code} value={country.dialCode}>
          {country.flag} {country.dialCode} {country.name}
        </option>
      ))}
    </select>
  );
};
