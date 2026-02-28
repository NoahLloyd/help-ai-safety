/**
 * generate-community-descriptions.ts
 *
 * Procedurally generates accurate but safely vague descriptions for all communities,
 * overwriting messy/scraped descriptions.
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

function generateDescription(title: string, location: string, source: string, sourceOrg: string) {
  const locStr = location && location !== "Global" && location !== "Online" ? `based in ${location}` : "operating globally";
  
  if (sourceOrg.startsWith("PauseAI") || source === "pauseai") {
    const city = title.replace("PauseAI", "").trim() || location;
    return `The local PauseAI action chapter ${locStr}. We are a community of advocates focused on halting high-risk AI development through public awareness, protests, and policy advocacy. Join us in coordinating for a safe and heavily regulated approach to artificial intelligence.`;
  }
  
  if (source === "ea-forum" || sourceOrg === "EA Forum") {
    return `An effective altruism community group ${locStr}. We bring together students, professionals, and altruists to organize reading groups, networking events, and discussions on high-impact causes, critical global issues, and existential risk reduction.`;
  }
  
  if (source === "lesswrong" || sourceOrg === "LessWrong") {
    return `A local meetup group for the LessWrong and rationalist community ${locStr}. Our gatherings focus on improving epistemic reasoning, practicing decision theory, and discussing technical alignment and AI safety research.`;
  }
  
  // Default for Other / aisafety.com
  return `A community hub for AI safety and alignment ${locStr}. We connect researchers, engineers, and concerned members of the public to discuss safely steering advanced artificial intelligence and reducing catastrophic risks to humanity.`;
}

async function main() {
  console.log("📡 Fetching all communities from Supabase...");
  
  const { data: communities, error } = await supabase
    .from("resources")
    .select("id, title, location, source, source_org, description")
    .eq("category", "communities");

  if (error) {
    console.error("❌ Failed to fetch:", error.message);
    process.exit(1);
  }

  console.log(`📋 Found ${communities.length} communities.`);

  let updatedCount = 0;
  
  console.log("📦 Generating custom descriptions and pushing to database...");
  
  for (const c of communities) {
    const newDesc = generateDescription(c.title || "", c.location || "", c.source || "", c.source_org || "");
    
    // Always overwrite for consistency
    const { error: upErr } = await supabase
      .from("resources")
      .update({ description: newDesc })
      .eq("id", c.id);
      
    if (upErr) {
      console.error(`❌ Failed tracking update for ${c.title}:`, upErr.message);
    } else {
      updatedCount++;
    }
    
    if (updatedCount % 50 === 0) {
      process.stdout.write(`\r   Updated ${updatedCount}/${communities.length}`);
    }
  }
  
  console.log(`\n✅ Done! Wrote beautiful custom descriptions for ${updatedCount} communities.`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
