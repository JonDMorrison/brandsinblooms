// Company profile shapes shared by the app and by the email-rendering code
// that Supabase Edge Functions import.
//
// These live here rather than in useCompanyInfo so the shared email chain
// (studio/designSystem -> studio/emailHtmlGenerator -> _shared/*) can be
// resolved by the Deno bundler. Importing them from the hook dragged React,
// the browser Supabase client, and AuthContext into the edge-function module
// graph. useCompanyInfo re-exports both types, so app-side consumers are
// unaffected.

export interface BrandFooterColors {
  backgroundColor?: string;
  textColor?: string;
  linkColor?: string;
  dividerColor?: string;
  logoBackgroundColor?: string;
  logoTextColor?: string;
}

export interface CompanyFont {
  id: string;
  name: string;
  displayName: string;
  googleFontsUrl: string;
  fontFamilyCss: string;
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
  selectedFont?: CompanyFont;
  headlineFont?: CompanyFont;
  subheadingFont?: CompanyFont;
  bodyFont?: CompanyFont;
  buttonFont?: CompanyFont;
}
