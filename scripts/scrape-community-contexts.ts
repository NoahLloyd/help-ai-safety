/**
 * scrape-community-contexts.ts
 *
 * Quickly visits the URLs of all communities and saves a chunk of the
 * page text to a local JSON file. This context can then be passed to an LLM
 * to generate custom descriptions and precise locations.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TIMEOUT_MS = 6000;
const CONCURRENCY = 20;
const OUTPUT_FILE = path.join(process.cwd(), "community-contexts.json");

async function fetchPageText(url: string) {
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,*/*",
      },
    });

    if (!res.ok) return `[HTTP ${res.status}]`;

    const html = await res.text();
    // Strip script and style tags completely
    const noScripts = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
    
    // Strip all HTML tags to get pure text
    const rawText = noScripts.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    
    // Grabbing first 1500 characters which usually contains "About us", location, purpose, etc.
    return rawText.slice(0, 1500); 
  } catch (err: any) {
    return `[Failed: ${err.message}]`;
  }
}

async function main() {
  console.log("🔍 Fetching communities from DB...");

  const { data: communities, error } = await supabase
    .from("resources")
    .select("id, title, url, location, source, source_org")
    .eq("category", "communities")
    .eq("enabled", true);

  if (error || !communities) {
    console.error("❌ Failed to fetch:", error?.message);
    process.exit(1);
  }

  console.log(`📋 Found ${communities.length} communities. Beginning scrape...`);

  const results: any[] = [];
  let checked = 0;

  async function processBatch(items: any[]) {
    let i = 0;
    async function next() {
      while (i < items.length) {
        const item = items[i++];
        const text = await fetchPageText(item.url);
        results.push({
          id: item.id,
          title: item.title,
          url: item.url,
          current_location: item.location,
          source_org: item.source_org,
          scraped_text: text,
        });
        
        checked++;
        if (checked % 50 === 0) {
          process.stdout.write(`\r   Scraped ${checked}/${items.length}`);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, next));
  }

  await processBatch(communities);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  console.log(`\n\n✅ Context scraping complete! Saved ${results.length} rows to ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
