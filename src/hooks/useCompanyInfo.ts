import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: "Your Company",
  address: "123 Business St, Suite 100, City, State 12345",
  phone: "(555) 123-4567",
};
const COMPANY_PROFILE_CHANNEL_CONNECT_DELAY_MS = 2000;
const COMPANY_PROFILE_CHANNEL_RETRY_INTERVAL_MS = 250;

// Brand footer colors from profile settings
export interface BrandFooterColors {
  backgroundColor?: string;
  textColor?: string;
  linkColor?: string;
  dividerColor?: string;
  logoBackgroundColor?: string;
  logoTextColor?: string;
}

export interface CompanyInfo {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  streetAddress?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  logoUrl?: string;
  emailDomain?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  brandAccentColor?: string;
  brandTextColor?: string;
  brandPrimaryColorRaw?: string;
  brandSecondaryColorRaw?: string;
  brandAccentColorRaw?: string;
  brandTextColorRaw?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  pinterestUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
  footerLegalText?: string;
  // Brand footer colors from profile settings
  brandFooterColors?: BrandFooterColors;
  selectedFont?: {
    id: string;
    name: string;
    displayName: string;
    googleFontsUrl: string;
    fontFamilyCss: string;
  };
  headlineFont?: {
    id: string;
    name: string;
    displayName: string;
    googleFontsUrl: string;
    fontFamilyCss: string;
  };
  subheadingFont?: {
    id: string;
    name: string;
    displayName: string;
    googleFontsUrl: string;
    fontFamilyCss: string;
  };
  bodyFont?: {
    id: string;
    name: string;
    displayName: string;
    googleFontsUrl: string;
    fontFamilyCss: string;
  };
  buttonFont?: {
    id: string;
    name: string;
    displayName: string;
    googleFontsUrl: string;
    fontFamilyCss: string;
  };
}

