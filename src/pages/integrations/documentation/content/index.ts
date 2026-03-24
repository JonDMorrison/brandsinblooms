import type { DocContent } from "@/components/docs/types";

import { cloverDocumentation } from "./clover";
import { constantContactDocumentation } from "./constantContact";
import { customWebhooksDocumentation } from "./customWebhooks";
import { emailInfrastructureDocumentation } from "./emailInfrastructure";
import { googleAnalytics4Documentation } from "./googleAnalytics4";
import { hubspotDocumentation } from "./hubspot";
import { klaviyoDocumentation } from "./klaviyo";
import { lightspeedDocumentation } from "./lightspeed";
import { mailchimpDocumentation } from "./mailchimp";
import { metaDocumentation } from "./meta";
import { shopifyDocumentation } from "./shopify";
import { slackDocumentation } from "./slack";
import { squareDocumentation } from "./square";
import { zapierDocumentation } from "./zapier";

const documentationRegistry: Record<string, DocContent> = {
  square: squareDocumentation,
  clover: cloverDocumentation,
  lightspeed: lightspeedDocumentation,
  meta: metaDocumentation,
  "google-analytics-4": googleAnalytics4Documentation,
  mailchimp: mailchimpDocumentation,
  klaviyo: klaviyoDocumentation,
  "constant-contact": constantContactDocumentation,
  "email-infrastructure": emailInfrastructureDocumentation,
  shopify: shopifyDocumentation,
  hubspot: hubspotDocumentation,
  zapier: zapierDocumentation,
  slack: slackDocumentation,
  "custom-webhooks": customWebhooksDocumentation,
};

export function getDocumentationContent(slug: string) {
  return documentationRegistry[slug] ?? null;
}

export function getDocumentationRegistry() {
  return { ...documentationRegistry };
}