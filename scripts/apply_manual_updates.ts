import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FILE_PATH = path.join(process.cwd(), process.argv[2]);

async function main() {
  if (!fs.existsSync(FILE_PATH)) {
    console.error("File not found:", FILE_PATH);
    process.exit(1);
  }

  const updates = JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
  console.log(`Applying ${updates.length} manual updates...`);

  let count = 0;
  for (const item of updates) {
    const { error } = await supabase
      .from("resources")
      .update({ description: item.description, location: item.location })
      .eq("id", item.id);
      
    if (error) {
      console.error(`Error updating ${item.id}:`, error.message);
    } else {
      count++;
    }
  }

  console.log(`Successfully applied ${count} manual updates to Supabase.`);
}

main().catch(console.error);
