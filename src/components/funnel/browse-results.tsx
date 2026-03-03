"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchResources, trackClick } from "@/lib/data";
import { rankResources, buildLocalCard } from "@/lib/ranking";
import { getGeoData } from "@/lib/geo";
import {
  trackResultsViewed,
  trackResourceClicked,
  trackStackExpanded,
  trackBrowseFilterUsed,
  trackTimeToFirstClick,
  trackScrollDepth,
  identifyGeo,
} from "@/lib/tracking";
import type {
  Resource,
  ScoredResource,
  LocalCard,
  Variant,
  GeoData,
  UserAnswers,
  TimeCommitment,
  ResourceCategory,
} from "@/types";
import { ResourceCard } from "@/components/results/resource-card";
import { LocationPicker } from "@/components/results/location-picker";

type SortMode = "relevance" | "date" | "quick";
type CategoryFilter = "all" | ResourceCategory;
type TimeFilter = "any" | "quick" | "hours" | "deep";

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "events", label: "Events" },
  { value: "communities", label: "Communities" },
  { value: "programs", label: "Programs" },
  { value: "letters", label: "Letters" },
];

const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "quick", label: "< 15 min" },
  { value: "hours", label: "Hours" },
  { value: "deep", label: "Days+" },
];

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "relevance", label: "Best match" },
  { value: "date", label: "Soonest" },
  { value: "quick", label: "Quickest" },
];

interface BrowseResultsProps {
  variant: Variant;
}

export function BrowseResults({ variant }: BrowseResultsProps) {
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("any");
  const [sort, setSort] = useState<SortMode>("relevance");

  // Tracking refs
  const loadedAtRef = useRef<number>(0);
  const firstClickTrackedRef = useRef(false);
  const scrollMilestonesRef = useRef(new Set<number>());

  useEffect(() => {
    async function init() {
      const [resources, geoData] = await Promise.all([
        fetchResources(),
        getGeoData(),
      ]);
      setAllResources(resources);
      setGeo(geoData);
      identifyGeo(geoData.countryCode);
      loadedAtRef.current = Date.now();

      trackResultsViewed(
        variant,
        "significant",
        undefined,
        false,
        undefined,
        resources.length,
        "browse"
      );

      setLoading(false);
    }
    init();
  }, [variant]);

  // Scroll depth tracking
  useEffect(() => {
    if (loading) return;
    function handleScroll() {
      const scrollPct = Math.round(
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
      );
      for (const milestone of [25, 50, 75, 100]) {
        if (scrollPct >= milestone && !scrollMilestonesRef.current.has(milestone)) {
          scrollMilestonesRef.current.add(milestone);
          trackScrollDepth(variant, milestone);
        }
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading, variant]);

  const handleLocationChange = useCallback((newGeo: GeoData) => {
    setGeo(newGeo);
  }, []);

  const handleResourceClick = useCallback(
    (resourceId: string, position: number) => {
      if (!geo) return;

      // Time to first click
      if (!firstClickTrackedRef.current && loadedAtRef.current) {
        trackTimeToFirstClick(variant, Date.now() - loadedAtRef.current);
        firstClickTrackedRef.current = true;
      }

      const answers: UserAnswers = { time: "significant" };
      trackClick(resourceId, variant, answers, geo.countryCode);

      const resource = allResources.find((r) => r.id === resourceId);
      if (resource) {
        trackResourceClicked(
          resourceId,
          resource.title,
          resource.category,
          variant,
          position,
          loadedAtRef.current ? Date.now() - loadedAtRef.current : undefined
        );
      }
    },
    [allResources, variant, geo]
  );

  // Filter and sort resources
  const filtered = allResources.filter((r) => {
    if (category !== "all" && r.category !== category) return false;
    if (timeFilter === "quick" && r.min_minutes > 15) return false;
    if (timeFilter === "hours" && (r.min_minutes < 15 || r.min_minutes > 480)) return false;
    if (timeFilter === "deep" && r.min_minutes < 480) return false;
    return true;
  });

  // Score and sort
  const answers: UserAnswers = { time: "significant" };
  const scored: ScoredResource[] = geo
    ? filtered.map((r) => {
        const ranked = rankResources([r], answers, geo, variant, 1, 1);
        return ranked[0] || { resource: r, score: r.ev_general, matchReasons: [] };
      })
    : filtered.map((r) => ({ resource: r, score: r.ev_general, matchReasons: [] }));

  const sorted = [...scored].sort((a, b) => {
    if (sort === "date") {
      const aDate = a.resource.event_date || a.resource.deadline_date || "9999";
      const bDate = b.resource.event_date || b.resource.deadline_date || "9999";
      return aDate.localeCompare(bDate);
    }
    if (sort === "quick") {
      return a.resource.min_minutes - b.resource.min_minutes;
    }
    return b.score - a.score;
  });

  // Build local card if showing "all" or local categories
  const localCard =
    geo && (category === "all" || category === "events" || category === "communities")
      ? buildLocalCard(allResources, answers, geo, variant)
      : null;

  // Non-local results (when showing all, exclude events/communities since they're in the local card)
  const mainResults =
    category === "all"
      ? sorted.filter(
          (s) => s.resource.category !== "events" && s.resource.category !== "communities"
        )
      : sorted;

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-muted-foreground"
        >
          Loading...
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-6 py-10">
      <div className="mx-auto w-full max-w-lg">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Ways you can help with AI safety
          </h1>
        </motion.div>

        {/* Filters */}
        <motion.div
          className="mt-6 flex flex-col gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => {
                  setCategory(cat.value);
                  trackBrowseFilterUsed(variant, "category", cat.value);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  category === cat.value
                    ? "bg-accent text-white"
                    : "border border-border bg-card text-muted-foreground hover:border-accent/30 hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Time + sort row */}
          <div className="flex items-center gap-2">
            <select
              value={timeFilter}
              onChange={(e) => {
                setTimeFilter(e.target.value as TimeFilter);
                trackBrowseFilterUsed(variant, "time", e.target.value);
              }}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors focus:border-accent"
            >
              {TIME_FILTERS.map((tf) => (
                <option key={tf.value} value={tf.value}>
                  {tf.label}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortMode);
                trackBrowseFilterUsed(variant, "sort", e.target.value);
              }}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors focus:border-accent"
            >
              {SORT_OPTIONS.map((so) => (
                <option key={so.value} value={so.value}>
                  {so.label}
                </option>
              ))}
            </select>
            <span className="ml-auto text-xs text-muted">
              {category === "all" ? mainResults.length + (localCard ? 1 : 0) : mainResults.length} results
            </span>
          </div>
        </motion.div>

        {/* Results */}
        <motion.div
          className="mt-6 flex flex-col gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {/* Local card (events/communities) — show at top when browsing all */}
          {category === "all" && localCard && (
            <LocalCardBrowse
              card={localCard}
              variant={variant}
              geo={geo}
              onClickTrack={handleResourceClick}
              onLocationChange={handleLocationChange}
            />
          )}

          {mainResults.map((scored, i) => (
            <motion.div
              key={scored.resource.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * Math.min(i, 10) }}
            >
              <ResourceCard
                scored={scored}
                variant={variant}
                onClickTrack={(id) =>
                  handleResourceClick(id, i + (localCard ? 1 : 0))
                }
              />
            </motion.div>
          ))}

          {mainResults.length === 0 && !localCard && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No results match your filters. Try broadening your search.
            </p>
          )}
        </motion.div>

        <div className="pb-8" />
      </div>
    </main>
  );
}

