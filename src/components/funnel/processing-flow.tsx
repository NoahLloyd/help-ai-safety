"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchResources } from "@/lib/data";
import { rankResources, buildLocalCard } from "@/lib/ranking";
import { getGeoData } from "@/lib/geo";
import { getUserId, upsertUser } from "@/lib/user";
import { identifyGeo, trackResultsViewed } from "@/lib/tracking";
import type {
  EnrichedProfile,
  ProfilePlatform,
  Resource,
  GeoData,
  Variant,
  UserAnswers,
  ScoredResource,
  LocalCard,
  RecommendedResource,
} from "@/types";

// ─── Types ──────────────────────────────────────────────────

export type ResultItem =
  | { kind: "resource"; scored: ScoredResource; customDescription?: string }
  | { kind: "local"; card: LocalCard | null };

type InputType = "linkedin" | "github" | "name" | "other_url" | "x" | "instagram";

/** Strip markdown formatting for plain-text display */
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")           // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")     // bold
    .replace(/\*(.+?)\*/g, "$1")         // italic
    .replace(/__(.+?)__/g, "$1")         // bold alt
    .replace(/_(.+?)_/g, "$1")           // italic alt
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/\[\d+\]/g, "")            // citation markers [1], [2]
    .replace(/^[-*+]\s+/gm, "")          // list items
    .replace(/^\d+\.\s+/gm, "")          // numbered lists
    .replace(/`([^`]+)`/g, "$1")         // inline code
    .replace(/```[\s\S]*?```/g, "")      // code blocks
    .replace(/>\s+/g, "")               // blockquotes
    .replace(/\n{3,}/g, "\n\n")          // excessive newlines
    .trim();
}

/** Extract snippet lines from Perplexity text, preferring bullet-list content */
function extractSnippetLines(text: string, maxItems = 4): string[] {
  const cleaned = stripMarkdown(text);
  const lines = cleaned.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  // Find the first cluster of short lines (bullet-list-style content)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 10) continue;
    // If this line and the next are both reasonably short, it's likely a list
    if (line.length < 120 && i + 1 < lines.length && lines[i + 1].length < 120) {
      return lines
        .slice(i, i + maxItems)
        .map((l) => l.length > 80 ? l.slice(0, 77).trimEnd() + "..." : l);
    }
  }

  // Fallback: first meaningful line
  const first = lines.find((l) => l.length > 20) || lines[0] || "";
  return [first.length > 80 ? first.slice(0, 77).trimEnd() + "..." : first];
}

/** Build a rich Perplexity search query from profile data */
function buildSearchQuery(profile: EnrichedProfile): string {
  const parts: string[] = [];
  if (profile.fullName) parts.push(profile.fullName);
  if (profile.currentTitle) parts.push(profile.currentTitle);
  if (profile.currentCompany) parts.push(profile.currentCompany);
  if (parts.length === 1 && profile.headline) {
    // Name only — add headline for disambiguation
    parts.push(profile.headline.slice(0, 60));
  }
  return parts.join(", ");
}

/** What the user currently sees */
interface ViewState {
  /** The status message shown with the spinner */
  statusText: string;
  /** Profile card (name, photo, headline) — shown when available */
  profile?: EnrichedProfile;
  /** Detail tags from enrichment (skills, experience, repos) */
  details?: string[];
  /** Citations/links being checked — shown when available */
  citations?: string[];
  /** Short snippet lines from search results */
  snippetLines?: string[];
}

interface ProcessingFlowProps {
  input: string;
  inputType: InputType;
  platform: ProfilePlatform;
  variant: Variant;
  profileText?: string;
  onComplete: (
    items: ResultItem[],
    geo: GeoData,
    answers: UserAnswers,
  ) => void;
}

// ─── Helpers ────────────────────────────────────────────────

/** Wait for a minimum duration so the user can absorb what's on screen */
function minWait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extract a display-friendly hostname from a URL */
function urlToHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Build detail tags from an enriched profile */
function buildDetailTags(profile: EnrichedProfile): string[] {
  const tags: string[] = [];

  // Current role
  if (profile.currentTitle && profile.currentCompany) {
    tags.push(`${profile.currentTitle} at ${profile.currentCompany}`);
  } else if (profile.currentCompany) {
    tags.push(profile.currentCompany);
  }

  // Top skills (first 4)
  for (const skill of (profile.skills || []).slice(0, 4)) {
    if (skill.length < 40 && !skill.startsWith("Volunteer:") && !skill.startsWith("Publication:") && !skill.startsWith("Language:")) {
      tags.push(skill);
    }
  }

  // Top repos for GitHub
  if (profile.repos) {
    for (const repo of profile.repos.slice(0, 3)) {
      tags.push(repo.language ? `${repo.name} (${repo.language})` : repo.name);
    }
  }

  // Education (first 2)
  for (const edu of (profile.education || []).slice(0, 2)) {
    if (edu.school) tags.push(edu.school);
  }

  // Experience (first 2, skip if we already have currentTitle)
  if (!profile.currentTitle) {
    for (const exp of (profile.experience || []).slice(0, 2)) {
      if (exp.company) tags.push(exp.title ? `${exp.title}, ${exp.company}` : exp.company);
    }
  }

  return tags.slice(0, 6); // Max 6 tags
}

// ─── Main Component ─────────────────────────────────────────

export function ProcessingFlow({
  input,
  inputType,
  platform,
  variant,
  profileText,
  onComplete,
}: ProcessingFlowProps) {
  const [view, setView] = useState<ViewState>({
    statusText: inputType === "name"
      ? "Searching for you online..."
      : inputType === "github"
        ? "Looking up your GitHub..."
        : inputType === "x"
          ? "Looking up your X profile..."
          : inputType === "instagram"
            ? "Looking up your Instagram..."
            : "Looking up your profile...",
  });

  const hasRun = useRef(false);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    runPipeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runPipeline() {
    let enrichedProfile: EnrichedProfile | undefined;
    let rawProfileText: string | undefined = profileText;
    let searchCitations: string[] = [];
    let resources: Resource[] = [];
    let geo: GeoData = { country: "Unknown", countryCode: "XX", isAuthoritarian: false };

    // Start fetching resources + geo in background immediately
    const bgFetch = Promise.all([fetchResources(), getGeoData()]);

    // ─── LinkedIn Flow ──────────────────────────────────

    if (inputType === "linkedin") {
      // Step 1: Quick scrape
      try {
        const res = await fetch("/api/scrape-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: input }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            enrichedProfile = data.profile;
            setView({
              statusText: "Analyzing your background...",
              profile: data.profile,
            });
          }
        }
      } catch { /* continue */ }

      // Step 2: Full enrichment (Claude extraction) — run alongside a min delay
      const [enrichResult] = await Promise.all([
        fetch("/api/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: input }),
        }).then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            return data.profile as EnrichedProfile | null;
          }
          return null;
        }).catch(() => null),
        minWait(2500), // Let the profile card breathe
      ]);

      if (enrichResult) {
        enrichedProfile = enrichResult;
        // Show enrichment details (skills, experience tags)
        const details = buildDetailTags(enrichResult);
        if (details.length > 0) {
          setView((prev) => ({
            ...prev,
            profile: enrichResult,
            details,
            statusText: `Searching for more about ${enrichResult.fullName || "you"}...`,
          }));
          await minWait(2000); // Let them read the details
        }
      }

      // Step 3: Perplexity search — richer query with more context
      if (enrichedProfile?.fullName) {
        const query = buildSearchQuery(enrichedProfile);

        setView((prev) => ({
          ...prev,
          statusText: `Searching for more about ${enrichedProfile!.fullName}...`,
        }));

        try {
          const [searchRes] = await Promise.all([
            fetch("/api/search-profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query }),
            }),
            minWait(1500),
          ]);

          if (searchRes.ok) {
            const data = await searchRes.json();
            if (data.text) {
              rawProfileText = data.text;
              searchCitations = data.citations ?? [];
              // Transition: hide profile/details, show search results
              setView({
                statusText: "Reading through what we found...",
                citations: searchCitations,
                snippetLines: extractSnippetLines(data.text),
              });
              await minWait(2000);
            }
          }
        } catch { /* continue */ }
      }

    // ─── GitHub Flow ────────────────────────────────────

    } else if (inputType === "github") {
      try {
        const [scrapeRes] = await Promise.all([
          fetch("/api/scrape-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: input }),
          }),
          minWait(1000),
        ]);
        if (scrapeRes.ok) {
          const data = await scrapeRes.json();
          if (data.profile) {
            enrichedProfile = data.profile;
            const details = buildDetailTags(data.profile);
            setView({
              statusText: "Searching for more about you...",
              profile: data.profile,
              details: details.length > 0 ? details : undefined,
            });
          }
        }
      } catch { /* continue */ }

      // Step 2: Perplexity search for richer context
      const searchQuery = enrichedProfile?.fullName
        ? buildSearchQuery(enrichedProfile)
        : input.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/[/?#].*$/, "");

      try {
        const [searchRes] = await Promise.all([
          fetch("/api/search-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: searchQuery }),
          }),
          minWait(2000), // Let profile + repos breathe
        ]);
        if (searchRes.ok) {
          const data = await searchRes.json();
          if (data.text) {
            rawProfileText = data.text;
            searchCitations = data.citations ?? [];
            // Transition: hide profile/details, show search results
            setView({
              statusText: "Reading through what we found...",
              citations: searchCitations,
              snippetLines: extractSnippetLines(data.text),
            });
            await minWait(2000);
          }
        }
      } catch { /* continue */ }

    // ─── X (Twitter) Flow ────────────────────────────────

    } else if (inputType === "x") {
      // Step 1: Quick scrape for OG tags
      try {
        const [scrapeRes] = await Promise.all([
          fetch("/api/scrape-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: input }),
          }),
          minWait(1000),
        ]);
        if (scrapeRes.ok) {
          const data = await scrapeRes.json();
          if (data.profile) {
            enrichedProfile = data.profile;
            setView({
              statusText: "Searching for more about you...",
              profile: data.profile,
            });
          }
        }
      } catch { /* continue */ }

      // Step 2: Perplexity search with richer context
      const searchQuery = enrichedProfile?.fullName
        ? buildSearchQuery(enrichedProfile)
        : input.replace(/^https?:\/\/(x\.com|twitter\.com)\//, "").replace(/[/?#].*$/, "");

      try {
        const [searchRes] = await Promise.all([
          fetch("/api/search-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: searchQuery }),
          }),
          minWait(1500),
        ]);
        if (searchRes.ok) {
          const data = await searchRes.json();
          if (data.text) {
            rawProfileText = data.text;
            searchCitations = data.citations ?? [];
            // Transition: hide profile, show search results
            setView({
              statusText: "Reading through what we found...",
              citations: searchCitations,
              snippetLines: extractSnippetLines(data.text),
            });
            await minWait(2000);
          }
        }
      } catch { /* continue */ }

    // ─── Instagram Flow ──────────────────────────────────

    } else if (inputType === "instagram") {
      // Step 1: Quick scrape for OG tags
      try {
        const [scrapeRes] = await Promise.all([
          fetch("/api/scrape-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: input }),
          }),
          minWait(1000),
        ]);
        if (scrapeRes.ok) {
          const data = await scrapeRes.json();
          if (data.profile) {
            enrichedProfile = data.profile;
            setView({
              statusText: "Searching for more about you...",
              profile: data.profile,
            });
          }
        }
      } catch { /* continue */ }

      // Step 2: Perplexity search with richer context
      const searchQuery = enrichedProfile?.fullName
        ? buildSearchQuery(enrichedProfile)
        : input.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/[/?#].*$/, "");

      try {
        const [searchRes] = await Promise.all([
          fetch("/api/search-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: searchQuery }),
          }),
          minWait(1500),
        ]);
        if (searchRes.ok) {
          const data = await searchRes.json();
          if (data.text) {
            rawProfileText = data.text;
            searchCitations = data.citations ?? [];
            // Transition: hide profile, show search results
            setView({
              statusText: "Reading through what we found...",
              citations: searchCitations,
              snippetLines: extractSnippetLines(data.text),
            });
            await minWait(2000);
          }
        }
      } catch { /* continue */ }

    // ─── Name Search Flow ───────────────────────────────

    } else if (inputType === "name") {
      if (rawProfileText) {
        // Already have text — just show it
        setView({
          statusText: "Building your personalized plan...",
          snippetLines: extractSnippetLines(rawProfileText),
        });
      } else {
        try {
          const res = await fetch("/api/search-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: input }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.text) {
              rawProfileText = data.text;
              searchCitations = data.citations ?? [];
              setView({
                statusText: "Reading through what we found...",
                citations: searchCitations,
                snippetLines: extractSnippetLines(data.text),
              });
              await minWait(2500); // Let them see the sources
            }
          }
        } catch { /* continue */ }
      }

    // ─── Other URL Flow ─────────────────────────────────

    } else {
      try {
        const res = await fetch("/api/scrape-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: input }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            enrichedProfile = data.profile;
            if (data.profile.fullName) {
              setView({
                statusText: "Searching for more about you...",
                profile: data.profile,
              });
            }
          }
        }
      } catch { /* continue */ }

      // Try Perplexity if we got a name from the scrape
      if (enrichedProfile?.fullName) {
        const query = buildSearchQuery(enrichedProfile);
        try {
          const [searchRes] = await Promise.all([
            fetch("/api/search-profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query }),
            }),
            minWait(1500),
          ]);
          if (searchRes.ok) {
            const data = await searchRes.json();
            if (data.text) {
              rawProfileText = data.text;
              searchCitations = data.citations ?? [];
              setView({
                statusText: "Reading through what we found...",
                citations: searchCitations,
                snippetLines: extractSnippetLines(data.text),
              });
              await minWait(2000);
            }
          }
        } catch { /* continue */ }
      }
    }

    // ─── Fetch resources + geo (likely already done) ────

    setView((prev) => ({
      ...prev,
      statusText: "Building your personalized plan...",
    }));

    const [fetchedResources, fetchedGeo] = await bgFetch;
    resources = fetchedResources;
    geo = fetchedGeo;
    identifyGeo(geo.countryCode);

    // ─── Generate recommendations ───────────────────────

    const answers: UserAnswers = {
      time: "significant",
      profileUrl: inputType !== "name" ? input : undefined,
      profilePlatform: platform,
      enrichedProfile,
      profileText: rawProfileText,
    };

    const hasProfile = !!enrichedProfile || !!rawProfileText || !!input;
    let items: ResultItem[];

    if (hasProfile) {
      items = await computeClaudeRanking(resources, answers, geo, variant);
    } else {
      items = computeAlgorithmicRanking(resources, answers, geo, variant);
    }

    // Persist user data
    const userId = getUserId();
    if (userId) {
      upsertUser(userId, {
        ...(enrichedProfile ? { profile_data: enrichedProfile } : {}),
        ...(platform ? { profile_platform: platform } : {}),
        ...(input && inputType !== "name" ? { profile_url: input } : {}),
        answers,
      }).catch(() => {});
    }

    trackResultsViewed(
      variant,
      answers.time,
      answers.intent,
      answers.positioned,
      answers.positionType,
      items.length,
      hasProfile ? "claude_personalized" : "algorithmic",
      Date.now() - startTimeRef.current,
    );

    onComplete(items, geo, answers);
  }

  // ── Ranking helpers ────────────────────────────────────

  async function computeClaudeRanking(
    resources: Resource[],
    userAnswers: UserAnswers,
    geoData: GeoData,
    v: Variant,
  ): Promise<ResultItem[]> {
    try {
      const userId = getUserId();
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: userAnswers.enrichedProfile,
          answers: userAnswers,
          geo: geoData,
          resources: resources.filter((r) => r.enabled),
          userId,
        }),
      });

      if (!res.ok) throw new Error("Recommendation API failed");

      const data = await res.json();
      const recs: RecommendedResource[] = data.recommendations || [];

      const merged: ResultItem[] = [];
      for (const rec of recs) {
        const resource = resources.find((r) => r.id === rec.resourceId);
        if (!resource) continue;
        merged.push({
          kind: "resource",
          scored: { resource, score: 1 / rec.rank, matchReasons: [] },
          customDescription: rec.description,
        });
      }

      const localCard = buildLocalCard(resources, userAnswers, geoData, v);
      if (localCard) {
        merged.push({ kind: "local", card: localCard });
      }

      return merged.length > 0
        ? merged
        : computeAlgorithmicRanking(resources, userAnswers, geoData, v);
    } catch (err) {
      console.error("[processing] Claude ranking failed, falling back:", err);
      return computeAlgorithmicRanking(resources, userAnswers, geoData, v);
    }
  }

  function computeAlgorithmicRanking(
    resources: Resource[],
    userAnswers: UserAnswers,
    geoData: GeoData,
    v: Variant,
  ): ResultItem[] {
    const ranked = rankResources(resources, userAnswers, geoData, v);
    const localCard = buildLocalCard(resources, userAnswers, geoData, v);

    const merged: ResultItem[] = ranked.map((scored) => ({
      kind: "resource" as const,
      scored,
    }));

    if (localCard) {
      const insertIdx = merged.findIndex(
        (item) => item.kind === "resource" && item.scored.score < localCard.score,
      );
      if (insertIdx === -1) {
        merged.push({ kind: "local", card: localCard });
      } else {
        merged.splice(insertIdx, 0, { kind: "local", card: localCard });
      }
    } else {
      merged.push({ kind: "local", card: null });
    }

    return merged;
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center"
          >
            {/* Profile card — fades in when available, fades out when search results arrive */}
            <AnimatePresence>
              {view.profile && !view.snippetLines && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.35 }}
                  className="mb-6 flex items-center gap-3"
                >
                  {view.profile.photo && (
                    <img
                      src={view.profile.photo}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    {view.profile.fullName && (
                      <p className="text-base font-semibold text-foreground">
                        {view.profile.fullName}
                      </p>
                    )}
                    {view.profile.headline && (
                      <p className="truncate text-sm text-muted-foreground">
                        {view.profile.headline}
                      </p>
                    )}
                    {!view.profile.headline &&
                      view.profile.currentTitle &&
                      view.profile.currentCompany && (
                        <p className="truncate text-sm text-muted-foreground">
                          {view.profile.currentTitle} at{" "}
                          {view.profile.currentCompany}
                        </p>
                      )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Detail tags — skills, experience, repos from enrichment */}
            <AnimatePresence>
              {view.details && view.details.length > 0 && !view.snippetLines && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mb-6 w-full max-w-sm"
                >
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {view.details.map((tag, i) => (
                      <motion.span
                        key={tag}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.08, duration: 0.2 }}
                        className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground"
                      >
                        {tag}
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Snippet lines — from Perplexity search */}
            <AnimatePresence>
              {view.snippetLines && view.snippetLines.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mb-5 w-full max-w-sm"
                >
                  <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                    {view.snippetLines.map((line, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1, duration: 0.2 }}
                        className="flex gap-2"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                        <span>{line}</span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Citations / source links */}
            <AnimatePresence>
              {view.citations && view.citations.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mb-6 w-full max-w-sm"
                >
                  <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted">
                    Sources found
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {view.citations.slice(0, 6).map((url, i) => (
                      <motion.span
                        key={url}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.08, duration: 0.2 }}
                        className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground"
                      >
                        {urlToHost(url)}
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Spinner + status text */}
            <div className="flex flex-col items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
              <AnimatePresence mode="wait">
                <motion.p
                  key={view.statusText}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm text-muted-foreground"
                >
                  {view.statusText}
                </motion.p>
              </AnimatePresence>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
