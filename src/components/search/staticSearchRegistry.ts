import {
  SEARCH_GROUP_METADATA,
  SEARCH_GROUP_ORDER,
  isCurrentRouteMatch,
  type SearchGroupKey,
  type SearchResultGroup,
  type SearchResultItem,
} from "@/components/search/types";

type StaticSearchDefinition = Omit<SearchResultItem, "categoryIcon">;

const STATIC_SEARCH_QUERY_CACHE_LIMIT = 100;
const staticSearchQueryCache = new Map<string, SearchResultGroup[]>();

function cloneSearchGroups(groups: SearchResultGroup[]) {
  return groups.map((group) => ({
    ...group,
    results: group.results.map((result) => ({ ...result })),
  }));
}

const createStaticItem = (
  definition: StaticSearchDefinition,
): SearchResultItem => ({
  ...definition,
  categoryIcon: SEARCH_GROUP_METADATA[definition.group].icon,
});

const PAGE_ENTRIES: SearchResultItem[] = [
  createStaticItem({
    id: "static:page:dashboard",
    type: "page",
    title: "Dashboard",
    subtitle: "See your workspace overview and the latest performance signals.",
    route: "/dashboard",
    icon: "dashboard",
    metadata: "Page",
    keywords: ["home", "overview", "summary", "workspace"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:content-library",
    type: "page",
    title: "Content Library",
    subtitle: "Manage reusable content, assets, and creative ideas.",
    route: "/content",
    icon: "pages",
    metadata: "Page",
    keywords: ["content", "library", "assets", "creative"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:newsletters",
    type: "page",
    title: "Newsletters",
    subtitle: "Review newsletter drafts, sends, and publishing history.",
    route: "/newsletters",
    icon: "mail",
    metadata: "Page",
    keywords: ["newsletter", "email", "broadcast", "send"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:social-media",
    type: "page",
    title: "Social Media",
    subtitle: "Manage connected social accounts and publishing channels.",
    route: "/social-accounts",
    icon: "pages",
    metadata: "Page",
    keywords: [
      "social media",
      "accounts",
      "connections",
      "facebook",
      "instagram",
      "meta",
    ],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:calendar",
    type: "page",
    title: "Calendar",
    subtitle: "Plan campaigns, posts, and upcoming publishing work.",
    route: "/calendar",
    icon: "calendar",
    metadata: "Page",
    keywords: ["calendar", "schedule", "planner", "dates"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:crm",
    type: "page",
    title: "CRM",
    subtitle: "Open the CRM workspace for customers and lifecycle tools.",
    route: "/crm",
    icon: "customers",
    metadata: "Page",
    keywords: ["crm", "customers", "contacts", "relationships"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:customers",
    type: "page",
    title: "Customers",
    subtitle: "Browse customer profiles, tags, and purchase activity.",
    route: "/crm/customers",
    icon: "customers",
    metadata: "Page",
    keywords: ["customers", "contacts", "profiles", "crm"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:campaigns",
    type: "page",
    title: "Campaigns",
    subtitle: "Manage email campaigns, drafts, and scheduled sends.",
    route: "/crm/campaigns",
    icon: "campaigns",
    metadata: "Page",
    keywords: ["campaigns", "email", "composer", "broadcasts"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:segments",
    type: "page",
    title: "Segments",
    subtitle: "Review dynamic and static audience segments.",
    route: "/crm/segments",
    icon: "segments",
    metadata: "Page",
    keywords: ["segments", "audience", "filters", "lists"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:personas",
    type: "page",
    title: "Personas",
    subtitle: "Explore predefined personas and custom audience profiles.",
    route: "/crm/personas",
    icon: "personas",
    metadata: "Page",
    keywords: ["personas", "profiles", "audience", "customers"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:automations",
    type: "page",
    title: "Automations",
    subtitle: "Build and manage automated CRM journeys and workflows.",
    route: "/crm/automations",
    icon: "automations",
    metadata: "Page",
    keywords: ["automations", "workflow", "journeys", "triggers"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:forms",
    type: "page",
    title: "Forms",
    subtitle: "Create lead capture forms and review submission activity.",
    route: "/crm/forms",
    icon: "forms",
    metadata: "Page",
    keywords: ["forms", "signup", "lead capture", "builder"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:saved-blocks",
    type: "saved_block",
    title: "Saved Blocks",
    subtitle: "Reuse campaign content blocks and layout snippets.",
    route: "/crm/campaigns/blocks",
    icon: "saved-block",
    metadata: "Page",
    keywords: ["saved blocks", "content blocks", "snippets", "templates"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:activity-center",
    type: "activity",
    title: "Activity Center",
    subtitle: "Track recent app activity, queue events, and follow-ups.",
    route: "/activity",
    icon: "activity",
    metadata: "Page",
    keywords: ["activity", "timeline", "recent", "queue"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:sms",
    type: "page",
    title: "SMS",
    subtitle: "Manage SMS campaigns, messages, and automation flows.",
    route: "/sms",
    icon: "sms",
    metadata: "Page",
    keywords: ["sms", "text messages", "mobile", "campaigns"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:integrations",
    type: "page",
    title: "Integrations",
    subtitle: "Connect platforms, imports, automations, and infrastructure.",
    route: "/integrations",
    icon: "integrations",
    metadata: "Page",
    keywords: ["integrations", "connections", "apps", "sync"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:products",
    type: "page",
    title: "Products",
    subtitle: "Review your product catalog and merchandising details.",
    route: "/products",
    icon: "products",
    metadata: "Page",
    keywords: ["products", "catalog", "inventory", "items"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:analytics",
    type: "page",
    title: "Analytics",
    subtitle: "Inspect attribution, performance, and funnel reporting.",
    route: "/analytics",
    icon: "analytics",
    metadata: "Page",
    keywords: ["analytics", "reports", "metrics", "insights"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:website",
    type: "page",
    title: "Website",
    subtitle: "Open the website builder and storefront editing surface.",
    route: "/website/app",
    icon: "pages",
    metadata: "Page",
    keywords: ["website", "builder", "web", "storefront"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:publish",
    type: "page",
    title: "Publish Portal",
    subtitle: "Schedule and manage social publishing from one workspace.",
    route: "/publish",
    icon: "campaigns",
    metadata: "Page",
    keywords: ["publish", "post", "compose", "schedule", "social post"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:plan",
    type: "page",
    title: "Plan",
    subtitle: "Review subscription details, plan options, and upgrades.",
    route: "/plan",
    icon: "billing",
    metadata: "Page",
    keywords: ["plan", "pricing", "billing", "subscription"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:community",
    type: "page",
    title: "Community",
    subtitle: "See community content, conversations, and shared updates.",
    route: "/community",
    icon: "pages",
    metadata: "Page",
    keywords: ["community", "forum", "members", "discussion"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:settings",
    type: "page",
    title: "Settings",
    subtitle: "Manage workspace connections, compliance, and support.",
    route: "/settings",
    icon: "settings",
    metadata: "Page",
    keywords: ["settings", "preferences", "workspace", "configuration"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:profile",
    type: "page",
    title: "Profile",
    subtitle: "Update company branding, typography, and footer details.",
    route: "/profile",
    icon: "personas",
    metadata: "Page",
    keywords: ["profile", "brand", "company", "identity"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:account",
    type: "page",
    title: "Account",
    subtitle: "Adjust account information, billing, and deletion settings.",
    route: "/account",
    icon: "settings",
    metadata: "Page",
    keywords: ["account", "billing", "usage", "profile"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:domains",
    type: "page",
    title: "Domains",
    subtitle: "Verify sending domains, DNS records, and delivery setup.",
    route: "/domains",
    icon: "integrations",
    metadata: "Page",
    keywords: ["domains", "dns", "email", "verification"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:usage",
    type: "page",
    title: "Usage",
    subtitle: "Inspect current usage metrics, quotas, and account trends.",
    route: "/settings/usage",
    icon: "analytics",
    metadata: "Page",
    keywords: ["usage", "quotas", "analytics", "limits"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:support",
    type: "page",
    title: "Support",
    subtitle: "Open support resources, contact details, and help paths.",
    route: "/support",
    icon: "support",
    metadata: "Page",
    keywords: ["support", "help", "contact", "chat"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:help-desk",
    type: "ticket",
    title: "Help Desk",
    subtitle: "Review tickets, triage issues, and open support requests.",
    route: "/helpdesk",
    icon: "help",
    metadata: "Page",
    keywords: ["help desk", "tickets", "support", "issues"],
    group: "pages",
  }),
  createStaticItem({
    id: "static:page:account-setup",
    type: "page",
    title: "Account Setup",
    subtitle: "Complete onboarding tasks for channels, profiles, and sends.",
    route: "/account-setup",
    icon: "settings",
    metadata: "Page",
    keywords: ["setup", "onboarding", "checklist", "launch"],
    group: "pages",
  }),
];

const SEGMENT_ENTRIES: SearchResultItem[] = [
  createStaticItem({
    id: "static:segment:new-subscribers",
    type: "segment",
    title: "New Subscribers",
    subtitle: "System segment for recently acquired email subscribers.",
    route: "/crm/segments",
    icon: "segments",
    metadata: "System segment",
    keywords: ["new subscribers", "new leads", "opt in", "welcome"],
    group: "segments",
  }),
  createStaticItem({
    id: "static:segment:vip-customers",
    type: "segment",
    title: "VIP Customers",
    subtitle: "High-value customers ready for premium loyalty offers.",
    route: "/crm/segments",
    icon: "segments",
    metadata: "System segment",
    keywords: ["vip", "high value", "top spenders", "premium"],
    group: "segments",
  }),
  createStaticItem({
    id: "static:segment:loyal-customers",
    type: "segment",
    title: "Loyal Customers",
    subtitle: "Repeat buyers with strong engagement and purchase history.",
    route: "/crm/segments",
    icon: "segments",
    metadata: "System segment",
    keywords: ["loyal", "repeat buyers", "returning", "retention"],
    group: "segments",
  }),
  createStaticItem({
    id: "static:segment:needs-watering",
    type: "segment",
    title: "Needs Watering",
    subtitle: "Plant-care segment for customers likely due a reminder.",
    route: "/crm/segments",
    icon: "segments",
    metadata: "System segment",
    keywords: ["needs watering", "care reminders", "plant care", "watering"],
    group: "segments",
  }),
  createStaticItem({
    id: "static:segment:plant-killers",
    type: "segment",
    title: "Plant Killers",
    subtitle: "Customers who need beginner-friendly education and nudges.",
    route: "/crm/segments",
    icon: "segments",
    metadata: "System segment",
    keywords: ["plant killers", "beginner", "care help", "rescue"],
    group: "segments",
  }),
  createStaticItem({
    id: "static:segment:seasonal-shoppers",
    type: "segment",
    title: "Seasonal Shoppers",
    subtitle: "Customers who convert around holidays and seasonal events.",
    route: "/crm/segments",
    icon: "segments",
    metadata: "System segment",
    keywords: ["seasonal", "holiday", "gift buyers", "events"],
    group: "segments",
  }),
];

const PERSONA_ENTRIES: SearchResultItem[] = [
  createStaticItem({
    id: "static:persona:discount-hunters",
    type: "persona",
    title: "Discount Hunters",
    subtitle: "Shoppers who respond best to price drops and limited offers.",
    route: "/crm/personas",
    icon: "personas",
    metadata: "Persona",
    keywords: ["discount hunters", "deals", "sale seekers", "coupons"],
    group: "personas",
  }),
  createStaticItem({
    id: "static:persona:plant-parents",
    type: "persona",
    title: "Plant Parents",
    subtitle: "Engaged plant owners looking for care tips and supplies.",
    route: "/crm/personas",
    icon: "personas",
    metadata: "Persona",
    keywords: ["plant parents", "houseplants", "care tips", "growers"],
    group: "personas",
  }),
  createStaticItem({
    id: "static:persona:gift-buyers",
    type: "persona",
    title: "Gift Buyers",
    subtitle: "Customers shopping for occasions, bundles, and surprise sends.",
    route: "/crm/personas",
    icon: "personas",
    metadata: "Persona",
    keywords: ["gift buyers", "gifting", "occasions", "presents"],
    group: "personas",
  }),
  createStaticItem({
    id: "static:persona:home-decor-enthusiasts",
    type: "persona",
    title: "Home Decor Enthusiasts",
    subtitle: "Shoppers drawn to styling, decor pairings, and aesthetics.",
    route: "/crm/personas",
    icon: "personas",
    metadata: "Persona",
    keywords: ["home decor", "styling", "interiors", "design"],
    group: "personas",
  }),
  createStaticItem({
    id: "static:persona:wellness-seekers",
    type: "persona",
    title: "Wellness Seekers",
    subtitle: "Customers motivated by calm, wellness, and lifestyle benefits.",
    route: "/crm/personas",
    icon: "personas",
    metadata: "Persona",
    keywords: ["wellness", "mindful", "self care", "lifestyle"],
    group: "personas",
  }),
  createStaticItem({
    id: "static:persona:last-minute-shoppers",
    type: "persona",
    title: "Last Minute Shoppers",
    subtitle: "Urgent buyers who respond to reminders and fast-turn offers.",
    route: "/crm/personas",
    icon: "personas",
    metadata: "Persona",
    keywords: ["last minute", "urgent", "rush", "deadline"],
    group: "personas",
  }),
];

const INTEGRATION_ENTRIES: SearchResultItem[] = [
  createStaticItem({
    id: "static:integration:square",
    type: "integration",
    title: "Square",
    subtitle: "Connect Square POS for customers, orders, and loyalty sync.",
    route: "/integrations/square",
    icon: "integrations",
    metadata: "Integration",
    keywords: ["square", "pos", "point of sale", "payments"],
    group: "integrations",
  }),
  createStaticItem({
    id: "static:integration:clover",
    type: "integration",
    title: "Clover",
    subtitle: "Connect Clover POS data for sales and customer sync.",
    route: "/integrations/clover",
    icon: "integrations",
    metadata: "Integration",
    keywords: ["clover", "pos", "point of sale", "retail"],
    group: "integrations",
  }),
  createStaticItem({
    id: "static:integration:lightspeed-x-series",
    type: "integration",
    title: "Lightspeed X-Series",
    subtitle: "Bring Lightspeed retail data into BloomSuite workflows.",
    route: "/integrations/lightspeed",
    icon: "integrations",
    metadata: "Integration",
    keywords: ["lightspeed", "x-series", "pos", "retail"],
    group: "integrations",
  }),
  createStaticItem({
    id: "static:integration:shopify",
    type: "integration",
    title: "Shopify",
    subtitle: "Connect ecommerce orders, customers, and POS data.",
    route: "/integrations/shopify",
    icon: "integrations",
    metadata: "Integration",
    keywords: ["shopify", "ecommerce", "pos", "storefront"],
    group: "integrations",
  }),
  createStaticItem({
    id: "static:integration:meta",
    type: "integration",
    title: "Meta (Facebook & Instagram)",
    subtitle: "Manage Meta-linked social channels and publishing access.",
    route: "/integrations/meta",
    icon: "integrations",
    metadata: "Integration",
    keywords: ["meta", "facebook", "instagram", "social"],
    group: "integrations",
  }),
  createStaticItem({
    id: "static:integration:google-analytics-4",
    type: "integration",
    title: "Google Analytics 4",
    subtitle: "Connect GA4 for web attribution and traffic measurement.",
    route: "/integrations/google-analytics",
    icon: "analytics",
    metadata: "Integration",
    keywords: ["google analytics", "ga4", "analytics", "tracking"],
    group: "integrations",
  }),
  createStaticItem({
    id: "static:integration:mailchimp",
    type: "integration",
    title: "Mailchimp",
    subtitle: "Import contacts and connect legacy marketing lists.",
    route: "/integrations/mailchimp",
    icon: "integrations",
    metadata: "Integration",
    keywords: ["mailchimp", "email", "migration", "lists"],
    group: "integrations",
  }),
  createStaticItem({
    id: "static:integration:klaviyo",
    type: "integration",
    title: "Klaviyo",
    subtitle: "Review Klaviyo connection details and migration options.",
    route: "/integrations/klaviyo",
    icon: "integrations",
    metadata: "Integration",
    keywords: ["klaviyo", "email", "migration", "automation"],
    group: "integrations",
  }),
  createStaticItem({
    id: "static:integration:constant-contact",
    type: "integration",
    title: "Constant Contact",
    subtitle: "Open Constant Contact migration and integration details.",
    route: "/integrations/constant-contact",
    icon: "integrations",
    metadata: "Integration",
    keywords: ["constant contact", "email", "migration", "newsletters"],
    group: "integrations",
  }),
  createStaticItem({
    id: "static:integration:hubspot",
    type: "integration",
    title: "HubSpot",
    subtitle: "Inspect HubSpot connection setup and CRM sync possibilities.",
    route: "/integrations/hubspot",
    icon: "integrations",
    metadata: "Integration",
    keywords: ["hubspot", "crm", "marketing", "pipeline"],
    group: "integrations",
  }),
  createStaticItem({
    id: "static:integration:zapier",
    type: "integration",
    title: "Zapier",
    subtitle: "Connect no-code automations and external app workflows.",
    route: "/integrations/zapier",
    icon: "integrations",
    metadata: "Integration",
    keywords: ["zapier", "automation", "workflow", "no code"],
    group: "integrations",
  }),
  createStaticItem({
    id: "static:integration:slack",
    type: "integration",
    title: "Slack",
    subtitle: "Send BloomSuite notifications and alerts into Slack.",
    route: "/integrations/slack",
    icon: "integrations",
    metadata: "Integration",
    keywords: ["slack", "alerts", "notifications", "team"],
    group: "integrations",
  }),
  createStaticItem({
    id: "static:integration:custom-webhooks",
    type: "integration",
    title: "Custom Webhooks",
    subtitle: "Inspect webhook endpoints and external event delivery setup.",
    route: "/integrations/custom-webhooks",
    icon: "integrations",
    metadata: "Integration",
    keywords: ["webhooks", "custom webhooks", "api", "events"],
    group: "integrations",
  }),
  createStaticItem({
    id: "static:integration:email-infrastructure",
    type: "integration",
    title: "Email Infrastructure",
    subtitle: "Review sender domains, DNS, and delivery readiness.",
    route: "/integrations/email-infrastructure",
    icon: "integrations",
    metadata: "Integration",
    keywords: ["email infrastructure", "dns", "domains", "deliverability"],
    group: "integrations",
  }),
];

const FORM_FIELD_ENTRIES: SearchResultItem[] = [
  createStaticItem({
    id: "static:form-field:text-input",
    type: "form",
    title: "Text Input",
    subtitle: "Single-line text field for names, short answers, and notes.",
    route: "/crm/forms?create=1",
    icon: "forms",
    metadata: "Field type",
    keywords: ["text input", "text field", "short answer", "input"],
    group: "forms",
  }),
  createStaticItem({
    id: "static:form-field:email-address",
    type: "form",
    title: "Email Address Field",
    subtitle: "Validated email capture field for lead and customer forms.",
    route: "/crm/forms?create=1",
    icon: "forms",
    metadata: "Field type",
    keywords: ["email field", "email address", "lead capture", "contact"],
    group: "forms",
  }),
  createStaticItem({
    id: "static:form-field:phone-number",
    type: "form",
    title: "Phone Number Field",
    subtitle: "Collect mobile or landline numbers for follow-up and SMS.",
    route: "/crm/forms?create=1",
    icon: "forms",
    metadata: "Field type",
    keywords: ["phone field", "phone number", "sms", "mobile"],
    group: "forms",
  }),
  createStaticItem({
    id: "static:form-field:dropdown",
    type: "form",
    title: "Dropdown Field",
    subtitle: "Let visitors choose one option from a short predefined list.",
    route: "/crm/forms?create=1",
    icon: "forms",
    metadata: "Field type",
    keywords: ["dropdown", "select", "options", "single choice"],
    group: "forms",
  }),
  createStaticItem({
    id: "static:form-field:checkbox",
    type: "form",
    title: "Checkbox Field",
    subtitle: "Optional yes or no field for quick preferences and opt-ins.",
    route: "/crm/forms?create=1",
    icon: "forms",
    metadata: "Field type",
    keywords: ["checkbox", "boolean", "yes no", "opt in"],
    group: "forms",
  }),
  createStaticItem({
    id: "static:form-field:file-upload",
    type: "form",
    title: "File Upload Field",
    subtitle: "Collect attachments and uploads with client-side checks.",
    route: "/crm/forms?create=1",
    icon: "forms",
    metadata: "Field type",
    keywords: ["file upload", "attachments", "documents", "upload"],
    group: "forms",
  }),
  createStaticItem({
    id: "static:form-field:hidden",
    type: "form",
    title: "Hidden Field",
    subtitle: "Pass tracking values or metadata without showing the field.",
    route: "/crm/forms?create=1",
    icon: "forms",
    metadata: "Field type",
    keywords: ["hidden field", "metadata", "tracking", "invisible"],
    group: "forms",
  }),
  createStaticItem({
    id: "static:form-field:email-consent",
    type: "form",
    title: "Email Consent Field",
    subtitle: "Collect explicit permission for email marketing messages.",
    route: "/crm/forms?create=1",
    icon: "forms",
    metadata: "Field type",
    keywords: ["email consent", "consent", "privacy", "opt in"],
    group: "forms",
  }),
  createStaticItem({
    id: "static:form-field:sms-consent",
    type: "form",
    title: "SMS Consent Field",
    subtitle: "Collect explicit permission for text message marketing.",
    route: "/crm/forms?create=1",
    icon: "forms",
    metadata: "Field type",
    keywords: ["sms consent", "text consent", "tcpa", "opt in"],
    group: "forms",
  }),
  createStaticItem({
    id: "static:form-field:segment-checkbox",
    type: "form",
    title: "Segment Checkbox Field",
    subtitle: "Add submitters to a CRM segment when they check the box.",
    route: "/crm/forms?create=1",
    icon: "forms",
    metadata: "Field type",
    keywords: ["segment checkbox", "segment", "audience", "checkbox"],
    group: "forms",
  }),
];

const FORM_TEMPLATE_ENTRIES: SearchResultItem[] = [
  createStaticItem({
    id: "static:form-template:newsletter-signup",
    type: "form",
    title: "Newsletter Signup Template",
    subtitle:
      "Create a lightweight email signup form from the starter template.",
    route: "/crm/forms?template=newsletter-signup",
    icon: "forms",
    metadata: "Template",
    keywords: ["newsletter signup", "newsletter", "subscribe", "template"],
    group: "forms",
  }),
  createStaticItem({
    id: "static:form-template:vip-waitlist",
    type: "form",
    title: "VIP Waitlist Template",
    subtitle: "Start a VIP waitlist form with email and phone capture.",
    route: "/crm/forms?template=vip-waitlist",
    icon: "forms",
    metadata: "Template",
    keywords: ["vip waitlist", "waitlist", "exclusive", "template"],
    group: "forms",
  }),
  createStaticItem({
    id: "static:form-template:event-signup",
    type: "form",
    title: "Event Signup Template",
    subtitle: "Create an event registration form with a session selector.",
    route: "/crm/forms?template=event-signup",
    icon: "forms",
    metadata: "Template",
    keywords: ["event signup", "registration", "rsvp", "template"],
    group: "forms",
  }),
];

const AUTOMATION_PRESET_ENTRIES: SearchResultItem[] = [
  createStaticItem({
    id: "static:automation-preset:welcome-new-customers",
    type: "automation",
    title: "Welcome New Customers",
    subtitle: "Launch the preset welcome flow for first-time customers.",
    route: "/crm/automations/new/guide?preset=welcome_new_customers",
    icon: "automations",
    metadata: "Preset",
    keywords: ["welcome new customers", "welcome flow", "onboarding", "preset"],
    group: "automations",
  }),
  createStaticItem({
    id: "static:automation-preset:customer-loyalty-program",
    type: "automation",
    title: "Customer Loyalty Program",
    subtitle: "Launch the loyalty nurture preset with multi-step follow-up.",
    route: "/crm/automations/new/guide?preset=customer_loyalty_program",
    icon: "automations",
    metadata: "Preset",
    keywords: ["customer loyalty program", "loyalty", "nurture", "preset"],
    group: "automations",
  }),
];

const SETTINGS_ENTRIES: SearchResultItem[] = [
  createStaticItem({
    id: "static:setting:connections",
    type: "setting",
    title: "Connections",
    subtitle: "Manage POS, social, domain, and email connection settings.",
    route: "/settings?tab=connections",
    icon: "settings",
    metadata: "Settings page",
    keywords: ["connections", "integrations", "pos", "social"],
    group: "settings",
  }),
  createStaticItem({
    id: "static:setting:account-billing",
    type: "setting",
    title: "Account & Billing",
    subtitle: "Review billing controls, workspace details, and subscriptions.",
    route: "/settings?tab=account",
    icon: "billing",
    metadata: "Settings page",
    keywords: ["account billing", "billing", "subscription", "plan"],
    group: "settings",
  }),
  createStaticItem({
    id: "static:setting:compliance-privacy",
    type: "setting",
    title: "Compliance & Privacy",
    subtitle: "Review consent, privacy, and regulatory configuration.",
    route: "/settings?tab=compliance",
    icon: "settings",
    metadata: "Settings page",
    keywords: ["compliance", "privacy", "gdpr", "consent"],
    group: "settings",
  }),
  createStaticItem({
    id: "static:setting:debug",
    type: "setting",
    title: "Debug",
    subtitle: "Inspect diagnostics and troubleshooting context for support.",
    route: "/settings?tab=debug",
    icon: "settings",
    metadata: "Settings page",
    keywords: ["debug", "diagnostics", "troubleshooting", "logs"],
    group: "settings",
  }),
  createStaticItem({
    id: "static:setting:support-settings",
    type: "setting",
    title: "Support Settings",
    subtitle: "Open support resources, policies, and contact guidance.",
    route: "/settings?tab=support",
    icon: "support",
    metadata: "Settings page",
    keywords: ["support settings", "support", "help", "contact"],
    group: "settings",
  }),
  createStaticItem({
    id: "static:profile-tab:company-profile",
    type: "setting",
    title: "Company Profile",
    subtitle: "Update your company details, brand story, and basics.",
    route: "/profile/company",
    icon: "personas",
    metadata: "Profile tab",
    keywords: ["company profile", "profile", "business", "details"],
    group: "settings",
  }),
  createStaticItem({
    id: "static:profile-tab:contact-footer",
    type: "setting",
    title: "Contact Footer",
    subtitle: "Manage footer contact details used across campaigns.",
    route: "/profile/contact-footer",
    icon: "personas",
    metadata: "Profile tab",
    keywords: ["contact footer", "footer", "address", "contact"],
    group: "settings",
  }),
  createStaticItem({
    id: "static:profile-tab:brand-colors",
    type: "setting",
    title: "Brand Colors",
    subtitle: "Adjust the brand color palette used across your workspace.",
    route: "/profile/brand-colors",
    icon: "personas",
    metadata: "Profile tab",
    keywords: ["brand colors", "colors", "palette", "branding"],
    group: "settings",
  }),
  createStaticItem({
    id: "static:profile-tab:typography",
    type: "setting",
    title: "Typography",
    subtitle: "Configure fonts and type hierarchy for brand surfaces.",
    route: "/profile/typography",
    icon: "personas",
    metadata: "Profile tab",
    keywords: ["typography", "fonts", "type", "branding"],
    group: "settings",
  }),
  createStaticItem({
    id: "static:account-tab:general-account",
    type: "setting",
    title: "General Account",
    subtitle: "Review sign-in details, timezone, and profile preferences.",
    route: "/account?tab=general",
    icon: "settings",
    metadata: "Account tab",
    keywords: ["general account", "account", "timezone", "profile"],
    group: "settings",
  }),
  createStaticItem({
    id: "static:account-tab:business-profile",
    type: "setting",
    title: "Business Profile",
    subtitle: "Edit sender identity and business contact details.",
    route: "/account?tab=business",
    icon: "settings",
    metadata: "Account tab",
    keywords: ["business profile", "business", "sender", "company"],
    group: "settings",
  }),
  createStaticItem({
    id: "static:account-tab:billing-subscription",
    type: "setting",
    title: "Billing & Subscription",
    subtitle: "Inspect invoices, plans, and active subscription details.",
    route: "/account?tab=billing",
    icon: "billing",
    metadata: "Account tab",
    keywords: ["billing subscription", "billing", "subscription", "invoices"],
    group: "settings",
  }),
  createStaticItem({
    id: "static:account-tab:usage-analytics",
    type: "setting",
    title: "Usage & Analytics",
    subtitle: "Review usage data, trends, and account activity metrics.",
    route: "/account?tab=usage",
    icon: "analytics",
    metadata: "Account tab",
    keywords: ["usage analytics", "usage", "metrics", "activity"],
    group: "settings",
  }),
  createStaticItem({
    id: "static:account-tab:danger-zone",
    type: "setting",
    title: "Danger Zone",
    subtitle: "Handle destructive account actions and permanent deletion.",
    route: "/account?tab=danger",
    icon: "settings",
    metadata: "Account tab",
    keywords: ["danger zone", "delete account", "destructive", "warning"],
    group: "settings",
  }),
];

const SETUP_ENTRIES: SearchResultItem[] = [
  createStaticItem({
    id: "static:setup:brand-colors",
    type: "page",
    title: "Setup: Brand Colors",
    subtitle: "Confirm your brand colors before launching more channels.",
    route: "/settings",
    icon: "settings",
    metadata: "Onboarding step",
    keywords: ["setup brand colors", "brand colors", "onboarding", "palette"],
    group: "setup",
  }),
  createStaticItem({
    id: "static:setup:company-profile",
    type: "page",
    title: "Setup: Company Profile",
    subtitle: "Complete your company profile and sender identity details.",
    route: "/settings",
    icon: "settings",
    metadata: "Onboarding step",
    keywords: [
      "setup company profile",
      "company profile",
      "onboarding",
      "business",
    ],
    group: "setup",
  }),
  createStaticItem({
    id: "static:setup:connect-pos",
    type: "page",
    title: "Setup: Connect POS",
    subtitle: "Connect your point of sale to sync customers and sales.",
    route: "/integrations/pos",
    icon: "integrations",
    metadata: "Onboarding step",
    keywords: ["setup connect pos", "pos", "point of sale", "onboarding"],
    group: "setup",
  }),
  createStaticItem({
    id: "static:setup:import-customers",
    type: "page",
    title: "Setup: Import Customers",
    subtitle: "Bring your customer list into BloomSuite to power CRM tools.",
    route: "/integrations/crm",
    icon: "customers",
    metadata: "Onboarding step",
    keywords: [
      "setup import customers",
      "import customers",
      "crm",
      "onboarding",
    ],
    group: "setup",
  }),
  createStaticItem({
    id: "static:setup:email-domain",
    type: "page",
    title: "Setup: Email Domain",
    subtitle: "Verify a sending domain so campaigns can go live safely.",
    route: "/domains",
    icon: "integrations",
    metadata: "Onboarding step",
    keywords: ["setup email domain", "domain", "dns", "onboarding"],
    group: "setup",
  }),
  createStaticItem({
    id: "static:setup:social-accounts",
    type: "page",
    title: "Setup: Social Accounts",
    subtitle: "Connect the social accounts used for publishing and analytics.",
    route: "/social-accounts",
    icon: "pages",
    metadata: "Onboarding step",
    keywords: ["setup social accounts", "social", "channels", "onboarding"],
    group: "setup",
  }),
  createStaticItem({
    id: "static:setup:google-analytics",
    type: "page",
    title: "Setup: Google Analytics",
    subtitle: "Connect analytics tracking before publishing more content.",
    route: "/analytics",
    icon: "analytics",
    metadata: "Onboarding step",
    keywords: ["setup google analytics", "ga4", "analytics", "onboarding"],
    group: "setup",
  }),
  createStaticItem({
    id: "static:setup:sms-messaging",
    type: "page",
    title: "Setup: SMS Messaging",
    subtitle: "Prepare SMS campaigns and messaging permissions.",
    route: "/sms",
    icon: "sms",
    metadata: "Onboarding step",
    keywords: ["setup sms messaging", "sms", "text messages", "onboarding"],
    group: "setup",
  }),
  createStaticItem({
    id: "static:setup:first-email-campaign",
    type: "page",
    title: "Setup: First Email Campaign",
    subtitle: "Start your first email campaign from the CRM composer.",
    route: "/crm/campaigns/new",
    icon: "campaigns",
    metadata: "Onboarding step",
    keywords: [
      "setup first email campaign",
      "email campaign",
      "onboarding",
      "send",
    ],
    group: "setup",
  }),
  createStaticItem({
    id: "static:setup:first-social-post",
    type: "page",
    title: "Setup: First Social Post",
    subtitle: "Open publish tools and draft your first social post.",
    route: "/publish",
    icon: "campaigns",
    metadata: "Onboarding step",
    keywords: [
      "setup first social post",
      "social post",
      "publish",
      "onboarding",
    ],
    group: "setup",
  }),
  createStaticItem({
    id: "static:setup:first-automation",
    type: "page",
    title: "Setup: First Automation",
    subtitle: "Create your first automation workflow from guided setup.",
    route: "/crm/automations/new",
    icon: "automations",
    metadata: "Onboarding step",
    keywords: [
      "setup first automation",
      "automation",
      "workflow",
      "onboarding",
    ],
    group: "setup",
  }),
  createStaticItem({
    id: "static:setup:customer-segments",
    type: "page",
    title: "Setup: Customer Segments",
    subtitle: "Start organizing your audience into useful CRM segments.",
    route: "/crm/segments",
    icon: "segments",
    metadata: "Onboarding step",
    keywords: ["setup customer segments", "segments", "audience", "onboarding"],
    group: "setup",
  }),
  createStaticItem({
    id: "static:setup:newsletter",
    type: "page",
    title: "Setup: Newsletter",
    subtitle: "Draft and send your first newsletter from the newsletter tool.",
    route: "/newsletters/new",
    icon: "mail",
    metadata: "Onboarding step",
    keywords: ["setup newsletter", "newsletter", "email", "onboarding"],
    group: "setup",
  }),
];

const ACTION_ENTRIES: SearchResultItem[] = [
  createStaticItem({
    id: "command:ask-bloom",
    type: "action",
    title: "Ask Bloom",
    subtitle: "Ask Bloom about the page you're on without leaving your work.",
    route: "/bloom",
    icon: "saved-block",
    metadata: "Command",
    keywords: ["ask bloom", "bloom", "assistant", "ai", "question"],
    group: "actions",
  }),
  createStaticItem({
    id: "static:action:add-customer",
    type: "action",
    title: "Add Customer",
    subtitle: "Open the new customer form inside the CRM workspace.",
    route: "/crm/customers/new",
    icon: "customers",
    metadata: "Quick action",
    keywords: ["add customer", "new customer", "contact", "crm"],
    group: "actions",
  }),
  createStaticItem({
    id: "static:action:import-customers",
    type: "action",
    title: "Import Customers",
    subtitle: "Open the customer import flow for CSV and contact uploads.",
    route: "/crm/customers?import=1",
    icon: "customers",
    metadata: "Quick action",
    keywords: ["import customers", "csv", "upload contacts", "crm"],
    group: "actions",
  }),
  createStaticItem({
    id: "static:action:create-campaign",
    type: "action",
    title: "Create Campaign",
    subtitle: "Open the campaign composer to draft a new send.",
    route: "/crm/campaigns/new",
    icon: "campaigns",
    metadata: "Quick action",
    keywords: ["create campaign", "new campaign", "composer", "email"],
    group: "actions",
  }),
  createStaticItem({
    id: "static:action:create-segment",
    type: "action",
    title: "Create Segment",
    subtitle: "Start a new customer segment from the CRM audience tools.",
    route: "/crm/segments/new",
    icon: "segments",
    metadata: "Quick action",
    keywords: ["create segment", "new segment", "audience", "filters"],
    group: "actions",
  }),
  createStaticItem({
    id: "static:action:create-automation",
    type: "action",
    title: "Create Automation",
    subtitle: "Launch the automation builder for a new workflow.",
    route: "/crm/automations/new",
    icon: "automations",
    metadata: "Quick action",
    keywords: ["create automation", "new automation", "workflow", "journey"],
    group: "actions",
  }),
  createStaticItem({
    id: "static:action:create-form",
    type: "action",
    title: "Create Form",
    subtitle: "Open the form creation flow and template chooser.",
    route: "/crm/forms?create=1",
    icon: "forms",
    metadata: "Quick action",
    keywords: ["create form", "new form", "lead form", "builder"],
    group: "actions",
  }),
  createStaticItem({
    id: "static:action:compose-social-post",
    type: "action",
    title: "Compose Social Post",
    subtitle: "Jump into the social publishing workspace to draft a post.",
    route: "/publish",
    icon: "campaigns",
    metadata: "Quick action",
    keywords: ["compose social post", "social post", "publish", "draft"],
    group: "actions",
  }),
  createStaticItem({
    id: "static:action:send-email-campaign",
    type: "action",
    title: "Send Email Campaign",
    subtitle: "Open the email campaign flow with sending in mind.",
    route: "/crm/campaigns/new",
    icon: "campaigns",
    metadata: "Quick action",
    keywords: ["send email campaign", "email campaign", "broadcast", "send"],
    group: "actions",
  }),
  createStaticItem({
    id: "static:action:start-sms-campaign",
    type: "action",
    title: "Start SMS Campaign",
    subtitle: "Open the SMS campaign wizard for a new text blast.",
    route: "/sms/new",
    icon: "sms",
    metadata: "Quick action",
    keywords: ["start sms campaign", "sms campaign", "text blast", "mobile"],
    group: "actions",
  }),
  createStaticItem({
    id: "static:action:add-product",
    type: "action",
    title: "Add Product",
    subtitle: "Open the new product flow in the catalog workspace.",
    route: "/products/new",
    icon: "products",
    metadata: "Quick action",
    keywords: ["add product", "new product", "catalog", "inventory"],
    group: "actions",
  }),
  createStaticItem({
    id: "static:action:open-support-chat",
    type: "action",
    title: "Open Support Chat",
    subtitle: "Jump to support resources and start getting help.",
    route: "/support",
    icon: "support",
    metadata: "Quick action",
    keywords: ["open support chat", "support", "help", "chat"],
    group: "actions",
  }),
];

export const STATIC_SEARCH_REGISTRY: SearchResultItem[] = [
  ...PAGE_ENTRIES,
  ...SEGMENT_ENTRIES,
  ...PERSONA_ENTRIES,
  ...INTEGRATION_ENTRIES,
  ...FORM_FIELD_ENTRIES,
  ...FORM_TEMPLATE_ENTRIES,
  ...AUTOMATION_PRESET_ENTRIES,
  ...SETTINGS_ENTRIES,
  ...SETUP_ENTRIES,
  ...ACTION_ENTRIES,
];

const STATIC_SEARCH_ENTRY_MAP = new Map(
  STATIC_SEARCH_REGISTRY.map((item) => [item.id, item] as const),
);

const MIN_TRIGRAM_SIMILARITY = 0.15;
const MIN_STATIC_SEARCH_SCORE = 0.6;

type StaticSearchIndexEntry = {
  normalizedTitle: string;
  normalizedSubtitle: string;
  titleTokens: string[];
  keywords: string[];
  fuzzyCandidates: string[];
  fuzzyCandidateTrigrams: ReadonlySet<string>[];
};

type PreparedSearchQuery = {
  normalizedQuery: string;
  tokens: string[];
  trigrams: ReadonlySet<string>;
};

export const STATIC_QUICK_ACTION_IDS = [
  "static:action:add-customer",
  "static:action:import-customers",
  "static:action:create-campaign",
  "static:action:create-automation",
  "static:action:create-form",
  "static:action:start-sms-campaign",
] as const;

const DEFAULT_JUMP_TO_IDS = [
  "static:page:dashboard",
  "static:page:analytics",
  "static:page:calendar",
  "static:page:content-library",
  "static:page:publish",
  "static:page:settings",
] as const;

const CRM_JUMP_TO_IDS = [
  "static:page:customers",
  "static:page:campaigns",
  "static:page:segments",
  "static:page:personas",
  "static:page:automations",
  "static:page:forms",
] as const;

const INTEGRATIONS_JUMP_TO_IDS = [
  "static:page:integrations",
  "static:page:domains",
  "static:page:analytics",
  "static:page:settings",
  "static:page:support",
  "static:page:account-setup",
] as const;

const PUBLISH_JUMP_TO_IDS = [
  "static:page:publish",
  "static:page:content-library",
  "static:page:calendar",
  "static:page:social-media",
  "static:page:newsletters",
  "static:page:analytics",
] as const;

const SETTINGS_JUMP_TO_IDS = [
  "static:page:settings",
  "static:page:domains",
  "static:page:profile",
  "static:page:account",
  "static:page:usage",
  "static:page:support",
] as const;

const COMMERCE_JUMP_TO_IDS = [
  "static:page:products",
  "static:page:website",
  "static:page:publish",
  "static:page:analytics",
  "static:page:content-library",
  "static:page:plan",
] as const;

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const tokenizeValue = (value: string) =>
  normalizeSearchText(value).match(/[a-z0-9]+/g) ?? [];

function buildTrigramSet(value: string) {
  const normalized = normalizeSearchText(value);

  if (!normalized) {
    return new Set<string>();
  }

  const padded = `  ${normalized} `;
  const trigrams = new Set<string>();

  for (let index = 0; index <= padded.length - 3; index += 1) {
    trigrams.add(padded.slice(index, index + 3));
  }

  return trigrams;
}

function getTrigramSimilarity(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
) {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  const [smaller, larger] =
    left.size <= right.size ? [left, right] : [right, left];
  let intersectionCount = 0;

  for (const trigram of smaller) {
    if (larger.has(trigram)) {
      intersectionCount += 1;
    }
  }

  const unionCount = left.size + right.size - intersectionCount;

  return unionCount > 0 ? intersectionCount / unionCount : 0;
}

function getLevenshteinDistance(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  if (left.length === 0) {
    return right.length;
  }

  if (right.length === 0) {
    return left.length;
  }

  const previousRow = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  const currentRow = new Array<number>(right.length + 1).fill(0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    currentRow[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      currentRow[rightIndex] = Math.min(
        currentRow[rightIndex - 1] + 1,
        previousRow[rightIndex] + 1,
        previousRow[rightIndex - 1] + substitutionCost,
      );
    }

    for (let rightIndex = 0; rightIndex <= right.length; rightIndex += 1) {
      previousRow[rightIndex] = currentRow[rightIndex];
    }
  }

  return previousRow[right.length] ?? right.length;
}

function getNormalizedLevenshteinSimilarity(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);

  if (maxLength === 0) {
    return 1;
  }

  return 1 - getLevenshteinDistance(left, right) / maxLength;
}

const STATIC_SEARCH_INDEX = new Map<string, StaticSearchIndexEntry>(
  STATIC_SEARCH_REGISTRY.map((item) => {
    const normalizedTitle = normalizeSearchText(item.title);
    const normalizedSubtitle = normalizeSearchText(item.subtitle ?? "");
    const titleTokens = tokenizeValue(item.title);
    const keywords = Array.from(
      new Set(
        (item.keywords ?? [])
          .map((keyword) => normalizeSearchText(keyword))
          .filter(Boolean),
      ),
    );
    const fuzzyCandidates = Array.from(
      new Set([normalizedTitle, ...titleTokens, ...keywords].filter(Boolean)),
    );

    return [
      item.id,
      {
        normalizedTitle,
        normalizedSubtitle,
        titleTokens,
        keywords,
        fuzzyCandidates,
        fuzzyCandidateTrigrams: fuzzyCandidates.map((candidate) =>
          buildTrigramSet(candidate),
        ),
      },
    ] as const;
  }),
);

export function tokenizeSearchQuery(query: string) {
  return Array.from(new Set(tokenizeValue(query.trim())));
}

export function getStaticSearchItemById(id: string) {
  return STATIC_SEARCH_ENTRY_MAP.get(id) ?? null;
}

export function getStaticSearchItemForPathname(pathname: string) {
  const matchedItems = STATIC_SEARCH_REGISTRY.filter(
    (item) =>
      item.group !== "actions" && isCurrentRouteMatch(pathname, item.route),
  );

  if (matchedItems.length === 0) {
    return null;
  }

  return (
    matchedItems.sort(
      (left, right) =>
        right.route.length - left.route.length ||
        left.title.localeCompare(right.title),
    )[0] ?? null
  );
}

function resolveItemsById(ids: readonly string[], limit: number) {
  return ids
    .map((id) => getStaticSearchItemById(id))
    .filter((item): item is SearchResultItem => item !== null)
    .slice(0, limit);
}

export function getQuickActionEntries(limit: number = 6) {
  return resolveItemsById(STATIC_QUICK_ACTION_IDS, limit);
}

function prepareSearchQuery(
  queryOrTokens: string | string[],
): PreparedSearchQuery {
  const normalizedQuery = normalizeSearchText(
    typeof queryOrTokens === "string" ? queryOrTokens : queryOrTokens.join(" "),
  );
  const tokens =
    typeof queryOrTokens === "string"
      ? tokenizeSearchQuery(queryOrTokens)
      : Array.from(
          new Set(
            queryOrTokens
              .map((token) => normalizeSearchText(token))
              .filter(Boolean),
          ),
        );

  return {
    normalizedQuery,
    tokens,
    trigrams: buildTrigramSet(normalizedQuery),
  };
}

function getJumpToPriorityIds(pathname: string) {
  if (pathname.startsWith("/crm")) {
    return CRM_JUMP_TO_IDS;
  }

  if (
    pathname.startsWith("/integrations") ||
    pathname.startsWith("/domains") ||
    pathname.startsWith("/settings")
  ) {
    return pathname.startsWith("/settings")
      ? SETTINGS_JUMP_TO_IDS
      : INTEGRATIONS_JUMP_TO_IDS;
  }

  if (
    pathname.startsWith("/publish") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/social-accounts") ||
    pathname.startsWith("/newsletters")
  ) {
    return PUBLISH_JUMP_TO_IDS;
  }

  if (pathname.startsWith("/products") || pathname.startsWith("/website")) {
    return COMMERCE_JUMP_TO_IDS;
  }

  return DEFAULT_JUMP_TO_IDS;
}

export function getContextualJumpToEntries(
  pathname: string,
  limit: number = 6,
) {
  const ids: string[] = [];
  const seenIds = new Set<string>();
  const currentPage = PAGE_ENTRIES.find((item) =>
    isCurrentRouteMatch(pathname, item.route),
  );

  if (currentPage) {
    ids.push(currentPage.id);
    seenIds.add(currentPage.id);
  }

  for (const candidateId of getJumpToPriorityIds(pathname)) {
    if (!seenIds.has(candidateId)) {
      ids.push(candidateId);
      seenIds.add(candidateId);
    }
  }

  for (const candidate of PAGE_ENTRIES) {
    if (!seenIds.has(candidate.id)) {
      ids.push(candidate.id);
      seenIds.add(candidate.id);
    }
  }

  return resolveItemsById(ids, limit);
}

function scorePreparedStaticSearchItem(
  item: SearchResultItem,
  preparedQuery: PreparedSearchQuery,
) {
  if (!preparedQuery.normalizedQuery || preparedQuery.tokens.length === 0) {
    return 0;
  }

  const indexedItem = STATIC_SEARCH_INDEX.get(item.id);

  if (!indexedItem) {
    return 0;
  }

  let score = 0;

  if (indexedItem.normalizedTitle === preparedQuery.normalizedQuery) {
    score += 6;
  } else if (
    indexedItem.normalizedTitle.startsWith(preparedQuery.normalizedQuery)
  ) {
    score += 3.5;
  }

  if (indexedItem.titleTokens.includes(preparedQuery.normalizedQuery)) {
    score += 3;
  } else if (
    indexedItem.titleTokens.some((word) =>
      word.startsWith(preparedQuery.normalizedQuery),
    )
  ) {
    score += 2.4;
  }

  if (indexedItem.keywords.includes(preparedQuery.normalizedQuery)) {
    score += 2.6;
  } else if (
    indexedItem.keywords.some((keyword) =>
      keyword.includes(preparedQuery.normalizedQuery),
    )
  ) {
    score += 1.4;
  }

  if (indexedItem.normalizedSubtitle.includes(preparedQuery.normalizedQuery)) {
    score += 0.75;
  }

  const matchedTokenCount = preparedQuery.tokens.reduce((count, token) => {
    if (
      indexedItem.normalizedTitle.includes(token) ||
      indexedItem.titleTokens.some((word) => word.startsWith(token)) ||
      indexedItem.keywords.some((keyword) => keyword.includes(token)) ||
      indexedItem.normalizedSubtitle.includes(token)
    ) {
      return count + 1;
    }

    return count;
  }, 0);

  if (matchedTokenCount > 0) {
    score += (matchedTokenCount / preparedQuery.tokens.length) * 2.4;
  }

  const trigramSimilarity = indexedItem.fuzzyCandidateTrigrams.reduce(
    (bestScore, candidateTrigrams) =>
      Math.max(
        bestScore,
        getTrigramSimilarity(preparedQuery.trigrams, candidateTrigrams),
      ),
    0,
  );

  score += trigramSimilarity * 3;

  if (
    preparedQuery.normalizedQuery.length >= 3 &&
    trigramSimilarity < MIN_TRIGRAM_SIMILARITY
  ) {
    const levenshteinSimilarity = indexedItem.fuzzyCandidates.reduce(
      (bestScore, candidate) =>
        Math.max(
          bestScore,
          getNormalizedLevenshteinSimilarity(
            preparedQuery.normalizedQuery,
            candidate,
          ),
        ),
      0,
    );

    if (levenshteinSimilarity >= 0.7) {
      score += levenshteinSimilarity * 2;
    }
  }

  return score >= MIN_STATIC_SEARCH_SCORE ? score : 0;
}

export function scoreStaticSearchItem(
  item: SearchResultItem,
  queryOrTokens: string | string[],
) {
  return scorePreparedStaticSearchItem(item, prepareSearchQuery(queryOrTokens));
}

function buildGroups(items: SearchResultItem[]): SearchResultGroup[] {
  const buckets = new Map<SearchGroupKey, SearchResultItem[]>();
  let totalCount = 0;

  for (const category of SEARCH_GROUP_ORDER) {
    buckets.set(category, []);
  }

  for (const item of items) {
    if (totalCount >= 30) {
      break;
    }

    const bucket = buckets.get(item.group);

    if (!bucket || bucket.length >= 5) {
      continue;
    }

    bucket.push(item);
    totalCount += 1;
  }

  return SEARCH_GROUP_ORDER.flatMap((category) => {
    const results = buckets.get(category) ?? [];

    if (results.length === 0) {
      return [];
    }

    return {
      category,
      title: SEARCH_GROUP_METADATA[category].title,
      icon: SEARCH_GROUP_METADATA[category].icon,
      results,
    };
  });
}

export function searchStaticRegistry(query: string) {
  const preparedQuery = prepareSearchQuery(query);

  if (!preparedQuery.normalizedQuery || preparedQuery.tokens.length === 0) {
    return [];
  }

  const cachedGroups = staticSearchQueryCache.get(
    preparedQuery.normalizedQuery,
  );

  if (cachedGroups) {
    return cloneSearchGroups(cachedGroups);
  }

  const rankedItems = STATIC_SEARCH_REGISTRY.map((item) => ({
    item,
    score: scorePreparedStaticSearchItem(item, preparedQuery),
  }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.item.title.localeCompare(right.item.title),
    )
    .map(({ item }) => item);

  const groups = buildGroups(rankedItems);

  staticSearchQueryCache.set(
    preparedQuery.normalizedQuery,
    cloneSearchGroups(groups),
  );

  if (staticSearchQueryCache.size > STATIC_SEARCH_QUERY_CACHE_LIMIT) {
    const oldestKey = staticSearchQueryCache.keys().next().value;

    if (typeof oldestKey === "string") {
      staticSearchQueryCache.delete(oldestKey);
    }
  }

  return cloneSearchGroups(groups);
}
