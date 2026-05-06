import cloverLogo from "@/assets/logos/clover.svg";
import constantContactLogo from "@/assets/logos/constant-contact.svg";
import googleAnalytics4Logo from "@/assets/logos/google-analytics-4.png";
import hubspotLogo from "@/assets/logos/hubspot.svg";
import klaviyoLogo from "@/assets/logos/klaviyo.jpeg";
import lightspeedLogo from "@/assets/logos/lightspeed-x-series.svg";
import mailchimpLogo from "@/assets/logos/mailchimp-new.png";
import shopifyLogo from "@/assets/logos/shopify.svg";
import slackLogo from "@/assets/logos/slack.jpeg";
import stripeLogo from "@/assets/logos/stripe.png";
import squareLogo from "@/assets/logos/square-new.png";
import zapierLogo from "@/assets/logos/zapier.jpeg";
import cloudflareLogo from "@/assets/logos/cloudflare.png";

export const providerLogoAssets: Partial<Record<string, string>> = {
  square: squareLogo,
  clover: cloverLogo,
  cloudflare: cloudflareLogo,
  lightspeed: lightspeedLogo,
  "google-analytics": googleAnalytics4Logo,
  mailchimp: mailchimpLogo,
  klaviyo: klaviyoLogo,
  "constant-contact": constantContactLogo,
  shopify: shopifyLogo,
  hubspot: hubspotLogo,
  zapier: zapierLogo,
  slack: slackLogo,
  stripe: stripeLogo,
};
