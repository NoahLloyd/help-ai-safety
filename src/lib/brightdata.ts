import type { EnrichedProfile, ApiUsageEntry } from "@/types";

const ENDPOINT = "https://api.brightdata.com/datasets/v3/trigger";
const DATASET_ID = "gd_l1viktl72bvl7bjuj0"; // LinkedIn People Profile

// ─── Types ──────────────────────────────────────────────────

interface BrightDataProfile {
  linkedin_id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  about?: string;
  city?: string;
  country_code?: string;
  current_company?: string;
  current_company_name?: string;
  avatar?: string;
  banner_image?: string;
  followers?: number;
  connections?: number;
  experience?: BrightDataExperience[];
  education?: BrightDataEducation[];
  certifications?: BrightDataCertification[];
  languages?: string[];
  skills?: string[];
  recommendations?: unknown[];
  courses?: unknown[];
  projects?: unknown[];
  organizations?: unknown[];
  url?: string;
}

interface BrightDataExperience {
  title?: string;
  company?: string;
  company_name?: string;
  description?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  duration?: string;
}

interface BrightDataEducation {
  school?: string;
  school_name?: string;
  degree?: string;
  field_of_study?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  activities?: string;
}

interface BrightDataCertification {
  name?: string;
  authority?: string;
  url?: string;
}

// ─── API Client ─────────────────────────────────────────────

function getToken(): string | null {
  return process.env.BRIGHTDATA_API_TOKEN || null;
}

/**
 * Scrape a LinkedIn profile using Bright Data's API.
 * Returns structured profile data directly — no LLM extraction needed.
 */
export async function scrapeWithBrightData(linkedinUrl: string): Promise<{
  profile: EnrichedProfile | null;
  usage: ApiUsageEntry;
}> {
  const usage: ApiUsageEntry = {
    provider: "scrape",
    endpoint: "brightdata-linkedin",
    estimated_cost_usd: 0.01, // ~$10/1K profiles
  };

  const token = getToken();
  if (!token) {
    return { profile: null, usage: { ...usage, estimated_cost_usd: 0 } };
  }

  // Normalize URL
  const normalized = linkedinUrl.match(/^https?:\/\//) ? linkedinUrl : `https://${linkedinUrl}`;
  if (!normalized.match(/linkedin\.com\/in\//i)) {
    return { profile: null, usage: { ...usage, estimated_cost_usd: 0 } };
  }

  try {
    const res = await fetch(
      `${ENDPOINT}?dataset_id=${DATASET_ID}&format=json&uncompressed_webhook=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{ url: normalized }]),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`[brightdata] API error ${res.status}:`, text);
      return { profile: null, usage };
    }

    const data = await res.json();

    // Bright Data may return a snapshot_id for async delivery,
    // or may return results directly depending on the endpoint
    if (data.snapshot_id) {
      // Async mode — poll for results
      const result = await pollForResults(token, data.snapshot_id);
      if (!result) return { profile: null, usage };
      return { profile: mapToEnrichedProfile(result, normalized), usage };
    }

    // Sync mode — data returned directly
    const profiles = Array.isArray(data) ? data : [data];
    if (profiles.length === 0) return { profile: null, usage };

    return { profile: mapToEnrichedProfile(profiles[0], normalized), usage };
  } catch (err) {
    console.error("[brightdata] Error:", err);
    return { profile: null, usage };
  }
}

// ─── Async Polling ──────────────────────────────────────────

async function pollForResults(
  token: string,
  snapshotId: string,
  maxAttempts = 10,
): Promise<BrightDataProfile | null> {
  const pollUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, 3000)); // Wait 3s between polls

    try {
      const res = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (res.status === 200) {
        const data = await res.json();
        const profiles = Array.isArray(data) ? data : [data];
        if (profiles.length > 0) return profiles[0];
      }
      // 202 = still processing, keep polling
      if (res.status !== 202) {
        console.error(`[brightdata] Poll returned ${res.status}`);
        return null;
      }
    } catch (err) {
      console.error("[brightdata] Poll error:", err);
    }
  }

  console.warn("[brightdata] Polling timed out after", maxAttempts, "attempts");
  return null;
}

// ─── Response Mapping ───────────────────────────────────────

function mapToEnrichedProfile(
  bd: BrightDataProfile,
  sourceUrl: string,
): EnrichedProfile | null {
  const fullName = bd.name || [bd.first_name, bd.last_name].filter(Boolean).join(" ") || undefined;
  if (!fullName && !bd.current_company && !bd.current_company_name) {
    return null;
  }

  // Parse experience
  const experience = (bd.experience || [])
    .filter((e) => e.company || e.company_name || e.title)
    .map((e) => ({
      title: e.title || "",
      company: e.company || e.company_name || "",
      description: e.description,
    }));

  // Parse education
  const education = (bd.education || [])
    .filter((e) => e.school || e.school_name)
    .map((e) => ({
      school: e.school || e.school_name || "",
      degree: e.degree,
      field: e.field_of_study,
      description: e.description,
      activities: e.activities,
    }));

  // Build skills array from multiple sources
  const skills: string[] = [];
  if (bd.skills?.length) skills.push(...bd.skills);
  if (bd.certifications?.length) {
    skills.push(
      ...bd.certifications.map((c) =>
        c.authority ? `${c.name} (${c.authority})` : c.name || "",
      ).filter(Boolean),
    );
  }
  if (bd.languages?.length) {
    skills.push(...bd.languages.map((l) => `Language: ${l}`));
  }

  // Location from city + country
  const location = bd.city
    ? bd.country_code
      ? `${bd.city}, ${bd.country_code}`
      : bd.city
    : bd.country_code || undefined;

  // Current title from first experience entry if not explicit
  const currentTitle = experience.length > 0 ? experience[0].title : undefined;

  return {
    fullName,
    headline: bd.headline,
    currentTitle,
    currentCompany: bd.current_company || bd.current_company_name,
    location,
    photo: bd.avatar,
    summary: bd.about,
    skills,
    experience,
    education,
    followers: bd.followers,
    platform: "linkedin",
    sourceUrl,
    linkedinUrl: bd.url || sourceUrl,
    fetchedAt: new Date().toISOString(),
    dataSource: "bright_data",
  };
}
