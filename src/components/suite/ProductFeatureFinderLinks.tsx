import topics from "../../../content/product-guide-topics.json";
const products = {
  crm: { name: 'CRM', href: '/crm/features', compare: '/crm/compare', description: 'Find the customer, email, SMS and reporting workflows that matter to your store.' },
  website: { name: 'Website Builder', href: '/website/features', compare: '/website/compare', description: 'Explore pages, design, seasonal content and the journeys that bring people to your store.' },
  ecomm: { name: 'E-commerce', href: '/ecomm/features', compare: '/ecomm/compare', description: 'Explore plant merchandising, checkout, pickup and specialist programs.' },
} as const;

export function ProductFeatureFinderLinks({ product }: { product: keyof typeof products }) {
  const item = products[product];
  const guideCount = Object.keys(topics[product].features).length;
  return <section aria-label={`${item.name} feature finder`} className="mx-auto my-8 w-[calc(100%-2rem)] max-w-6xl rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8">
    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Explore {item.name}</p>
    <h2 className="mt-2 text-2xl font-semibold text-slate-900 md:text-3xl">Find the features that fit your working day.</h2>
    <p className="mt-3 max-w-3xl text-base text-slate-600">{item.description} Browse {guideCount} practical guides and build your own demo shortlist.</p>
    <div className="mt-5 flex flex-wrap gap-3">
      <a className="inline-flex min-h-12 items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-base font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900" href={item.href}>Open the feature finder</a>
      <a className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900" href={item.compare}>Compare your options</a>
    </div>
  </section>;
}
