/**
 * sync-communities.ts
 *
 * Fetches communities from:
 *   1. EA Forum           (GraphQL – ~449 local groups)
 *   2. LessWrong          (GraphQL – ~240 local groups)
 *   3. PauseAI            (GitHub JSON – ~96 chapters + ~28 adjacent)
 *   4. AISafety.com       (HTML scrape – ~200 communities)
 *
 * Then deduplicates by normalized URL (or name+location),
 * and upserts into the Supabase `resources` table.
 *
 * Usage:
 *   npx tsx scripts/sync-communities.ts              # live sync
 *   npx tsx scripts/sync-communities.ts --dry-run    # show what would change
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

// ─── Config ────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE env vars — check .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Types ─────────────────────────────────────────────────

interface CommunityEntry {
  title: string;
  description: string;
  url: string;
  source_org: string;
  location: string;
  source: string;
  source_id: string;
}

// ─── URL normalization ─────────────────────────────────────

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Strip www, trailing slash, query params, hash
    return (u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "")).toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

// ─── 1. EA Forum ───────────────────────────────────────────

async function fetchEAForumGroups(): Promise<CommunityEntry[]> {
  console.log("📡 Fetching EA Forum groups...");

  const query = `{
    localgroups(input: { terms: { limit: 2000 } }) {
      results {
        _id
        name
        location
        contents { plaintextDescription }
        website
        facebookLink
        types
        mongoLocation
        isOnline
      }
    }
  }`;

  const res = await fetch("https://forum.effectivealtruism.org/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const json = await res.json();
  const groups = json?.data?.localgroups?.results || [];
  console.log(`   → ${groups.length} groups`);

  return groups.map((g: any) => ({
    title: g.name,
    description: (g.contents?.plaintextDescription || "").slice(0, 500),
    url: g.website || g.facebookLink || `https://forum.effectivealtruism.org/groups/${g._id}`,
    source_org: "EA Forum",
    location: g.isOnline ? "Online" : (g.location || "Global"),
    source: "ea-forum",
    source_id: g._id,
  }));
}

// ─── 2. LessWrong ──────────────────────────────────────────

async function fetchLessWrongGroups(): Promise<CommunityEntry[]> {
  console.log("📡 Fetching LessWrong groups...");

  const query = `{
    localgroups(input: { terms: { limit: 2000 } }) {
      results {
        _id
        name
        location
        contents { plaintextDescription }
        website
        facebookLink
        types
        mongoLocation
        isOnline
      }
    }
  }`;

  const res = await fetch("https://www.lesswrong.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const json = await res.json();
  const groups = json?.data?.localgroups?.results || [];
  console.log(`   → ${groups.length} groups`);

  return groups.map((g: any) => ({
    title: g.name,
    description: (g.contents?.plaintextDescription || "").slice(0, 500),
    url: g.website || g.facebookLink || `https://www.lesswrong.com/groups/${g._id}`,
    source_org: "LessWrong",
    location: g.isOnline ? "Online" : (g.location || "Global"),
    source: "lesswrong",
    source_id: g._id,
  }));
}

// ─── 3. PauseAI ────────────────────────────────────────────

const PAUSEAI_BASE =
  "https://raw.githubusercontent.com/PauseAI/pauseai-website/main/src/routes/communities";

async function fetchPauseAIGroups(): Promise<CommunityEntry[]> {
  console.log("📡 Fetching PauseAI groups from GitHub...");

  const [mainRes, adjRes] = await Promise.all([
    fetch(`${PAUSEAI_BASE}/pauseai-communities.json`),
    fetch(`${PAUSEAI_BASE}/adjacent-communities.json`),
  ]);

  const mainData = await mainRes.json();
  const adjData = await adjRes.json();

  const pauseaiComms: any[] = mainData.communities || [];
  const adjacentComms: any[] = adjData.communities || [];

  console.log(`   → ${pauseaiComms.length} PauseAI chapters + ${adjacentComms.length} adjacent`);

  const entries: CommunityEntry[] = [];

  for (const c of pauseaiComms) {
    const city = c.name || "Unknown";
    const country = c.parent_name || "";
    const locationStr = country ? `${city}, ${country}` : city;

    // Build the best URL we can: their link field, or fallback to pauseai.info
    let url = "https://pauseai.info/communities";
    if (c.link && !c.link.startsWith("$$")) {
      url = c.link;
    }

    entries.push({
      title: `PauseAI ${city}`,
      description: `PauseAI local chapter in ${locationStr}. Join the movement advocating for responsible AI development.`,
      url,
      source_org: "PauseAI",
      location: locationStr,
      source: "pauseai",
      source_id: `pauseai-${city.toLowerCase().replace(/\s+/g, "-")}-${(country || "").toLowerCase().replace(/\s+/g, "-")}`,
    });
  }

  for (const c of adjacentComms) {
    if (!c.link || c.link.startsWith("$$")) continue;
    entries.push({
      title: c.name,
      description: `AI safety community listed on PauseAI.`,
      url: c.link,
      source_org: "PauseAI (adjacent)",
      location: "Global", // adjacent communities don't always have location
      source: "pauseai",
      source_id: `pauseai-adj-${c.name.toLowerCase().replace(/\s+/g, "-")}`,
    });
  }

  return entries;
}

// ─── 4. AISafety.com ───────────────────────────────────────

async function fetchAISafetyGroups(): Promise<CommunityEntry[]> {
  console.log("📡 Scraping AISafety.com communities...");

  const res = await fetch("https://www.aisafety.com/communities");
  const html = await res.text();

  // The page structure has community cards with names as h3 headings
  // and links as the wrapping <a> tags. We'll parse with regex
  // since we don't want to add a DOM parser dependency.
  //
  // Pattern: each community card is wrapped in an <a> tag with href,
  // containing an <h3> with the community name, followed by description text,
  // Platform info, Activity level, and Focus.

  const entries: CommunityEntry[] = [];

  // Match: <a href="URL">...<h3>NAME</h3>...DESCRIPTION...Platform\nPLATFORM...Activity level\nACTIVITY...Focus\nFOCUS...</a>
  // Simplified: find all <h3 class="...">NAME</h3> blocks

  // Find all groups by looking for the card pattern
  // Each community block starts with heading content and has a link
  const cardRegex = /<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi;

  let match;
  const seen = new Set<string>();

  while ((match = cardRegex.exec(html)) !== null) {
    const url = match[1];
    const rawName = match[2].replace(/<[^>]*>/g, "").trim();

    if (!rawName || !url || url === "#") continue;
    if (seen.has(rawName)) continue; // aisafety lists each community twice in their layout
    seen.add(rawName);

    // Skip non-community links (navigation etc.)
    if (url.startsWith("/") || url.includes("aisafety.com")) continue;

    entries.push({
      title: rawName,
      description: `AI safety community listed on AISafety.com.`,
      url: url.startsWith("http") ? url : `https://${url}`,
      source_org: "Other",
      location: "Global", // hard to parse location from the HTML
      source: "aisafety",
      source_id: `aisafety-${rawName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    });
  }

  console.log(`   → ${entries.length} communities parsed`);
  return entries;
}

// ─── Deduplication ─────────────────────────────────────────

function deduplicateCommunities(all: CommunityEntry[]): CommunityEntry[] {
  const byUrl = new Map<string, CommunityEntry>();
  const bySourceId = new Map<string, CommunityEntry>();

  // Priority: ea-forum > pauseai > aisafety > lesswrong
  const priority: Record<string, number> = {
    "ea-forum": 4,
    "pauseai": 3,
    "aisafety": 2,
    "lesswrong": 1,
  };

  for (const entry of all) {
    const normalUrl = normalizeUrl(entry.url);
    const existing = byUrl.get(normalUrl) || bySourceId.get(entry.source_id);

    if (existing) {
      // Keep the one with higher priority
      const existingPri = priority[existing.source] || 0;
      const newPri = priority[entry.source] || 0;
      if (newPri > existingPri) {
        // Replace with higher priority source
        byUrl.set(normalUrl, entry);
        bySourceId.set(entry.source_id, entry);
      }
    } else {
      byUrl.set(normalUrl, entry);
      bySourceId.set(entry.source_id, entry);
    }
  }

  return Array.from(byUrl.values());
}

// ─── Upsert to Supabase ────────────────────────────────────

async function syncToDatabase(communities: CommunityEntry[]) {
  console.log(`\n📦 Syncing ${communities.length} communities to database...`);

  // Fetch existing synced resources
  const { data: existing, error: fetchErr } = await supabase
    .from("resources")
    .select("id, source, source_id, url, title")
    .eq("category", "communities")
    .not("source", "eq", "manual");

  if (fetchErr) {
    console.error("❌ Failed to fetch existing resources:", fetchErr.message);
    return;
  }

  // Build maps for matching
  const bySourceId = new Map<string, any>();
  const byUrl = new Map<string, any>();
  for (const row of existing || []) {
    if (row.source_id) bySourceId.set(`${row.source}:${row.source_id}`, row);
    if (row.url) byUrl.set(normalizeUrl(row.url), row);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const comm of communities) {
    const key = `${comm.source}:${comm.source_id}`;
    const existingBySource = bySourceId.get(key);
    const existingByUrl = byUrl.get(normalizeUrl(comm.url));
    const match = existingBySource || existingByUrl;

    if (match) {
      // Check if anything meaningful changed
      const changed =
        match.title !== comm.title ||
        normalizeUrl(match.url) !== normalizeUrl(comm.url);

      if (changed) {
        if (DRY_RUN) {
          console.log(`   ✏️  UPDATE: "${match.title}" → "${comm.title}"`);
        } else {
          const { error } = await supabase
            .from("resources")
            .update({
              title: comm.title,
              description: comm.description,
              url: comm.url,
              source_org: comm.source_org,
              location: comm.location,
              source: comm.source,
              source_id: comm.source_id,
            })
            .eq("id", match.id);

          if (error) {
            console.error(`   ❌ Failed to update "${comm.title}":`, error.message);
          }
        }
        updated++;
      } else {
        skipped++;
      }
    } else {
      // New community — insert
      if (DRY_RUN) {
        console.log(`   ➕ INSERT: "${comm.title}" (${comm.source}) — ${comm.url}`);
      } else {
        const id = `sync-${comm.source}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const { error } = await supabase.from("resources").insert({
          id,
          title: comm.title,
          description: comm.description,
          url: comm.url,
          source_org: comm.source_org,
          category: "communities",
          location: comm.location,
          min_minutes: 5,
          ev_general: 0.3,
          friction: 0.1,
          enabled: true,
          status: "approved",
          created_at: new Date().toISOString(),
          source: comm.source,
          source_id: comm.source_id,
          background_tags: [],
          position_tags: [],
        });

        if (error) {
          console.error(`   ❌ Failed to insert "${comm.title}":`, error.message);
        }
      }
      inserted++;
    }
  }

  console.log(`\n✅ Sync complete${DRY_RUN ? " (DRY RUN)" : ""}:`);
  console.log(`   ${inserted} new communities${DRY_RUN ? " would be" : ""} inserted`);
  console.log(`   ${updated} communities${DRY_RUN ? " would be" : ""} updated`);
  console.log(`   ${skipped} unchanged (skipped)`);

  // Report communities that existed in DB but weren't found upstream
  const upstreamKeys = new Set(communities.map((c) => `${c.source}:${c.source_id}`));
  const stale = (existing || []).filter(
    (row) => row.source_id && !upstreamKeys.has(`${row.source}:${row.source_id}`)
  );
  if (stale.length > 0) {
    console.log(`   ⚠️  ${stale.length} resources in DB not found upstream (possibly stale):`);
    for (const s of stale.slice(0, 10)) {
      console.log(`      - "${s.title}" (${s.source})`);
    }
    if (stale.length > 10) console.log(`      ... and ${stale.length - 10} more`);
  }
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log(`🔄 Community Sync — ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`   ${new Date().toISOString()}\n`);

  // Fetch from all sources in parallel
  const [eaGroups, lwGroups, pauseaiGroups, aisafetyGroups] = await Promise.all([
    fetchEAForumGroups().catch((err) => {
      console.error("❌ EA Forum fetch failed:", err.message);
      return [] as CommunityEntry[];
    }),
    fetchLessWrongGroups().catch((err) => {
      console.error("❌ LessWrong fetch failed:", err.message);
      return [] as CommunityEntry[];
    }),
    fetchPauseAIGroups().catch((err) => {
      console.error("❌ PauseAI fetch failed:", err.message);
      return [] as CommunityEntry[];
    }),
    fetchAISafetyGroups().catch((err) => {
      console.error("❌ AISafety.com fetch failed:", err.message);
      return [] as CommunityEntry[];
    }),
  ]);

  console.log(`\n📊 Totals before dedup:`);
  console.log(`   EA Forum:    ${eaGroups.length}`);
  console.log(`   LessWrong:   ${lwGroups.length}`);
  console.log(`   PauseAI:     ${pauseaiGroups.length}`);
  console.log(`   AISafety:    ${aisafetyGroups.length}`);
  console.log(`   Raw total:   ${eaGroups.length + lwGroups.length + pauseaiGroups.length + aisafetyGroups.length}`);

  const all = [...eaGroups, ...lwGroups, ...pauseaiGroups, ...aisafetyGroups];
  const deduped = deduplicateCommunities(all);

  console.log(`   After dedup: ${deduped.length}`);

  await syncToDatabase(deduped);
}

main().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
