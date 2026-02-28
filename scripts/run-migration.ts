import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function migrate() {
  // Use the Supabase SQL endpoint to run ALTER TABLE
  // We go through the management API's raw SQL execution
  const statements = [
    "ALTER TABLE resources ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'",
    "ALTER TABLE resources ADD COLUMN IF NOT EXISTS source_id TEXT",
  ];

  for (const sql of statements) {
    console.log(`Running: ${sql}`);
    const res = await fetch(`${url}/rest/v1/rpc/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    console.log(`  Status: ${res.status}`);
  }

  console.log("\nDone. Please run this SQL in the Supabase dashboard if the above failed:");
  console.log(`  ALTER TABLE resources ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';`);
  console.log(`  ALTER TABLE resources ADD COLUMN IF NOT EXISTS source_id TEXT;`);
  console.log(`  CREATE INDEX IF NOT EXISTS idx_resources_source_id ON resources (source, source_id);`);
}

migrate();
