import * as React from "react";
import type { SxProps } from "@mui/joy/styles/types";
import { countryCodes } from "@/lib/data/countryCodes";
import { JoySelect, JoySelectOptionItem } from "@/components/joy/JoySelect";

interface CountryCodeSelectProps {
  value: string;
  onChange: (dialCode: string) => void;
  disabled?: boolean;
  sx?: SxProps;
}

export const CountryCodeSelect: React.FC<CountryCodeSelectProps> = ({
  value,
  onChange,
  disabled = false,
  sx,
}) => {
  return (
    <JoySelect
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      sx={sx}
      slotProps={{
        button: {
          sx: {
            minHeight: 44,
            borderRadius: "12px",
          },
        },
      }}
    >
      {countryCodes.map((country) => (
        <JoySelectOptionItem key={country.code} value={country.dialCode}>
          {country.flag} {country.dialCode} {country.name}
        </JoySelectOptionItem>
      ))}
    </JoySelect>
  );
};
