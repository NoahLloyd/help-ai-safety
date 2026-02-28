"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { fetchResources, trackClick } from "@/lib/data";
import { rankResources, getLocalExtras } from "@/lib/ranking";
import { getGeoData } from "@/lib/geo";
import {
  trackResultsViewed,
  trackResourceClicked,
  trackStartOver,
  trackStackExpanded,
} from "@/lib/tracking";
import type {
  UserAnswers,
  Variant,
  GeoData,
  ScoredResource,
  Resource,
} from "@/types";
import { ResourceCard } from "@/components/results/resource-card";

/** True if resource is a community or event (stackable category) */
function isStackable(r: Resource): boolean {
  return r.category === "communities" || r.category === "events";
}

export default function ResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState<ScoredResource[]>([]);
  const [localExtras, setLocalExtras] = useState<ScoredResource[]>([]);
  const [variant, setVariant] = useState<Variant>("A");
  const [answers, setAnswers] = useState<UserAnswers | null>(null);
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function compute() {
      const answersRaw = sessionStorage.getItem("hdih_answers");
      const variantRaw = sessionStorage.getItem("hdih_variant") as Variant | null;

      if (!answersRaw) {
        router.push("/");
        return;
      }

      const parsedAnswers: UserAnswers = JSON.parse(answersRaw);
      const v = variantRaw || "A";
      setVariant(v);
      setAnswers(parsedAnswers);

      const resources = await fetchResources();
      const geoData: GeoData = await getGeoData();
      setGeo(geoData);

      const ranked = rankResources(resources, parsedAnswers, geoData, v);
      setResults(ranked);

      // Track results viewed
      trackResultsViewed(
        v,
        parsedAnswers.time,
        parsedAnswers.intents || parsedAnswers.intent,
        parsedAnswers.positioned,
        parsedAnswers.positionType,
        ranked.length
      );

      // Find extra local communities/events to stack behind the first one shown
      const selectedIds = new Set(ranked.map((r) => r.resource.id));
      const extras = getLocalExtras(resources, parsedAnswers, geoData, v, selectedIds);
      setLocalExtras(extras);

      setLoading(false);
    }

    compute();
  }, [router]);

  const handleResourceClick = useCallback(
    (resourceId: string, position: number) => {
      if (answers && geo) {
        trackClick(resourceId, variant, answers, geo.countryCode);

        // Find the resource for richer tracking
        const allResults = [...results, ...localExtras];
        const scored = allResults.find((r) => r.resource.id === resourceId);
        if (scored) {
          trackResourceClicked(
            resourceId,
            scored.resource.title,
            scored.resource.category,
            variant,
            position
          );
        }
      }
    },
    [answers, variant, geo, results, localExtras]
  );

  // Find the index of the first stackable result (community/event) that has extras to attach
  const stackAnchorIndex = useMemo(() => {
    if (localExtras.length === 0) return -1;
    return results.findIndex((r) => isStackable(r.resource));
  }, [results, localExtras]);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-muted-foreground"
        >
          Finding the best ways you can help...
        </motion.div>
      </main>
    );
  }

  const isPositioned = answers?.positioned;
  const primary = results[0];
  const secondary = results.slice(1);

  return (
    <main className="min-h-dvh px-6 py-12">
      <div className="mx-auto w-full max-w-lg">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Here&apos;s how you can help.
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            {isPositioned
              ? "Based on your background, these are the highest-impact actions for you."
              : "Based on your answers, we think this is the best place to start."}
          </p>
        </motion.div>

        {/* Primary Recommendation */}
        {primary && (
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-accent">
              Your #1 action
            </p>
            {stackAnchorIndex === 0 ? (
              <StackedGroup
                anchor={primary}
                extras={localExtras}
                variant={variant}
                geo={geo}
                onClickTrack={(id) => handleResourceClick(id, 0)}
              />
            ) : (
              <ResourceCard
                scored={primary}
                variant={variant}
                isPrimary
                onClickTrack={(id) => handleResourceClick(id, 0)}
              />
            )}
          </motion.div>
        )}

        {/* Secondary Recommendations */}
        {secondary.length > 0 && (
          <motion.div
            className="mt-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <p className="mb-3 text-sm text-muted-foreground">
              Also worth checking out
            </p>
            <div className="flex flex-col gap-3">
              {secondary.map((scored, i) => {
                const globalIndex = i + 1; // offset by 1 since primary is index 0
                return (
                  <motion.div
                    key={scored.resource.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.1 }}
                  >
                    {stackAnchorIndex === globalIndex ? (
                      <StackedGroup
                        anchor={scored}
                        extras={localExtras}
                        variant={variant}
                        geo={geo}
                        onClickTrack={(id) => handleResourceClick(id, globalIndex)}
                      />
                    ) : (
                      <ResourceCard
                        scored={scored}
                        variant={variant}
                        onClickTrack={(id) => handleResourceClick(id, globalIndex)}
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Start Over */}
        <motion.div
          className="mt-12 border-t border-border pt-8 pb-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <button
            onClick={() => {
              trackStartOver(variant);
              sessionStorage.removeItem("hdih_answers");
              router.push("/");
            }}
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            ← Start over
          </button>
        </motion.div>
      </div>
    </main>
  );
}

// ─── Stacked Group Component ─────────────────────────────────

interface StackedGroupProps {
  anchor: ScoredResource;
  extras: ScoredResource[];
  variant: Variant;
  geo: GeoData | null;
  onClickTrack: (resourceId: string) => void;
}

function StackedGroup({ anchor, extras, variant, geo, onClickTrack }: StackedGroupProps) {
  const [expanded, setExpanded] = useState(false);

  // Build a label from what's actually in the extras
  const hasCommunities = extras.some((e) => e.resource.category === "communities");
  const hasEvents = extras.some((e) => e.resource.category === "events");
  const label = hasCommunities && hasEvents
    ? "communities & events"
    : hasCommunities
      ? "communities"
      : hasEvents
        ? "events"
        : "more";

  return (
    <div className="relative">
      {/* Main card */}
      <ResourceCard
        scored={anchor}
        variant={variant}
        onClickTrack={onClickTrack}
      />

      {/* Stacked indicator + expand */}
      {extras.length > 0 && (
        <div className="relative mt-[-4px] ml-2 mr-2">
          {/* Visual stack layers behind (visible when collapsed) */}
          {!expanded && (
            <div className="absolute inset-x-1 top-0 h-3 rounded-b-xl border border-t-0 border-border bg-card/60" />
          )}

          <button
            onClick={() => {
              const willExpand = !expanded;
              setExpanded(willExpand);
              if (willExpand) {
                trackStackExpanded(variant, extras.length);
              }
            }}
            className={`relative z-10 flex w-full items-center justify-between rounded-b-xl border border-t-0 border-border bg-card/80 px-4 py-2.5 text-left transition-colors hover:bg-card-hover ${
              !expanded ? "mt-1" : ""
            }`}
          >
            <span className="text-xs text-muted-foreground">
              {expanded
                ? "Hide"
                : `${extras.length} more ${label}${geo?.city && geo.city !== "Unknown" ? ` near ${geo.city}` : ""}`}
            </span>
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-muted-foreground text-xs"
            >
              ↓
            </motion.span>
          </button>

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
                      onClickTrack={onClickTrack}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
