import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Get the Supabase client (lazy-initialized).
 * Returns null if env vars aren't configured.
 *
 * Supports both:
 *  - NEXT_PUBLIC_SUPABASE_ANON_KEY (legacy anon key)
 *  - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (new format sb_publishable_xxx)
 */
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key || url.includes("your-project")) {
    return null;
  }

  _client = createClient(url, key);
  return _client;
}
