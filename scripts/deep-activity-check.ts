/**
 * deep-activity-check.ts
 * 
 * Fetches the HTML of community URLs and performs aggressive heuristic scraping 
 * to determine if the community has had recent activity.
 * 
 * If it finds NO recent activity signals (e.g. 2025, upcoming, recent posts, etc.),
 * it marks the community as dead and sets its activity score to 0 so it won't 
 * show in public recommendations.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TIMEOUT_MS = 6000;
const CONCURRENCY = 15;

// Heuristic pattern for detecting any form of recency / activity
const RECENT_SIG_REGEX = /\b(2025|2026|upcoming|next event|next meetup|new event|recent post|latest post|hours? ago|days? ago|weeks? ago|months? ago|a day ago|an hour ago|a week ago)\b/i;

async function checkDeepActivity(url: string, title: string) {
  try {
    const getRes = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "text/html,*/*",
      },
    });

    if (!getRes.ok) {
      if (getRes.status === 403 || getRes.status === 429) {
        // Cloudflare / Anti-bot block. We cannot confidently say it's dead from content.
        return { status: "unknown", reason: `Blocked (${getRes.status}) - cannot scrape deeply` };
      }
      return { status: "dead", reason: `HTTP ${getRes.status}` };
    }

    const html = await getRes.text();

    if (RECENT_SIG_REGEX.test(html)) {
      return { status: "active", reason: "Found recent activity signals in HTML" };
    } else {
      // Very high chance it's completely abandoned if a modern page has zero of these terms
      return { status: "dead", reason: "No recent activity strings or dates found in HTML contents" };
    }
  } catch (err: any) {
    return { status: "unknown", reason: err.message?.slice(0, 60) || "Fetch failed" };
  }
}

async function main() {
  console.log("🔍 Deep Activity Heuristic Check...");

  const { data: communities, error } = await supabase
    .from("resources")
    .select("id, title, url, activity_score, url_status")
    .eq("category", "communities")
    .eq("enabled", true);

  if (error) {
    console.error("❌ Failed to fetch:", error.message);
    process.exit(1);
  }

  console.log(`📋 Checking ${communities.length} communities for deep inactivity...`);

  let checked = 0;
  let markedDead = 0;
  let active = 0;

  async function processBatch(items: any[]) {
    const results: { item: any; res: any }[] = [];
    let i = 0;
    async function next() {
      while (i < items.length) {
        const item = items[i++];
        const res = await checkDeepActivity(item.url, item.title);
        results.push({ item, res });
        
        checked++;
        if (checked % 50 === 0) {
          process.stdout.write(`\r   Checked ${checked}/${items.length} `);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, next));
    return results;
  }

  const results = await processBatch(communities);

  console.log("\n\n📦 Updating database for profoundly dead communities...");

  for (const { item, res } of results) {
    if (res.status === "dead") {
      // Ensure we only overwrite it if it's dead. We won't boost score if active here,
      // because we already have the structural verify-communities scoring.
      const { error } = await supabase
        .from("resources")
        .update({
          activity_score: 0.05,
          url_status: "dead",
          verification_notes: res.reason,
        })
        .eq("id", item.id);
        
      if (!error) {
        markedDead++;
      } else {
        console.error(`❌ DB error for ${item.title}: ${error.message}`);
      }
    } else if (res.status === "active") {
      active++;
    }
  }

  console.log(`\n✅ Deep scan complete!`);
  console.log(`   Actively found signals: ${active}`);
  console.log(`   Marked explicitly dead: ${markedDead}`);
  console.log(`   Check DB and adjust any false positives via Admin UI.`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
