import { meteredModelFetch, type SpendMeter } from "../bloom-assist/security/spend-cap.ts";

/** Bounded, tenant-metered model request; the caller must supply a verified tenant meter. */
export async function requestEnhancedImagePrompt(args: {
  key: string;
  meter: SpendMeter;
  systemPrompt: string;
  userPrompt: string;
}, fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await meteredModelFetch(args.meter, "enhance-image-prompt", "https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${args.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-6-luna",
      reasoning_effort: "none",
      store: false,
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userPrompt },
      ],
      max_completion_tokens: 200,
    }),
  }, fetchImpl);
  if (!response.ok) throw new Error("Image prompt enhancement unavailable");
  const data = await response.json();
  const choice = data.choices?.[0];
  if (choice?.finish_reason !== "stop" || choice.message?.refusal || typeof choice.message?.content !== "string" || !choice.message.content.trim()) {
    throw new Error("Image prompt enhancement unavailable");
  }
  return choice.message.content.trim();
}
