// GET /social-icon/:platform/:style/:hex.png (rewritten here by vercel.json)
// Returns a single-colour social icon PNG for email footers and social rows.
// The URL fully determines the image, so it is cached for a year.
import { parseSocialIconRequest, renderSocialIconPng } from "./_lib/socialIconPng.js";

export default function handler(request, response) {
  const url = new URL(request.url, "https://bloomsuite.app");
  const parsed = parseSocialIconRequest(
    url.searchParams.get("platform"),
    url.searchParams.get("style"),
    url.searchParams.get("color"),
  );

  if (!parsed) {
    response.statusCode = 404;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("Cache-Control", "public, max-age=300");
    response.end("Unknown social icon");
    return;
  }

  const png = renderSocialIconPng(parsed);
  response.statusCode = 200;
  response.setHeader("Content-Type", "image/png");
  response.setHeader("Content-Length", String(png.length));
  response.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.end(png);
}