export const useCompanyInfo = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [companyInfo, setCompanyInfo] =
    useState<CompanyInfo>(DEFAULT_COMPANY_INFO);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const authLoadingRef = useRef(loading);
  const isMountedRef = useRef(true);
  const loadRequestIdRef = useRef(0);
  const lastCompanyInfoKeyRef = useRef(JSON.stringify(DEFAULT_COMPANY_INFO));

  useEffect(() => {
    authLoadingRef.current = loading;
  }, [loading]);

  const setCompanyInfoIfChanged = useCallback(
    (nextCompanyInfo: CompanyInfo) => {
      const nextKey = JSON.stringify(nextCompanyInfo);

      if (nextKey === lastCompanyInfoKeyRef.current) {
        return;
      }

      lastCompanyInfoKeyRef.current = nextKey;
      setCompanyInfo(nextCompanyInfo);
    },
    [],
  );

  const loadCompanyInfo = useCallback(
    async (targetUserId: string | null) => {
      const requestId = ++loadRequestIdRef.current;

      if (!targetUserId) {
        setCompanyInfoIfChanged(DEFAULT_COMPANY_INFO);
        setIsLoading(false);
        return;
      }

      try {
        if (isMountedRef.current) {
          setIsLoading(true);
        }

        const { data: profile, error } = await supabase
          .from("company_profiles")
          .select(
            `
          *,
          selected_font:available_fonts!selected_font_id(
            id,
            name,
            display_name,
            google_fonts_url,
            font_family_css
          ),
          headline_font:available_fonts!headline_font_id(
            id,
            name,
            display_name,
            google_fonts_url,
            font_family_css
          ),
          subheading_font:available_fonts!subheading_font_id(
            id,
            name,
            display_name,
            google_fonts_url,
            font_family_css
          ),
          body_font:available_fonts!body_font_id(
            id,
            name,
            display_name,
            google_fonts_url,
            font_family_css
          ),
          button_font:available_fonts!button_font_id(
            id,
            name,
            display_name,
            google_fonts_url,
            font_family_css
          )
        `,
          )
          .eq("user_id", targetUserId)
          .maybeSingle();

        if (!isMountedRef.current || requestId !== loadRequestIdRef.current) {
          return;
        }

        if (error) {
          console.error("Error loading company profile:", error);
          setCompanyInfoIfChanged(DEFAULT_COMPANY_INFO);
          return;
        }

        if (profile) {
          const featureFlags = profile.feature_flags as any;
          const font = profile.selected_font as any;
          const headlineFont = profile.headline_font as any;
          const subheadingFont = profile.subheading_font as any;
          const bodyFont = profile.body_font as any;
          const buttonFont = profile.button_font as any;

          // Build full address from structured fields
          const addressParts = [
            profile.street_address,
            profile.city,
            profile.state_province,
            profile.postal_code,
            profile.country,
          ].filter(Boolean);
          const fullAddress =
            addressParts.length > 0
              ? addressParts.join(", ")
              : profile.location_info || "";

          setCompanyInfoIfChanged({
            name: profile.company_name || "",
            // Use structured address, fallback to location_info for legacy data
            address:
              fullAddress || "123 Business St, Suite 100, City, State 12345",
            // Read phone from proper column, fallback to feature_flags for legacy
            phone: profile.company_phone || featureFlags?.company_phone || "",
            email: profile.company_email || "",
            websiteUrl: profile.website_url || "",
            // Structured address fields
            streetAddress: profile.street_address || "",
            city: profile.city || "",
            stateProvince: profile.state_province || "",
            postalCode: profile.postal_code || "",
            country: profile.country || "",
            logoUrl: featureFlags?.company_logo_url,
            emailDomain: profile.email_domain,
            brandPrimaryColor: profile.brand_primary_color || "#22c55e",
            brandSecondaryColor: profile.brand_secondary_color || "#1e40af",
            brandAccentColor: profile.brand_accent_color || "#f59e0b",
            brandTextColor: profile.brand_text_color || "#1f2937",
            brandPrimaryColorRaw: profile.brand_primary_color || undefined,
            brandSecondaryColorRaw: profile.brand_secondary_color || undefined,
            brandAccentColorRaw: profile.brand_accent_color || undefined,
            brandTextColorRaw: profile.brand_text_color || undefined,
            // Social URLs - log them for debugging and use undefined fallback
            facebookUrl: profile.facebook_url || undefined,
            instagramUrl: profile.instagram_url || undefined,
            tiktokUrl: profile.tiktok_url || undefined,
            pinterestUrl: profile.pinterest_url || undefined,
            youtubeUrl: profile.youtube_url || undefined,
            linkedinUrl: profile.linkedin_url || undefined,
            footerLegalText: profile.footer_legal_text || undefined,
            // Brand footer colors from feature_flags
            brandFooterColors: featureFlags?.footer_colors
              ? {
                  backgroundColor: featureFlags.footer_colors.backgroundColor,
                  textColor: featureFlags.footer_colors.textColor,
                  linkColor: featureFlags.footer_colors.linkColor,
                  dividerColor: featureFlags.footer_colors.dividerColor,
                  logoBackgroundColor:
                    featureFlags.footer_colors.logoBackgroundColor,
                  logoTextColor: featureFlags.footer_colors.logoTextColor,
                }
              : undefined,
            selectedFont: font
              ? {
                  id: font.id,
                  name: font.name,
                  displayName: font.display_name,
                  googleFontsUrl: font.google_fonts_url,
                  fontFamilyCss: font.font_family_css,
                }
              : undefined,
            headlineFont: headlineFont
              ? {
                  id: headlineFont.id,
                  name: headlineFont.name,
                  displayName: headlineFont.display_name,
                  googleFontsUrl: headlineFont.google_fonts_url,
                  fontFamilyCss: headlineFont.font_family_css,
                }
              : undefined,
            subheadingFont: subheadingFont
              ? {
                  id: subheadingFont.id,
                  name: subheadingFont.name,
                  displayName: subheadingFont.display_name,
                  googleFontsUrl: subheadingFont.google_fonts_url,
                  fontFamilyCss: subheadingFont.font_family_css,
                }
              : undefined,
            bodyFont: bodyFont
              ? {
                  id: bodyFont.id,
                  name: bodyFont.name,
                  displayName: bodyFont.display_name,
                  googleFontsUrl: bodyFont.google_fonts_url,
                  fontFamilyCss: bodyFont.font_family_css,
                }
              : undefined,
            buttonFont: buttonFont
              ? {
                  id: buttonFont.id,
                  name: buttonFont.name,
                  displayName: buttonFont.display_name,
                  googleFontsUrl: buttonFont.google_fonts_url,
                  fontFamilyCss: buttonFont.font_family_css,
                }
              : undefined,
          });
        } else {
          setCompanyInfoIfChanged(DEFAULT_COMPANY_INFO);
        }
      } catch (error) {
        console.error("Error loading company info:", error);
        if (isMountedRef.current && requestId === loadRequestIdRef.current) {
          setCompanyInfoIfChanged(DEFAULT_COMPANY_INFO);
        }
      } finally {
        if (isMountedRef.current && requestId === loadRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [setCompanyInfoIfChanged],
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const runLoad = async () => {
      if (!active) {
        return;
      }

      await loadCompanyInfo(userId);
    };

    void runLoad();

    return () => {
      active = false;
    };
  }, [loadCompanyInfo, userId]);

  // Separate effect for real-time subscription to avoid dependency issues
  useEffect(() => {
    if (!userId || channelRef.current) {
      return;
    }

    let isDisposed = false;
    let connectTimerId: ReturnType<typeof window.setTimeout> | null = null;

    const subscribeToCompanyProfileChanges = () => {
      if (isDisposed || channelRef.current) {
        return;
      }

      if (authLoadingRef.current) {
        connectTimerId = window.setTimeout(
          subscribeToCompanyProfileChanges,
          COMPANY_PROFILE_CHANNEL_RETRY_INTERVAL_MS,
        );
        return;
      }

      const channel = supabase
        .channel(`company-profile-changes-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "company_profiles",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            // Reload company info to get updated font data
            void loadCompanyInfo(userId);
          },
        )
        .subscribe();

      channelRef.current = channel;
      connectTimerId = null;
    };

    connectTimerId = window.setTimeout(
      subscribeToCompanyProfileChanges,
      COMPANY_PROFILE_CHANNEL_CONNECT_DELAY_MS,
    );

    return () => {
      isDisposed = true;

      if (connectTimerId !== null) {
        window.clearTimeout(connectTimerId);
      }

      const currentChannel = channelRef.current;
      channelRef.current = null;

      if (currentChannel) {
        void supabase.removeChannel(currentChannel);
      }
    };
  }, [loadCompanyInfo, userId]);

  return useMemo(
    () => ({
      companyInfo,
      isLoading,
    }),
    [companyInfo, isLoading],
  );
};
