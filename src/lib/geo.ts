import { GeoData } from "@/types";

// Authoritarian countries where advocacy resources should be suppressed
const AUTHORITARIAN_COUNTRIES = new Set([
  "CN", "RU", "IR", "KP", "SA", "SY", "BY", "CU", "VE", "MM",
  "TM", "TJ", "EG", "AE", "QA", "BH", "OM",
]);

/**
 * Get geo data from free IP lookup services (HTTPS).
 * Tries multiple providers and falls back gracefully.
 */
export async function getGeoData(): Promise<GeoData> {
  // Try ipapi.co first (HTTPS, no key needed, 1k/day free)
  try {
    const res = await fetch("https://ipapi.co/json/", {
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.country_code && data.country_code !== "Undefined") {
        return {
          country: data.country_name || "Unknown",
          countryCode: data.country_code || "XX",
          city: data.city || undefined,
          region: data.region || undefined,
          timezone: data.timezone || undefined,
          isAuthoritarian: AUTHORITARIAN_COUNTRIES.has(data.country_code),
        };
      }
    }
  } catch {
    // Fall through to next provider
  }

  // Fallback: ip-api.com (HTTP only — works in dev/non-HTTPS contexts)
  try {
    const res = await fetch("http://ip-api.com/json/?fields=country,countryCode,city,regionName,timezone", {
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        country: data.country || "Unknown",
        countryCode: data.countryCode || "XX",
        city: data.city || undefined,
        region: data.regionName || undefined,
        timezone: data.timezone || undefined,
        isAuthoritarian: AUTHORITARIAN_COUNTRIES.has(data.countryCode),
      };
    }
  } catch {
    // Fall through to default
  }

  return defaultGeo();
}

function defaultGeo(): GeoData {
  // Try to infer country from timezone as a fallback
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return {
      country: "Unknown",
      countryCode: "XX",
      timezone: tz,
      isAuthoritarian: false,
    };
  } catch {
    return {
      country: "Unknown",
      countryCode: "XX",
      isAuthoritarian: false,
    };
  }
}
