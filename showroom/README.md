# BloomSuite CRM public showroom

Public, no-login CRM demo for prospective garden centres. Tracking issue: Brands-In-Blooms/bloomtill#811.

Served at https://demo.bloomsuite.app/crm/ (the POS demo project proxies `/crm/*` to this build).

## How it works

`vite.showroom.config.ts` builds the real CRM (`src/App.tsx`, every real page and component) with two module swaps:

| Real module | Showroom module |
| --- | --- |
| `@/integrations/supabase/client` | `showroom/fake/client.ts` |
| `@/integrations/supabase/config` | `showroom/fake/config.ts` |

`showroom/fake/engine.ts` answers Supabase queries (select, filters, `or`, order, range, counts, single, insert, update, upsert, delete) from `showroom/fake/seed.ts`: Greenfield Garden Centre, 1,200 invented customers, segments, campaigns, forms and automations.

Visitor edits are kept in `sessionStorage` for that tab. Reset demo clears them.

## Safety boundary

- No Supabase client, session, service key or production tenant exists in this build.
- `showroom/networkGuard.ts` refuses any fetch, XHR or beacon that leaves the demo site.
- `showroom/vercel.json` sets `Content-Security-Policy: connect-src 'self'`, so the browser also refuses off-site requests.
- Edge functions that send, publish, upload or call AI return a clear demo message. Storage uploads are refused.
- Sign-in, sign-up and account changes are not available.

## Keeping it current

1. New page reads a table with no seed rows: it shows its empty state. Add rows to `seed.ts` if the page should look populated.
2. New RPC the page depends on: add a handler in `client.ts` (`rpcs`). Unknown `get_*`/`list_*` RPCs return `[]`; others return `null`.
3. Anything that sends, publishes or spends money must stay blocked. Extend `blockedRpc` if a new RPC name does not match it.
4. Run `npx vitest run __tests__/showroomClient.test.ts` and `pnpm exec vite build --config vite.showroom.config.ts`.

Local: `pnpm exec vite --config vite.showroom.config.ts`, then open http://127.0.0.1:4195/crm/.
