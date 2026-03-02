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
} from "@/lib/tracking";
import type {
  Resource,
  UserAnswers,
  Variant,
  GeoData,
  ScoredResource,
  LocalCard,
} from "@/types";
import { ResourceCard } from "@/components/results/resource-card";
import { LocationPicker } from "@/components/results/location-picker";

/** A result item is either a normal scored resource or the local card */
type ResultItem =
  | { kind: "resource"; scored: ScoredResource }
  | { kind: "local"; card: LocalCard | null };

interface ResultsProps {
  variant: Variant;
  answers: UserAnswers;
}

export function Results({ variant, answers }: ResultsProps) {
  const [items, setItems] = useState<ResultItem[]>([]);
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [localGeo, setLocalGeo] = useState<GeoData | null>(null);
  const [allResources, setAllResources] = useState<Resource[] | null>(null);
  const [loading, setLoading] = useState(true);
  const localCardIndexRef = useRef<number | null>(null);

  useEffect(() => {
    async function init() {
      const resources = await fetchResources();
      const geoData: GeoData = await getGeoData();
      setAllResources(resources);
      setGeo(geoData);
      setLocalGeo(geoData);

      // Rank non-local resources
      const ranked = rankResources(resources, answers, geoData, variant);
      const localCard = buildLocalCard(resources, answers, geoData, variant);

      const merged: ResultItem[] = ranked.map((scored) => ({
        kind: "resource" as const,
        scored,
      }));

      // Always insert a local card slot (even if null content initially)
      const localItem: ResultItem = { kind: "local", card: localCard };

      if (localCard) {
        const insertIdx = merged.findIndex(
          (item) =>
            item.kind === "resource" && item.scored.score < localCard.score
        );
        if (insertIdx === -1) {
          localCardIndexRef.current = merged.length;
          merged.push(localItem);
        } else {
          localCardIndexRef.current = insertIdx;
          merged.splice(insertIdx, 0, localItem);
        }
      } else {
        // No local results — append at end
        localCardIndexRef.current = merged.length;
        merged.push(localItem);
      }

      setItems(merged);

      trackResultsViewed(
        variant,
        answers.time,
        answers.intents || answers.intent,
        answers.positioned,
        answers.positionType,
        merged.length
      );

      setLoading(false);
    }

    init();
  }, [variant, answers]);

  // Re-rank only the local card when the user picks a new location
  const handleLocationChange = useCallback(
    (newGeo: GeoData) => {
      setLocalGeo(newGeo);
      if (!allResources || localCardIndexRef.current === null) return;

      const newLocalCard = buildLocalCard(allResources, answers, newGeo, variant);

      setItems((prev) => {
        const updated = [...prev];
        const idx = localCardIndexRef.current!;
        updated[idx] = { kind: "local", card: newLocalCard };
        return updated;
      });
    },
    [allResources, answers, variant]
  );

  const handleResourceClick = useCallback(
    (resourceId: string, position: number) => {
      if (geo) {
        trackClick(resourceId, variant, answers, geo.countryCode);

        let found: ScoredResource | undefined;
        for (const item of items) {
          if (item.kind === "resource" && item.scored.resource.id === resourceId) {
            found = item.scored;
            break;
          }
          if (item.kind === "local" && item.card) {
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
              geo={localGeo}
              isPrimary
              onClickTrack={(id) => handleResourceClick(id, 0)}
              onLocationChange={handleLocationChange}
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
              Also check out
            </p>
            <div className="flex flex-col gap-3">
              {secondary.map((item, i) => {
                const key =
                  item.kind === "resource"
                    ? item.scored.resource.id
                    : "local-card";
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
                      geo={localGeo}
                      onClickTrack={(id) => handleResourceClick(id, i + 1)}
                      onLocationChange={handleLocationChange}
                    />
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        <div className="pb-8" />
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
  onLocationChange: (geo: GeoData) => void;
}

function ResultItemRenderer({
  item,
  variant,
  geo,
  isPrimary,
  onClickTrack,
  onLocationChange,
}: ResultItemRendererProps) {
  if (item.kind === "local") {
    return (
      <LocalCardGroup
        card={item.card}
        variant={variant}
        geo={geo}
        onClickTrack={onClickTrack}
        onLocationChange={onLocationChange}
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

// ─── Local Card Group Component ──────────────────────────────

interface LocalCardGroupProps {
  card: LocalCard | null;
  variant: Variant;
  geo: GeoData | null;
  onClickTrack: (resourceId: string) => void;
  onLocationChange: (geo: GeoData) => void;
}

function LocalCardGroup({ card, variant, geo, onClickTrack, onLocationChange }: LocalCardGroupProps) {
  const [expanded, setExpanded] = useState(false);

  const extras = card?.extras ?? [];

  // Build a label from what's actually in the card
  const hasCommunities = card
    ? (card.anchor.resource.category === "communities" ||
       card.extras.some((e) => e.resource.category === "communities"))
    : false;
  const hasEvents = card
    ? (card.anchor.resource.category === "events" ||
       card.extras.some((e) => e.resource.category === "events"))
    : false;
  const label = hasCommunities && hasEvents
    ? "communities & events"
    : hasCommunities
      ? "communities"
      : hasEvents
        ? "events"
        : "communities & events";

  if (!card) {
    // Empty state — no events/communities at this location
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-5">
        <p className="text-sm text-muted-foreground">
          No {label} found
          {geo ? (
            <> near <LocationPicker geo={geo} onLocationChange={onLocationChange} /></>
          ) : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <ResourceCard
        scored={card.anchor}
        variant={variant}
        onClickTrack={onClickTrack}
      />

      {/* Expand bar with integrated location picker */}
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
              if (willExpand) {
                trackStackExpanded(variant, extras.length);
              }
            }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((v) => !v); } }}
            className="relative z-10 mt-1 flex w-full cursor-pointer items-center justify-between rounded-b-xl border border-t-0 border-border bg-card/80 px-4 py-2.5 text-left transition-colors hover:bg-card-hover"
          >
            <span className="text-xs text-muted-foreground">
              {extras.length} more {label}
              {geo && (
                <> near<LocationPicker geo={geo} onLocationChange={onLocationChange} /></>
              )}
            </span>
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-muted-foreground text-xs"
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
                      onClickTrack={onClickTrack}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* No extras but has anchor — show location in a subtle footer */}
      {extras.length === 0 && geo && (
        <div className="mt-[-4px] ml-2 mr-2">
          <div className="rounded-b-xl border border-t-0 border-border bg-card/80 px-4 py-2 text-xs text-muted-foreground">
            Near <LocationPicker geo={geo} onLocationChange={onLocationChange} />
          </div>
        </div>
      )}
    </div>
  );
}
