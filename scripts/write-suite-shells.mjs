import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const escape = value => value.replace(/[&"<>]/g, character => ({"&":"&amp;",'"':"&quot;","<":"&lt;",">":"&gt;"}[character]));

export function suitePageShell(html, { title, description, url, image, robots = "index, follow" }) {
  const metadata = { description, "og:title": title, "og:description": description, "og:url": url, "twitter:title": title, "twitter:description": description, robots };
  if (image) { metadata["og:image"] = image; metadata["twitter:image"] = image; metadata["og:image:alt"] = "BloomSuite POS manager workspace with demonstration data"; metadata["twitter:image:alt"] = metadata["og:image:alt"]; }
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(title)}</title>`);
  for (const [name, content] of Object.entries(metadata)) {
    const pattern = new RegExp(`<meta\\s+(?:name|property)=["']${name}["'][^>]*>`, "g");
    html = html.replace(pattern, `<meta ${name.startsWith("og:") ? "property" : "name"}="${name}" content="${escape(content)}" />`);
  }
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/g, `<link rel="canonical" href="${escape(url)}" />`);
  // Homepage structured data does not describe this product-specific page.
  return html.replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const html = readFileSync("dist/index.html", "utf8");
  writeFileSync("dist/pos-marketing.html", suitePageShell(html, {
    title: "BloomSuite POS — Point of Sale for Garden Centres",
    description: "Explore BloomSuite POS: checkout, inventory, customers, and a manager workspace built for independent garden centres. Book a guided demo.",
    url: "https://bloomsuite.app/pos",
    image: "https://bloomsuite.app/pos/manager-workspace.webp",
  }));
  writeFileSync("dist/suite-builder.html", suitePageShell(html, {
    title: "Build your BloomSuite — Explore your setup",
    description: "Choose your website, marketing and checkout goals and explore a transparent draft estimate for your garden centre.",
    url: "https://bloomsuite.app/build-your-suite",
    robots: "noindex, follow",
  }));
  writeFileSync("dist/suite-portal.html", suitePageShell(html, {
    title: "Your BloomSuite products",
    description: "Open BloomSuite CRM, BloomSuite POS, or BloomSites and access your existing business workspace.",
    url: "https://bloomsuite.app/suite",
    robots: "noindex, follow",
  }));
}

