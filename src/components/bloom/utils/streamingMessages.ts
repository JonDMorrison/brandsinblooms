/**
 * Phase-aware, tool-aware streaming status copy for the Bloom Assist loader.
 *
 * Pure functions only — no React, no side effects — so the message logic can be
 * unit-reasoned in isolation and consumed by `BloomStreamingIndicator`.
 *
 * Tool names mirror the live tool registry in
 * `supabase/functions/bloom-assist/tools/registry.ts`. Legacy/aliased names are
 * also mapped defensively so older payloads or renamed tools still resolve to
 * tailored copy instead of the generic fallback.
 */

export type StreamingPhase =
  | "connecting"
  | "thinking"
  | "tool_executing"
  | "generating"
  | "completing"
  | "idle";

export interface StreamingPhaseContext {
  /** The streaming connection state from `useBloomStreaming`. */
  connectionState?:
    | "idle"
    | "connecting"
    | "streaming"
    | "done"
    | "error"
    | (string & {});
  /** Active tool name, when a tool call is in flight. */
  toolName?: string | null;
  /** Whether assistant text has begun flowing into the live buffer. */
  hasPartialText?: boolean;
}

/**
 * Single connecting beat. Intentionally one short message — the connect phase is
 * brief, so cycling generic copy ("Establishing connection…", "Setting things
 * up…") only read as filler.
 */
export const CONNECTING_MESSAGE = "Connecting…";

export const THINKING_MESSAGES: readonly string[] = [
  "Thinking…",
  "Analyzing your request…",
  "Working through the details…",
  "Figuring out the best approach…",
  "Processing…",
  "Almost there…",
];

export const GENERATING_MESSAGES: readonly string[] = [
  "Writing response…",
  "Putting it together…",
  "Composing the answer…",
  "Finalizing…",
];

export const COMPLETING_MESSAGES: readonly string[] = [
  "Wrapping up…",
  "Finishing your response…",
  "Almost ready…",
];

/**
 * Shown while redundant post-tool text is suppressed and the result cards are
 * being organized into a clean summary.
 */
export const RENDERING_MESSAGES: readonly string[] = [
  "Organizing your results…",
  "Preparing the summary…",
  "Putting the finishing touches…",
  "Almost ready…",
];

/**
 * Per-tool message cycles. Keys are the live registry tool names, with common
 * legacy aliases included so renamed/older tools still resolve to tailored copy.
 */
