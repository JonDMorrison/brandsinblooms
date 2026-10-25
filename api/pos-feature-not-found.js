// Keep unknown feature URLs out of the application's HTTP-200 SPA fallback.
export default function handler(_request, response) {
  response.statusCode = 404;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
  response.setHeader('X-Robots-Tag', 'noindex, follow');
  response.end(`<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Feature not found | BloomSuite POS</title><meta name="robots" content="noindex, follow"><link rel="stylesheet" href="/pos/features-assets/features.css"></head><body><header class="site-header"><div class="header-inner"><a class="brand" href="/"><img src="/pos/features-assets/bloomsuite-logo.png" width="36" height="36" alt="">BloomSuite<span>POS</span></a></div></header><main class="wrap" style="padding-block:90px;min-height:70vh"><p class="eyebrow">404 / Let's find the right guide</p><h1>This feature page<br>isn't here.</h1><p class="lead">Explore the feature library to find checkout, inventory, receiving and the everyday jobs that matter to your garden centre.</p><div class="actions"><a class="button" href="/pos/features">Explore all POS features</a><a class="button secondary" href="/pos">POS overview</a></div></main></body></html>`);
}
