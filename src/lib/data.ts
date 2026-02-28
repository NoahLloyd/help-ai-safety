import { getSupabase } from "./supabase";
import { resources as localResources } from "@/data/resources";
import type { Resource, Variant, UserAnswers } from "@/types";

/**
 * Fetch all enabled, approved resources from Supabase.
 * Falls back to local seed data if Supabase isn't configured or fails.
 */
export async function fetchResources(): Promise<Resource[]> {
  const supabase = getSupabase();

  if (!supabase) {
    return localResources.filter((r) => r.enabled && r.status === "approved");
  }

  try {
    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .eq("enabled", true)
      .eq("status", "approved")
      .order("ev_general", { ascending: false });

    if (error) {
      console.error("Supabase fetch error, falling back to local:", error.message);
      return localResources.filter((r) => r.enabled && r.status === "approved");
    }

    return (data as Resource[]) || localResources.filter((r) => r.enabled && r.status === "approved");
  } catch (err) {
    console.error("Supabase connection error, falling back to local:", err);
    return localResources.filter((r) => r.enabled && r.status === "approved");
  }
}

/**
 * Track a click on a resource.
 * Fire-and-forget — don't block the user experience.
 */
export async function trackClick(
  resourceId: string,
  variant: Variant,
  answers: UserAnswers,
  geoCountry?: string
): Promise<void> {
  const supabase = getSupabase();

  if (!supabase) return;

  try {
    await supabase.from("resource_clicks").insert({
      resource_id: resourceId,
      variant,
      user_time: answers.time,
      user_intents: answers.intents || (answers.intent ? [answers.intent] : []),
      geo_country: geoCountry || null,
    });
  } catch {
    // Silently fail — never block UX for tracking
  }
}
