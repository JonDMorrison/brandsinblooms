import counterpointLogo from "@/assets/logos/counterpoint.png";
import cloverLogo from "@/assets/logos/clover.svg";
import constantContactLogo from "@/assets/logos/constant-contact.svg";
import googleAnalytics4Logo from "@/assets/logos/google-analytics-4.png";
import hubspotLogo from "@/assets/logos/hubspot.svg";
import klaviyoLogo from "@/assets/logos/klaviyo.jpeg";
import lightspeedLogo from "@/assets/logos/lightspeed-x-series.svg";
import mailchimpLogo from "@/assets/logos/mailchimp-new.png";
import shopifyLogo from "@/assets/logos/shopify.svg";
import slackLogo from "@/assets/logos/slack.jpeg";
import squareLogo from "@/assets/logos/square-new.png";
import vmxPosLogo from "@/assets/logos/vmx-pos.png";
import vmxMarkLogo from "@/assets/logos/vmx-mark.png";
import zapierLogo from "@/assets/logos/zapier.jpeg";

export const providerLogoAssets: Partial<Record<string, string>> = {
  counterpoint: counterpointLogo,
  square: squareLogo,
  clover: cloverLogo,
  lightspeed: lightspeedLogo,
  "vmx-pos": vmxPosLogo,
  // Square tile mark (sprout) cropped from the official VMX POS wordmark.
  vmx: vmxMarkLogo,
  "google-analytics": googleAnalytics4Logo,
  mailchimp: mailchimpLogo,
  klaviyo: klaviyoLogo,
  "constant-contact": constantContactLogo,
  shopify: shopifyLogo,
  hubspot: hubspotLogo,
  zapier: zapierLogo,
  slack: slackLogo,
};