export const TOOL_MESSAGES: Record<string, readonly string[]> = {
  // ── Customers ──────────────────────────────────────────────────────────
  query_customers: [
    "Searching your customers…",
    "Looking through customer records…",
    "Finding matching customers…",
  ],
  get_customer_detail: [
    "Loading full customer profile…",
    "Gathering customer history…",
  ],
  get_customer_timeline: [
    "Building the customer timeline…",
    "Tracing recent activity…",
  ],
  get_customer_insights: [
    "Analyzing customer behavior…",
    "Surfacing customer insights…",
  ],
  create_customer: ["Creating the customer…", "Saving customer details…"],
  update_customer: ["Updating customer…", "Saving customer changes…"],
  delete_customer: ["Removing customer…", "Deleting customer record…"],
  // legacy aliases
  search_customers: [
    "Searching your customers…",
    "Looking through customer records…",
  ],
  get_customer: ["Pulling up customer details…", "Loading customer profile…"],
  get_customer_details: [
    "Loading full customer profile…",
    "Gathering customer history…",
  ],
  lookup_customer: ["Looking up customer…", "Finding customer information…"],

  // ── Products ───────────────────────────────────────────────────────────
  query_products: [
    "Browsing your product catalog…",
    "Searching products…",
    "Looking through inventory…",
  ],
  get_product_detail: ["Loading product details…", "Pulling up product info…"],
  create_product: ["Creating the product…", "Saving product details…"],
  update_product: ["Updating product…", "Saving product changes…"],
  toggle_product_status: [
    "Updating product status…",
    "Changing product visibility…",
  ],
  // legacy aliases
  search_products: [
    "Browsing your product catalog…",
    "Searching products…",
    "Looking through inventory…",
  ],
  get_product: ["Loading product details…", "Pulling up product info…"],
  check_inventory: [
    "Checking stock levels…",
    "Scanning inventory…",
    "Counting available stock…",
  ],

  // ── Campaigns ──────────────────────────────────────────────────────────
  query_campaigns: [
    "Reviewing your campaigns…",
    "Loading campaign data…",
    "Looking through campaigns…",
  ],
  get_campaign_analytics: [
    "Crunching campaign numbers…",
    "Analyzing campaign performance…",
    "Loading campaign analytics…",
  ],
  create_campaign: ["Preparing campaign…", "Setting up your campaign…"],
  update_campaign: ["Updating campaign…", "Saving campaign changes…"],
  clone_campaign: ["Cloning campaign…", "Duplicating campaign…"],
  schedule_campaign: ["Scheduling your campaign…", "Setting the send time…"],
  send_campaign: [
    "Preparing campaign for delivery…",
    "Setting up campaign send…",
  ],
  pause_resume_campaign: [
    "Updating campaign status…",
    "Adjusting campaign delivery…",
  ],
  // legacy aliases
  search_campaigns: ["Reviewing your campaigns…", "Loading campaign data…"],
  get_campaign: ["Pulling up campaign details…", "Loading campaign metrics…"],
  get_campaign_stats: [
    "Crunching campaign numbers…",
    "Analyzing campaign performance…",
  ],

  // ── Orders ─────────────────────────────────────────────────────────────
  query_orders: [
    "Searching order history…",
    "Looking through orders…",
    "Finding matching orders…",
  ],
  // legacy aliases
  search_orders: ["Searching order history…", "Looking through orders…"],
  get_order: ["Loading order details…", "Pulling up order information…"],

  // ── Segments ───────────────────────────────────────────────────────────
  query_segments: ["Reviewing your segments…", "Loading segment data…"],
  get_segment_members: [
    "Loading segment members…",
    "Gathering the audience list…",
  ],
  create_segment: [
    "Building customer segment…",
    "Analyzing audience criteria…",
    "Segmenting your customers…",
  ],
  update_segment: ["Updating segment…", "Saving segment criteria…"],
  assign_segment: ["Assigning customers to segment…", "Updating the audience…"],
  compute_audience_size: [
    "Calculating audience size…",
    "Counting matching customers…",
  ],
  // legacy aliases
  build_segment: ["Building customer segment…", "Analyzing audience criteria…"],
  get_segment: ["Loading segment details…", "Pulling up segment criteria…"],

  // ── Tags & Personas ────────────────────────────────────────────────────
  query_tags: ["Loading your tags…", "Reviewing tags…"],
  create_tag: ["Creating the tag…", "Saving the new tag…"],
  bulk_tag_customers: ["Tagging customers…", "Applying tags in bulk…"],
  query_personas: ["Reviewing customer personas…", "Loading persona data…"],

  // ── Consent ────────────────────────────────────────────────────────────
  manage_consent: ["Updating consent preferences…", "Saving consent settings…"],

  // ── Analytics & Dashboard ──────────────────────────────────────────────
  get_dashboard_summary: [
    "Loading dashboard metrics…",
    "Gathering store performance data…",
  ],
  get_revenue_analytics: [
    "Calculating revenue…",
    "Tallying sales data…",
    "Analyzing revenue trends…",
  ],
  get_email_health: ["Checking email health…", "Reviewing deliverability…"],
  get_integration_status: [
    "Checking integration status…",
    "Reviewing connected services…",
  ],
  // legacy aliases
  get_analytics: [
    "Crunching the numbers…",
    "Analyzing your data…",
    "Building analytics report…",
  ],
  get_revenue: ["Calculating revenue…", "Tallying sales data…"],
  get_dashboard_stats: [
    "Loading dashboard metrics…",
    "Gathering store performance data…",
  ],

  // ── Knowledge ──────────────────────────────────────────────────────────
  search_knowledge: [
    "Searching your knowledge base…",
    "Looking through documentation…",
    "Finding relevant information…",
  ],

  // ── Content & Images ───────────────────────────────────────────────────
  generate_content: ["Generating content…", "Writing your content…"],
  generate_image: [
    "Creating your image…",
    "Generating artwork…",
    "Painting your vision…",
    "Crafting the image…",
  ],

  // ── Navigation ─────────────────────────────────────────────────────────
  navigate_to: ["Opening that page…", "Navigating there now…"],
  // legacy aliases
  navigate: ["Finding the right page…", "Locating that for you…"],
  navigate_to_page: ["Opening that page…", "Navigating there now…"],

  // ── Export ─────────────────────────────────────────────────────────────
  export_data: [
    "Preparing your export…",
    "Packaging data for download…",
    "Building export file…",
  ],

  // ── Task Plans (legacy) ────────────────────────────────────────────────
  create_task_plan: [
    "Building a task plan…",
    "Structuring your workflow…",
    "Planning the steps…",
  ],
  execute_task_step: [
    "Executing task step…",
    "Working through the plan…",
    "Processing this step…",
  ],
};

