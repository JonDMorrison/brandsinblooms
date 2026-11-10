/** One task at a time; Intelligence and Bloom share these destinations. */
export const INTELLIGENCE_VIEWS = [
  "overview",
  "explore",
  "growth",
  "rewards",
  "data",
] as const;
export type IntelligenceView = (typeof INTELLIGENCE_VIEWS)[number];

export function intelligenceView(value: string | null): IntelligenceView {
  return INTELLIGENCE_VIEWS.includes(value as IntelligenceView)
    ? (value as IntelligenceView)
    : "overview";
}

const PROVENANCE =
  "Work only from the selected company's recorded customer and purchase data. Explain exact filters, source coverage, and who is included, excluded, or unknown. Missing records are not zeros. Do not send messages, issue rewards, or change customers without explicit review and approval.";

export const INTELLIGENCE_QUESTIONS = {
  opportunities:
    "Find three useful opportunities to strengthen customer relationships. Look for meaningful purchase patterns, distinguish seasonal shoppers from genuinely slipping customers, and show source evidence and uncertainties.",
  discover:
    "Help me discover a precise audience using recorded purchases, products, departments, and visit history. Explain the filters, give exact included, excluded and unknown counts, then offer to save it as a reviewed segment.",
  slower:
    "Review customers with recorded slowing purchase momentum. Compare with their own comparable periods and seasonal patterns; do not assume a long gap means they are lapsed. Show who qualifies and which histories are insufficient.",
  gaps: "Find customers whose last recorded purchase was at least 120 days ago. Treat 120 days as an exploratory cutoff, not a lapsed classification. Check their historical purchasing seasons, spending and source coverage before suggesting contact.",
  loyal:
    "Explore recorded loyal and repeat customers, how their behaviour has changed, and what could make their next visit more valuable. Show why every proposed customer qualifies.",
  categories:
    "Which products or departments appear most frequently among recorded customer purchases? Give source-supported counts and distinguish purchase history from assumed interests.",
  rewards:
    "Help me design a garden-centre loyalty programme that encourages a second visit or win-back. Use an exact reviewed customer audience, budget and eligibility. Prepare a draft only; do not issue rewards or send messages.",
  sources:
    "Review the customer-intelligence sources available in this company. Explain which IdealPOS reports are grouped summaries, which contain individual dated transactions, and what is missing before reliable customer-growth comparisons can be made.",
} as const;

export type IntelligenceQuestion = keyof typeof INTELLIGENCE_QUESTIONS;

export function bloomIntelligencePrompt(question: string): string {
  const value = question.replace(/\s+/g, " ").trim();
  if (!value || value.length > 1400)
    throw new Error("Write a question with 1–1,400 characters.");
  const prompt = value + "\n\n" + PROVENANCE;
  if (prompt.length > 4000)
    throw new Error("This question exceeds Bloom's supported length.");
  return prompt;
}

/** URL contains only the user's question and an allow-listed return view, never customer records. */
export function bloomIntelligenceUrl(
  question: string,
  view: IntelligenceView = "overview",
): string {
  const params = new URLSearchParams({
    prompt: bloomIntelligencePrompt(question),
    origin: "intelligence",
    returnView: intelligenceView(view),
  });
  return "/bloom?" + params.toString();
}

export function productExplorationQuestion(product: string): string {
  const value = product.replace(/\s+/g, " ").trim();
  if (!value || value.length > 180)
    throw new Error("Enter a product name of up to 180 characters.");
  return (
    "Find customers with a recorded purchase matching the product " +
    JSON.stringify(value) +
    ". Show the exact matching rule and source dates, then let me narrow the same customer group to additional products or departments. Save only after I review the audience."
  );
}

export function growthExplainerQuestion(args: {
  baselineStart: string;
  baselineEnd: string;
  currentStart: string;
  currentEnd: string;
  currency: string;
  spendWeight: number;
  visitsWeight: number;
  perDayRates: boolean;
}): string {
  return [
    "Compare recorded customer growth from " +
      args.baselineStart +
      " through " +
      args.baselineEnd +
      " against " +
      args.currentStart +
      " through " +
      args.currentEnd +
      ".",
    "Use " +
      args.spendWeight +
      "% spending weight and " +
      args.visitsWeight +
      "% completed transaction count weight, in " +
      args.currency +
      ".",
    args.perDayRates
      ? "Use explicitly normalized per-day rates because I selected that comparison."
      : "Use raw totals only if the periods have equal lengths; otherwise explain the mismatch before calculating.",
    "Show customer-by-customer numerators, denominators, source coverage, the growth index relative to 100 and unknown history. Do not infer transactions from aggregated Ideal sales reports. Then identify which changes deserve a closer look.",
  ].join(" ");
}
