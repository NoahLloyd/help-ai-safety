import type { ApiUsageEntry } from "@/types";

const ENDPOINT = "https://api.tavily.com/search";

// ─── Types ──────────────────────────────────────────────────

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
  answer?: string;
}

// ─── Client ─────────────────────────────────────────────────

function getApiKey(): string | null {
  return process.env.TAVILY_API_KEY || null;
}

// ─── People Search ──────────────────────────────────────────

/**
 * Search for a person using Tavily's search API.
 * Returns grounded search results — all content from real web pages.
 */
export async function searchPerson(query: string): Promise<{
  text: string | null;
  citations: string[];
  usage: ApiUsageEntry;
}> {
  const emptyUsage: ApiUsageEntry = {
    provider: "tavily",
    endpoint: "search-person",
    estimated_cost_usd: 0,
  };

  const apiKey = getApiKey();
  if (!apiKey) {
    return { text: null, citations: [], usage: emptyUsage };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${query} professional background experience education`,
        search_depth: "advanced",
        max_results: 8,
        include_answer: true,
        include_domains: [
          "linkedin.com",
          "github.com",
          "x.com",
          "twitter.com",
          "medium.com",
          "substack.com",
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.error(`[tavily] API error ${res.status}`);
      return { text: null, citations: [], usage: emptyUsage };
    }

    const data: TavilyResponse = await res.json();

    const usage: ApiUsageEntry = {
      provider: "tavily",
      endpoint: "search-person",
      estimated_cost_usd: 0.016, // 2 credits for advanced search @ ~$0.008/credit
    };

    if (!data.results || data.results.length === 0) {
      return { text: null, citations: [], usage };
    }

    // Build text from search results, grouped by source
    const sections: string[] = [];
    const citations: string[] = [];

    // Include Tavily's generated answer if available
    if (data.answer) {
      sections.push(`[Summary]\n${data.answer}`);
    }

    for (const result of data.results) {
      if (result.url) citations.push(result.url);
      if (result.content) {
        sections.push(`[Source: ${result.title || result.url}]\n${result.content}`);
      }
    }

    if (sections.length === 0) {
      return { text: null, citations, usage };
    }

    return {
      text: sections.join("\n\n"),
      citations,
      usage,
    };
  } catch (err) {
    console.error("[tavily] searchPerson failed:", err);
    return { text: null, citations: [], usage: emptyUsage };
  }
}
