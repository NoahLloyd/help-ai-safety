import { Variant } from "@/types";

/**
 * Append UTM tracking params to an outbound URL.
 */
export function trackUrl(
  url: string,
  variant: Variant,
  resourceId: string
): string {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "howdoihelp");
    u.searchParams.set("utm_campaign", variant);
    u.searchParams.set("utm_content", resourceId);
    return u.toString();
  } catch {
    // If the URL is malformed, return as-is
    return url;
  }
}

/**
 * Format minutes into a human-readable time estimate.
 */
export function formatTime(minutes: number): string {
  if (minutes < 5) return "< 5 min";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 120) return `~1 hour`;
  if (minutes < 480) return `${Math.round(minutes / 60)} hours`;
  if (minutes < 1440) return `~1 day`;
  return `${Math.round(minutes / 480)} days`;
}
