# BLOOM-M21: Reasoning Mode

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 4 — Advanced Modes
> **Milestone:** 21 of 40

---

## Objective

Implement Reasoning mode — when activated, Bloom shows its step-by-step thinking process in a collapsible "Thinking" block above the response. Uses prompted chain-of-thought with `<thinking>` / `<answer>` tags. The orchestrator parses these tags and streams them to separate UI regions.

---

## Scope

### Backend Changes

In `context-builder.ts`, when mode is `reasoning`:
- Append reasoning instruction to system prompt: "Think through the problem step-by-step before answering. Format as `<thinking>Step 1: ...\nStep 2: ...</thinking>\n<answer>Your answer</answer>`"
- Use gpt-4o for reasoning (better analytical capability)

In `stream-handler.ts`:
- Detect `<thinking>` opening tag in stream → switch to emitting `thinking_token` events
- Detect `</thinking>` closing tag → switch back to `token` events for `<answer>` content
- Strip the XML tags from the rendered output

### Frontend Changes

- `ThinkingBlock.tsx` (from M17) receives streaming thinking tokens
- During streaming: expanded, shows thinking trace appearing in real-time with `Typography` level="body-xs" color="neutral.500"
- On `done`: auto-collapses with smooth height animation
- Expand/collapse toggle: `IconButton` with ChevronDown/ChevronUp
- Left border accent: `borderLeft: 3px solid var(--joy-palette-primary-200)`

### Mode Chip Enhancement

In `BloomInputArea.tsx`:
- Reasoning mode chip (🧠) shows active state when selected: `JoyChip` variant="solid" color="primary"
- Tooltip: "Show Bloom's step-by-step reasoning"
- Keyboard shortcut: `⌘+1` for Standard, `⌘+2` for Reasoning, `⌘+3` for Research, `⌘+4` for Image

---

## Acceptance Criteria

- [ ] Reasoning mode adds chain-of-thought instruction to system prompt
- [ ] `<thinking>` content streams into ThinkingBlock in real-time
- [ ] `<answer>` content streams into main response area
- [ ] ThinkingBlock auto-collapses after streaming completes
- [ ] ThinkingBlock is expandable/collapsible with smooth animation
- [ ] Mode chip shows active state and has keyboard shortcut
- [ ] Thinking content stored separately in `bloom_messages.thinking_content`

---

## What NOT To Do

- Do NOT show thinking block for Standard mode — only Reasoning
- Do NOT use gpt-4o-mini for reasoning — use gpt-4o
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M22: Deep Research Mode

> **Copilot Thinking Effort:** XHigh
> **Branch:** `feature/bloom-assist`
> **Phase:** 4 — Advanced Modes
> **Milestone:** 22 of 40

---

## Objective

Implement Deep Research mode — a multi-step agent loop where Bloom plans a research approach, executes 5-15 tool calls, and synthesizes findings into a comprehensive report. A real-time progress indicator shows each step's status.

---

## Scope

### Backend: Agent Loop Enhancement

In `bloom-assist/index.ts`, when mode is `research`:
- System prompt adds: "You are in Deep Research mode. Plan your research approach first (list 4-8 steps). Execute each step using available tools. After all research, synthesize a comprehensive report."
- Agent loop limit increased to 15 (from 10 in standard)
- Each tool call emits `event: research_step` with `{ step_number, total_steps, label, status }`
- LLM generates a research plan before executing (streamed as `thinking_token` events)
- After all steps complete, LLM generates a synthesis report (streamed as `token` events)

### Frontend: Research Progress

**`src/components/bloom/blocks/ResearchProgressBlock.tsx`**:
- Joy `List` with `ListItem` for each step
- Each step shows: step number, label (`Typography` level="body-sm"), status indicator:
  - Pending: `CircularProgress` size="sm" with neutral color
  - Active: `CircularProgress` with primary color animation
  - Completed: Check circle icon in success color
  - Failed: X circle icon in danger color
- Steps appear one at a time as the agent progresses (animated with `framer-motion`)
- Below the step list: "Bloom is synthesizing findings..." message when all steps complete

### Example Flow

User: "Compare our email campaign performance across Q1 and Q2, identify what changed, and recommend improvements"

Research Plan (in ThinkingBlock):
1. Query Q1 campaigns → get metrics
2. Query Q2 campaigns → get metrics
3. Compare open rates, click rates, bounce rates
4. Check send times and subject line patterns
5. Analyze audience segment differences
6. Check deliverability changes
7. Synthesize findings and recommend improvements

Each step executes as a tool call with progress updates.

---

## Acceptance Criteria

- [ ] Deep Research mode triggers multi-step agent loop with 5-15 tool calls
- [ ] Research plan streams as thinking content before execution
- [ ] Real-time progress indicator shows each step's status
- [ ] Steps animate in one at a time
- [ ] Synthesis report generates after all steps complete
- [ ] Failed steps don't block subsequent steps
- [ ] Maximum 15 tool calls enforced
- [ ] Progress block uses Joy UI components exclusively

---

## What NOT To Do

