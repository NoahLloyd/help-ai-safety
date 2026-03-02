"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { fetchResources, trackClick } from "@/lib/data";
import { rankResources, buildLocalCard } from "@/lib/ranking";
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
  LocalCard,
} from "@/types";
import { ResourceCard } from "@/components/results/resource-card";

/** A result item is either a normal scored resource or the local card */
type ResultItem =
  | { kind: "resource"; scored: ScoredResource }
  | { kind: "local"; card: LocalCard };

export default function ResultsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ResultItem[]>([]);
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

      // Debug: understand what data we're working with
      const events = resources.filter((r) => r.category === "events");
      const communities = resources.filter((r) => r.category === "communities");
      console.log("[results] geo:", geoData);
      console.log(`[results] ${resources.length} resources (${events.length} events, ${communities.length} communities)`);
      if (events.length > 0) {
        console.log("[results] sample event locations:", events.slice(0, 5).map((e) => e.location));
      }

      // Rank non-local resources (letters, programs, other)
      const ranked = rankResources(resources, parsedAnswers, geoData, v);

      // Build the collapsed local card (events + communities)
      const localCard = buildLocalCard(resources, parsedAnswers, geoData, v);
      console.log("[results] localCard:", localCard ? `anchor="${localCard.anchor.resource.title}" score=${localCard.score.toFixed(3)} extras=${localCard.extras.length}` : "null (no nearby events/communities)");

      // Merge the local card into the ranked list at its scored position
      const merged: ResultItem[] = ranked.map((scored) => ({
        kind: "resource" as const,
        scored,
      }));

      if (localCard) {
        // Find where the local card's score fits in the sorted list
        const insertIdx = merged.findIndex(
          (item) =>
            item.kind === "resource" && item.scored.score < localCard.score
        );
        const localItem: ResultItem = { kind: "local", card: localCard };

        if (insertIdx === -1) {
          // Lower than everything — append at end
          merged.push(localItem);
        } else {
          merged.splice(insertIdx, 0, localItem);
        }
      }

      setItems(merged);

      // Track results viewed
      trackResultsViewed(
        v,
        parsedAnswers.time,
        parsedAnswers.intents || parsedAnswers.intent,
        parsedAnswers.positioned,
        parsedAnswers.positionType,
        merged.length
      );

      setLoading(false);
    }

    compute();
  }, [router]);

  const handleResourceClick = useCallback(
    (resourceId: string, position: number) => {
      if (answers && geo) {
        trackClick(resourceId, variant, answers, geo.countryCode);

        // Find the resource across all items for richer tracking
        let found: ScoredResource | undefined;
        for (const item of items) {
          if (item.kind === "resource" && item.scored.resource.id === resourceId) {
            found = item.scored;
            break;
          }
          if (item.kind === "local") {
            if (item.card.anchor.resource.id === resourceId) {
              found = item.card.anchor;
              break;
            }
            found = item.card.extras.find((e) => e.resource.id === resourceId);
            if (found) break;
          }
        }

        if (found) {
          trackResourceClicked(
            resourceId,
            found.resource.title,
            found.resource.category,
            variant,
            position
          );
        }
      }
    },
    [answers, variant, geo, items]
  );

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
  const primary = items[0];
  const secondary = items.slice(1);

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
            <ResultItemRenderer
              item={primary}
              variant={variant}
              geo={geo}
              isPrimary
              onClickTrack={(id) => handleResourceClick(id, 0)}
            />
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
              {secondary.map((item, i) => {
                const key =
                  item.kind === "resource"
                    ? item.scored.resource.id
                    : `local-card-${item.card.anchor.resource.id}`;
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.1 }}
                  >
                    <ResultItemRenderer
                      item={item}
                      variant={variant}
                      geo={geo}
                      onClickTrack={(id) => handleResourceClick(id, i + 1)}
                    />
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

// ─── Result Item Renderer ────────────────────────────────────

interface ResultItemRendererProps {
  item: ResultItem;
  variant: Variant;
  geo: GeoData | null;
  isPrimary?: boolean;
  onClickTrack: (resourceId: string) => void;
}

function ResultItemRenderer({
  item,
  variant,
  geo,
  isPrimary,
  onClickTrack,
}: ResultItemRendererProps) {
  if (item.kind === "local") {
    return (
      <StackedGroup
        anchor={item.card.anchor}
        extras={item.card.extras}
        variant={variant}
        geo={geo}
        onClickTrack={onClickTrack}
      />
    );
  }

  return (
    <ResourceCard
      scored={item.scored}
      variant={variant}
      isPrimary={isPrimary}
      onClickTrack={(id) => onClickTrack(id)}
    />
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
  const hasCommunities =
    anchor.resource.category === "communities" ||
    extras.some((e) => e.resource.category === "communities");
  const hasEvents =
    anchor.resource.category === "events" ||
    extras.some((e) => e.resource.category === "events");
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
