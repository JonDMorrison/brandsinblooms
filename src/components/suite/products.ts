export const SUITE_PRODUCTS = [
  { id: "crm", name: "BloomSuite CRM", headline: "Grow repeat business.", description: "Use available customer insights to send timely email and SMS campaigns that inspire another visit.", href: "/features", action: "Explore the CRM", category: "Customer relationships" },
  { id: "pos", name: "BloomSuite POS", headline: "Simplify your busiest days.", description: "A register and manager workspace built around plants, products, people, and the spring rush.", href: "/pos", action: "Explore the POS", category: "In-store operations" },
  { id: "sites", name: "BloomSites", headline: "Sell more plants online.", description: "Showcase seasonal plants, sell online, and manage events, fundraisers and preorders from your website.", href: "https://bloomsites.app/", action: "Explore BloomSites", category: "Websites & online selling" },
] as const;

export const POS_DEMO_HREF = "/contact?product=pos";
// Keep account entry usable independently of the custom POS hostname.
export const POS_LOGIN_HREF = "/suite?product=pos";
export const POS_MANAGER_HREF = "https://bloomtill-backoffice-demo.vercel.app/";
export const POS_REGISTER_HREF = "https://demo.bloomsuite.app/register/";