// ─── Local Card for Browse ──────────────────────────────────

interface LocalCardBrowseProps {
  card: LocalCard;
  variant: Variant;
  geo: GeoData | null;
  onClickTrack: (resourceId: string, position: number) => void;
  onLocationChange: (geo: GeoData) => void;
}

function LocalCardBrowse({
  card,
  variant,
  geo,
  onClickTrack,
  onLocationChange,
}: LocalCardBrowseProps) {
  const [expanded, setExpanded] = useState(false);
  const extras = card.extras;

  const hasCommunities =
    card.anchor.resource.category === "communities" ||
    extras.some((e) => e.resource.category === "communities");
  const hasEvents =
    card.anchor.resource.category === "events" ||
    extras.some((e) => e.resource.category === "events");
  const label =
    hasCommunities && hasEvents
      ? "communities & events"
      : hasCommunities
        ? "communities"
        : "events";

  return (
    <div className="relative">
      <ResourceCard
        scored={card.anchor}
        variant={variant}
        onClickTrack={(id) => onClickTrack(id, 0)}
      />

      {extras.length > 0 && (
        <div className="relative mt-[-4px] ml-2 mr-2">
          {!expanded && (
            <div className="absolute inset-x-1 top-0 h-3 rounded-b-xl border border-t-0 border-border bg-card/60" />
          )}

          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              const willExpand = !expanded;
              setExpanded(willExpand);
              if (willExpand) trackStackExpanded(variant, extras.length);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setExpanded((v) => !v);
              }
            }}
            className="relative z-10 mt-1 flex w-full cursor-pointer items-center justify-between rounded-b-xl border border-t-0 border-border bg-card/80 px-4 py-2.5 text-left transition-colors hover:bg-card-hover"
          >
            <span className="text-xs text-muted-foreground">
              {extras.length} more {label}
              {geo && (
                <>
                  {" "}near
                  <LocationPicker
                    geo={geo}
                    onLocationChange={onLocationChange}
                  />
                </>
              )}
            </span>
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-xs text-muted-foreground"
            >
              ↓
            </motion.span>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-2 pt-2">
                  {extras.map((scored) => (
                    <ResourceCard
                      key={scored.resource.id}
                      scored={scored}
                      variant={variant}
                      onClickTrack={(id) => onClickTrack(id, 1)}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {extras.length === 0 && geo && (
        <div className="mt-[-4px] ml-2 mr-2">
          <div className="rounded-b-xl border border-t-0 border-border bg-card/80 px-4 py-2 text-xs text-muted-foreground">
            Near{" "}
            <LocationPicker geo={geo} onLocationChange={onLocationChange} />
          </div>
        </div>
      )}
    </div>
  );
}
