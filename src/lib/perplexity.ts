import OpenAI from "openai";
import type { ApiUsageEntry } from "@/types";

// Perplexity's Sonar API is OpenAI-compatible
const BASE_URL = "https://api.perplexity.ai";
const MODEL = "sonar";

// Pricing: $1/M input, $1/M output
const INPUT_COST_PER_M = 1.0;
const OUTPUT_COST_PER_M = 1.0;

function getClient(): OpenAI | null {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: BASE_URL });
}

function buildUsage(
  response: OpenAI.Chat.ChatCompletion,
  endpoint: string,
): ApiUsageEntry {
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  return {
    provider: "perplexity",
    model: MODEL,
    endpoint,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost_usd:
      (inputTokens / 1_000_000) * INPUT_COST_PER_M +
      (outputTokens / 1_000_000) * OUTPUT_COST_PER_M,
  };
}

// ─── Search for a person - returns raw text ─────────────────

export async function searchPerson(query: string): Promise<{
  text: string | null;
  citations: string[];
  usage: ApiUsageEntry;
}> {
  const emptyUsage: ApiUsageEntry = {
    provider: "perplexity",
    endpoint: "search-person",
    estimated_cost_usd: 0,
  };

  const client = getClient();
  if (!client) {
    return { text: null, citations: [], usage: emptyUsage };
  }

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `Search for this specific person and report ONLY facts you can verify from search results. Do NOT guess, infer, or fill in gaps.

Output these sections (skip any section where you found nothing):

## Identity
- Full name
- Current job title and company
- Location

## Professional Background
- Current and past roles (only those explicitly found in sources)
- Key skills or areas of expertise mentioned in their profiles

## Education
- Schools, degrees, fields of study (only if explicitly stated)

## Public Presence
- Notable projects, publications, talks, or open-source work
- Any public writing, blog posts, or media appearances

IMPORTANT RULES:
- If the name is common, only include information you are confident belongs to THIS specific person. Look for consistency across sources.
- NEVER fabricate roles, companies, education, or achievements. If you only found a name and headline, report only that.
- If you found very little, say so explicitly. A short accurate response is far better than a long fabricated one.
- Do NOT include generic biographical filler or assumptions about someone's interests based on their field.
- Each fact should be traceable to a search result.`,
        },
        {
          role: "user",
          // Wrap in quotes if not already quoted to force exact-name matching
          content: query.startsWith('"') ? query : `"${query}"`,
        },
      ],
    });

    const usage = buildUsage(response, "search-person");
    const text = response.choices[0]?.message?.content || "";

    // Perplexity returns citations as a non-standard field on the response
    const citations: string[] =
      (response as unknown as { citations?: string[] }).citations ?? [];

    if (!text.trim()) {
      return { text: null, citations: [], usage };
    }

    return { text: text.trim(), citations, usage };
  } catch (err) {
    console.error("[perplexity] searchPerson failed:", err);
    return { text: null, citations: [], usage: emptyUsage };
  }
}
