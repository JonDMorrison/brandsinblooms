// Unknown marketing routes must not become indexable HTTP-200 application pages.
export default function handler(_request, response) {
  response.statusCode = 404;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
  response.setHeader('X-Robots-Tag', 'noindex, follow');
  response.end(`<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, follow"><title>Guide not found | BloomSuite</title><link rel="stylesheet" href="/product-guides/guides.css"></head><body><header class="guide-header"><div class="header-inner"><a class="brand" href="/">BloomSuite</a></div></header><main class="wrap compare-hero"><p class="eyebrow">404 / Find a useful next step</p><h1>This guide isn’t here.</h1><p class="lead">Explore the work behind your garden centre’s customer relationships, website and online store.</p><div class="actions"><a class="button" href="/crm/features">CRM features</a><a class="button secondary" href="/website/features">Website features</a><a class="button secondary" href="/ecomm/features">E-commerce features</a></div></main></body></html>`);
}
