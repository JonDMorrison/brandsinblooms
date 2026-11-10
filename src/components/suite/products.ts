export const SUITE_PRODUCTS = [
  { id: "crm", name: "BloomSuite CRM", headline: "Bring customers back.", description: "Turn customer insight into timely email, SMS, and campaigns your team can manage.", href: "/features", action: "Explore the CRM", category: "Customer relationships" },
  { id: "pos", name: "BloomSuite POS", headline: "Keep your store moving.", description: "A register and manager workspace built around plants, products, people, and the spring rush.", href: "/pos", action: "Explore the POS", category: "In-store operations" },
  { id: "sites", name: "BloomSites", headline: "Give customers a reason to visit.", description: "Build a website your team can update, showcase what’s in season, and sell online.", href: "https://bloomsites.app/", action: "Explore BloomSites", category: "Websites & online selling" },
] as const;

export const POS_DEMO_HREF = "/contact?product=pos";
// Keep account entry usable independently of the custom POS hostname.
export const POS_LOGIN_HREF = "/suite?product=pos";
export const POS_MANAGER_HREF = "https://bloomtill-backoffice-demo.vercel.app/";
export const POS_REGISTER_HREF = "https://bloomtill-till-demo.vercel.app/";
