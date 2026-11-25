// Missing files under /images/ answer 404 instead of the app's HTTP-200 page.
// Real files are served by Vercel before rewrites run, so only absent assets
// (such as the retired /images/newsletter-fallback.jpg) reach this.
export default function handler(_request, response) {
  response.statusCode = 404;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.setHeader("Cache-Control", "public, max-age=0, s-maxage=300");
  response.setHeader("X-Robots-Tag", "noindex");
  response.end("Not found");
}