- Do NOT allow more than 15 tool calls in research mode
- Do NOT skip the research plan — it must be visible to the user
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M23: Smart Suggestions & Time-Aware Greetings

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 4 — Advanced Modes
> **Milestone:** 23 of 40

---

## Objective

Make Bloom's home screen and follow-up suggestions context-aware — adapting to time of day, current page, recent activity, and user's tenant data. The home screen should feel alive and personalized, not static.

---

## Scope

### Home Screen Enhancement: `BloomHomeState.tsx`

**Time-aware greeting:**
- Resolve timezone from browser `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Morning (6-12): "Good morning, {name}. Here's your daily snapshot."
- Afternoon (12-17): "Here's how today is going so far."
- Evening (17-22): "Here's how today went."
- Night (22-6): "Working late? Here's what needs attention."

**Dynamic suggested prompts (4 cards):**
Instead of static prompts, generate contextual suggestions based on:
- Page context: if user navigated from `/crm/campaigns`, suggest campaign-related prompts
- Time: morning → "Show me yesterday's summary", evening → "How did today compare to last week?"
- Tenant data: if there are draft campaigns → "You have 3 draft campaigns — want to review them?"
- Recent activity: if user just created a customer → "Want to add them to a segment?"

Suggestions fetched from a lightweight helper in the orchestrator or pre-computed from `bloom_proactive_insights`.

**Daily snapshot card (optional, below prompts):**
A compact `JoyCard` with today's key numbers: revenue, new customers, orders, active campaigns. Fetched via `get_dashboard_summary` tool on page load. Shows `PageSkeleton` while loading.

### Follow-Up Chip Enhancement

Improve the LLM's follow-up chip generation by including the current context in the system prompt suffix:
"Generate 2-4 follow-up suggestion chips. Consider: the user's current page is {page}, they recently queried {recent_entities}, and their most common actions are {top_actions}."

---

## Acceptance Criteria

- [ ] Greeting adapts to time of day using browser timezone
- [ ] Suggested prompts adapt to page context, time, and tenant data
- [ ] Daily snapshot card shows real KPIs on home screen
- [ ] Follow-up chips are contextually relevant (not generic)
- [ ] All UI uses Joy UI — `JoyCard`, `Typography`, `JoyChip`, `Stack`
- [ ] Skeleton loading while suggestions/snapshot load

---

## What NOT To Do

- Do NOT hardcode greeting messages — compute from timezone
- Do NOT show the same 4 static prompts every time
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M24: Model Tier Routing & Token Optimization

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 4 — Advanced Modes
> **Milestone:** 24 of 40

---

## Objective

Implement the two-pass model routing strategy and response caching to optimize cost and speed. Simple queries route to gpt-4o-mini, complex queries to gpt-4o, content generation to gpt-4.1. Cache repeated read-only queries to avoid redundant LLM+tool calls.

---

## Scope

### Two-Pass Routing in Orchestrator

**Pass 1 — Intent Classification (gpt-4o-mini):**
- Already built in BLOOM-M03 (`intent-classifier.ts`)
- Enhance to also return a `complexity` score: `simple` (single tool, factual answer) vs `complex` (multi-tool, analysis)

**Pass 2 — Model Selection:**
| Intent + Complexity | Model | Tools Loaded |
|---|---|---|
| query + simple | gpt-4o-mini | query tools only |
| query + complex | gpt-4o | query + analytics tools |
| mutation (any) | gpt-4o | mutation + query tools |
| analytics (any) | gpt-4o | analytics + query tools |
| content (any) | gpt-4.1-2025-04-14 | content tools only |
| navigation (any) | gpt-4o-mini | navigate_to only |
| general (any) | gpt-4o | all tools |

### Response Caching

In `supabase/functions/bloom-assist/cache.ts`:
- In-memory `Map<string, CacheEntry>` in the Edge Function
- Cache key: `${tenantId}:${toolName}:${JSON.stringify(sortedParams)}`
- TTL per tool: `get_dashboard_summary` = 60s, `query_products` = 120s, `get_email_health` = 300s
- Invalidation: any mutation tool execution clears all cache entries for that entity type
- Cache only for read-only tools — never cache mutations

### Model Selector UI

In `BloomHeader.tsx`:
- `JoySelect` with options: "Bloom Standard" (gpt-4o-mini for simple), "Bloom Pro" (always gpt-4o), "Bloom Research" (gpt-4o with extended context)
- Selected model stored in `bloom_user_profiles.preferences.default_model`
- Manual model selection overrides the automatic routing

---

## Acceptance Criteria

- [ ] Intent classifier returns both category and complexity
- [ ] Model routing follows the mapping table above
- [ ] Response caching reduces redundant tool calls
- [ ] Cache invalidation works on mutations
- [ ] Model selector in header allows manual override
- [ ] Token counts tracked per model in `bloom_audit_log`
- [ ] Simple queries route to gpt-4o-mini (cost savings)
- [ ] Content generation routes to gpt-4.1 (matching existing CRM pattern)

---

## What NOT To Do

- Do NOT cache mutation tool results — reads only
- Do NOT override the user's manual model selection with auto-routing
- Do NOT generate test files or documentation
