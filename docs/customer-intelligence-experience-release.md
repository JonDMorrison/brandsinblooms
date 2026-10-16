# BloomSuite Customer Intelligence — task-first UX

## Information architecture

The former monolithic Intelligence page mixed customer analyses, loyalty, IdealPOS exports and push-channel pilots. The new experience contains five explicit, addressable views using the existing /crm/intelligence?view= route:

1. Overview — three core jobs: find a customer group, understand change, give a reason to return. A small, evidence-aware customer snapshot and Bloom suggested questions.
2. Find customers — unchanged purchase exploration UI, saved audiences, exact filters and the existing Segment Builder link. Bloom carries an exploratory question into its conversation workspace.
3. Growth — existing CGI query engine, Phoenix date presets, weights, source evidence and paging in its own work area. Bloom carries the exact comparison settings, not client PII.
4. Rewards — existing loyalty planning, programme versions, immutable baselines, source-level comparisons and static segments. Existing ?programme= links remain supported.
5. Data & channels — POS integration entry, reviewed Ideal Customer Type export, push readiness and optional advanced pilot settings. Never silently activate the pilot.

Sections use URL state and remain mounted after their first visit, preserving in-page query inputs when moving between tabs.

## Bloom workflow

- Bloom appears immediately after the tab navigation, with tailored starter questions for each view.
- Every Ask Bloom interaction opens Bloom with a prefilled, editable question. Neither a model request nor a marketing action is automatically executed by opening the link.
- Prompts require the selected tenant's recorded data, included/excluded/unknown rules, source coverage and explicit user approval before communications or rewards. Existing Bloom customer search, ranking, programme reads and segment tools remain the authoritative engine.
- The origin and allow-listed returnView create a Back to Intelligence action. Arbitrary URLs from query parameters are never followed.
- Product follow-up prompts carry a quoted product phrase; Growth prompts carry the date window, weights, currency and normalization decision. No raw customer lists or private files are embedded in navigation URLs.
- Existing Bloom insight and conversation deep links continue to work.

## Data truth and performance

- Overview replaces the expensive per-customer lateral view with two separate tenant-scoped, RLS-authorized reads of active CRM customers and recorded purchase metrics; joins exact customer IDs and rejects duplicate identities.
- No value-at-risk prediction is made by summing historical customer spending, and no unsupported lapsed classification is presented as fact.
- Missing metrics remain null/unknown. A 120-day gap is a review prompt, not an automatic lapsed flag; seasonal patterns require a separate comparison.
- All population queries use existing full-pagination helpers, not first-page caps. Overview loads on demand, so opening another tab does not pull homepage metrics.
- Source failures show a retry while Bloom and other tools remain available.
- Switching companies isolates data by tenant and resets report state.

## Validation

- Full existing unit and component suite.
- Production Vite build.
- Dedicated desktop and mobile browser journey: responsive navigation, Bloom handoff and no horizontal overflow.
- Dedicated React tests of five sections, no eager heavy tools, successful and failed source states, customer-profile drilldown, Bloom prefill without auto-sending and safe return navigation.
- ESLint of changed application source.
- Browser fixture uses synthetic customer records and module aliases scoped to vite.intelligence-preview.config.ts. It is not a public production route or authentication bypass.

## Release boundaries

The design changes only navigation, presentation, lighter read queries and contextual Bloom handoffs. Existing customer purchase calculations, segments, subscription permissions, reward approvals and redemption, pilot controls and Ideal Customer Type authorization remain unchanged. No live customer data, reward balances, consent or communications change during this release.
