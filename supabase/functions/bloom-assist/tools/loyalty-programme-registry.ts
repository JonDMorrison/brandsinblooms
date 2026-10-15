import type { ToolDefinition } from "./types.ts";
import type { JsonObject } from "../types.ts";
const object = (
  properties: JsonObject,
  required: string[] = [],
): JsonObject => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const page = {
  type: "integer",
  minimum: 1,
  maximum: 20000,
  description: "Page number. Results are explicitly paginated.",
};
const id = (description: string): JsonObject => ({
  type: "string",
  format: "uuid",
  description,
});
export const loyaltyProgrammeTools: ToolDefinition[] = [
  {
    type: "function",
    category: "query",
    risk_level: "safe",
    requires_confirmation: false,
    allowed_roles: ["admin", "staff", "viewer"],
    allowed_modes: ["standard", "reasoning", "research"],
    function: {
      name: "list_loyalty_programme_templates",
      description:
        "List the available rewards-led loyalty programme templates, their goals and required evidence. Templates are planning choices, not issued or redeemable rewards. Existing points and purchased gift cards remain separate.",
      parameters: object({}),
    },
  },
  {
    type: "function",
    category: "query",
    risk_level: "safe",
    requires_confirmation: false,
    allowed_roles: ["admin", "staff", "viewer"],
    allowed_modes: ["standard", "reasoning", "research"],
    function: {
      name: "list_loyalty_programmes",
      description:
        "Find this company’s saved loyalty programme versions and permanent baseline IDs. A saved draft or baseline is not an active reward. Read exact stored rules rather than inventing the eligibility thresholds. Requires company-wide customer/report access.",
      parameters: object({
        programme_id: id("Optional exact programme ID from a prior result."),
        page,
      }),
    },
  },
  {
    type: "function",
    category: "query",
    risk_level: "safe",
    requires_confirmation: false,
    allowed_roles: ["admin", "staff", "viewer"],
    allowed_modes: ["standard", "reasoning", "research"],
    function: {
      name: "read_loyalty_programme_results",
      description:
        "Read saved, immutable programme measurement. With baseline_id list its measured runs; with run_id inspect its exact cohort, dates, weights, source coverage, customer growth and observed post-message purchases. Never call observed sales causal lift; retain unscored/unknown customers and use pagination.",
      parameters: object({
        baseline_id: id("Baseline ID returned by list_loyalty_programmes."),
        run_id: id("Exact saved report ID. Do not invent this."),
        page,
      }),
    },
  },
];