/**
 * Humanize an unknown tool name into a readable fallback ("query_widgets" →
 * "Query Widgets").
 */
function humanizeToolName(toolName: string): string {
  return toolName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Resolve the tailored message for a tool at the given cycle index. Falls back
 * to a humanized "Running …" label for tools without a curated catalog entry.
 */
export function getToolMessage(toolName: string, cycleIndex: number): string {
  const messages = TOOL_MESSAGES[toolName];
  if (messages && messages.length > 0) {
    return messages[cycleIndex % messages.length];
  }
  return `Running ${humanizeToolName(toolName)}…`;
}

/**
 * Derive the current streaming phase from the connection/tool/text signals.
 * Pure and deterministic — order of checks defines precedence.
 */
export function determinePhase(context: StreamingPhaseContext): StreamingPhase {
  const { connectionState, toolName, hasPartialText } = context;

  if (toolName) {
    return "tool_executing";
  }
  if (hasPartialText) {
    return "generating";
  }
  if (connectionState === "connecting") {
    return "connecting";
  }
  if (connectionState === "streaming") {
    return "thinking";
  }
  if (connectionState === "done") {
    return "completing";
  }
  return "idle";
}

/**
 * Resolve the message to display for a given phase + cycle index. The
 * `connecting` phase always returns the single connecting beat; tool messages
 * require `toolName` and fall back to the thinking sequence when absent.
 */
export function getStreamingMessage(
  phase: StreamingPhase,
  cycleIndex: number,
  toolName?: string | null,
): string {
  switch (phase) {
    case "connecting":
      return CONNECTING_MESSAGE;
    case "tool_executing":
      return toolName
        ? getToolMessage(toolName, cycleIndex)
        : THINKING_MESSAGES[cycleIndex % THINKING_MESSAGES.length];
    case "generating":
      return GENERATING_MESSAGES[cycleIndex % GENERATING_MESSAGES.length];
    case "completing":
      return COMPLETING_MESSAGES[cycleIndex % COMPLETING_MESSAGES.length];
    case "thinking":
      return THINKING_MESSAGES[cycleIndex % THINKING_MESSAGES.length];
    case "idle":
    default:
      return THINKING_MESSAGES[cycleIndex % THINKING_MESSAGES.length];
  }
}

/** Cycle the generic "organizing results" copy used by the content gate. */
export function getRenderingMessage(cycleIndex: number): string {
  return RENDERING_MESSAGES[cycleIndex % RENDERING_MESSAGES.length];
}
