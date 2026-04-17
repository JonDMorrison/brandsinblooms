import { useMemo } from "react";
import { useCompanyInfo } from "./useCompanyInfo";

export interface BrandDefaults {
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  buttonColor: string;
  headerBgColor: string;
  logoUrl: string;
  fontFamily: string;
  loaded: boolean;
}

const FALLBACK: BrandDefaults = {
  primaryColor: "#22c55e",
  secondaryColor: "#1e40af",
  textColor: "#1f2937",
  buttonColor: "#22c55e",
  headerBgColor: "#22c55e",
  logoUrl: "",
  fontFamily: "",
  loaded: false,
};

/**
 * Returns brand colors, fonts, and logo from the company profile.
 * Fetched once via useCompanyInfo, memoised.
 */
export function useBrandDefaults(): BrandDefaults {
  const { companyInfo } = useCompanyInfo();

  return useMemo<BrandDefaults>(() => {
    if (!companyInfo?.brandPrimaryColor) return FALLBACK;

    const primary = companyInfo.brandPrimaryColor || FALLBACK.primaryColor;
    return {
      primaryColor: primary,
      secondaryColor: companyInfo.brandSecondaryColor || FALLBACK.secondaryColor,
      textColor: companyInfo.brandTextColor || FALLBACK.textColor,
      buttonColor: primary,
      headerBgColor: primary,
      logoUrl: companyInfo.logoUrl || "",
      fontFamily:
        companyInfo.selectedFont?.fontFamilyCss ||
        companyInfo.bodyFont?.fontFamilyCss ||
        "",
      loaded: true,
    };
  }, [companyInfo]);
}
