import {
  Resource,
  ScoredResource,
  UserAnswers,
  GeoData,
  Variant,
  TimeCommitment,
  IntentTag,
  ResourceCategory,
  PositionTag,
} from "@/types";

// ─── Time Budgets ───────────────────────────────────────────

const TIME_BUDGETS: Record<TimeCommitment, number> = {
  minutes: 15,
  hours: 240,
  significant: Infinity,
};

const FRICTION_SENSITIVITY: Record<TimeCommitment, number> = {
  minutes: 0.8,
  hours: 0.4,
  significant: 0.1,
};

// ─── Intent → Category mapping ──────────────────────────────

const INTENT_TO_CATEGORIES: Record<IntentTag, ResourceCategory[]> = {
  understand: ["programs", "other"],
  connect: ["communities", "events"],
  impact: ["letters", "other"],
  do_part: ["letters", "other", "events"],
};

// ─── Similarity weights ─────────────────────────────────────

const SIM_WEIGHTS = {
  category: 0.35,
  source_org: 0.25,
  time_bucket: 0.20,
  location: 0.20,
};

// ─── Location matching ──────────────────────────────────────

function locationFit(resource: Resource, geo: GeoData): number {
  // Suppress letters in authoritarian countries
  if (geo.isAuthoritarian && resource.category === "letters") {
    return 0.0;
  }

  const loc = resource.location.toLowerCase();

  // Global/Online → available everywhere
  if (loc === "global" || loc === "online" || loc === "") return 1.0;

  // City match → strongest signal (check first so country doesn't short-circuit)
  if (geo.city && loc.includes(geo.city.toLowerCase())) {
    return 1.4;
  }

  // Region/state match
  if (geo.region && loc.includes(geo.region.toLowerCase())) {
    return 1.3;
  }

  // Country match (by name or 2-letter code)
  const countryCode = geo.countryCode.toLowerCase();
  const countryName = geo.country.toLowerCase();
  if (
    (countryCode !== "xx" && loc.includes(countryCode)) ||
    (countryName !== "unknown" && loc.includes(countryName))
  ) {
    return 1.2;
  }

  // Events/communities with a specific location that doesn't match → exclude
  if (isLocalCategory(resource)) {
    return 0.0;
  }

  // Other categories: location-specific but doesn't match — reduced
  return 0.3;
}

// ─── Scoring ────────────────────────────────────────────────

function timeFit(resource: Resource, time: TimeCommitment): number {
  const budget = TIME_BUDGETS[time];
  if (resource.min_minutes <= budget) return 1.0;
  if (resource.min_minutes <= budget * 2) return 0.5;
  return 0.1;
}

function typeFit(
  resource: Resource,
  variant: Variant,
  answers: UserAnswers
): number {
  if (variant === "A") return 1.0;

  if (variant === "B" && answers.intents && answers.intents.length > 0) {
    const cats = answers.intents.flatMap((i) => INTENT_TO_CATEGORIES[i]);
    return cats.includes(resource.category) ? 1.3 : 1.0;
  }

  if (variant === "D" && answers.intent) {
    const cats = INTENT_TO_CATEGORIES[answers.intent];
    return cats.includes(resource.category) ? 1.3 : 0.7;
  }

  return 1.0;
}

function deadlineBoost(resource: Resource): number {
  if (!resource.deadline_date) return 1.0;

  const daysUntil = Math.ceil(
    (new Date(resource.deadline_date).getTime() - Date.now()) / 86_400_000
  );

  if (daysUntil < 0) return 0.0;
  if (daysUntil <= 14) return 1.5;
  if (daysUntil <= 30) return 1.2;
  return 1.0;
}

function positionFit(resource: Resource, positionType?: PositionTag): number {
  if (!positionType) return 1.0;
  const tags = resource.position_tags || [];
  if (tags.includes(positionType)) return 1.5;
  const bgTags = resource.background_tags || [];
  if (bgTags.includes(positionType)) return 1.3;
  return 0.8;
}

function activityFit(resource: Resource): number {
  // activity_score is 0–1, only set on communities/events from verification.
  // If not set, assume decent quality.
  const score = resource.activity_score;
  if (score == null) return 1.0;
  // Anything below 0.2 is basically dead — hard zero, should never appear
  if (score < 0.2) return 0;
  // Scale so 0.2→0.4, 0.5→0.7, 1.0→1.0
  return 0.2 + score * 0.8;
}

function scoreResource(
  resource: Resource,
  answers: UserAnswers,
  geo: GeoData,
  variant: Variant
): ScoredResource {
  if (!resource.enabled) {
    return { resource, score: 0, matchReasons: [] };
  }

  const tf = timeFit(resource, answers.time);
  const tyf = typeFit(resource, variant, answers);
  const lf = locationFit(resource, geo);
  const pf = positionFit(resource, answers.positionType);
  const af = activityFit(resource);

  // Hard kill: dead communities/events never show
  if (af === 0) return { resource, score: 0, matchReasons: [] };

  // Use ev_positioned when user is positioned and resource has it
  const ev = (answers.positioned && resource.ev_positioned != null)
    ? resource.ev_positioned
    : resource.ev_general;

  const frictionPenalty = 1 - resource.friction * FRICTION_SENSITIVITY[answers.time];
  const dl = deadlineBoost(resource);

  const score = tf * tyf * lf * pf * af * ev * Math.max(frictionPenalty, 0.05) * dl;

  const matchReasons: string[] = [];
  if (lf > 1.0) matchReasons.push("Near you");
  if (dl > 1.0) matchReasons.push("Deadline approaching");
  if (pf > 1.0) matchReasons.push("Relevant to your background");

  return { resource, score, matchReasons };
}

// ─── Similarity & Diversified Selection ─────────────────────

function timeBucket(minutes: number): string {
  if (minutes <= 5) return "instant";
  if (minutes <= 30) return "quick";
  if (minutes <= 120) return "session";
  return "deep";
}

function similarity(a: Resource, b: Resource): number {
  let sim = 0;
  if (a.category === b.category) sim += SIM_WEIGHTS.category;
  if (a.source_org === b.source_org) sim += SIM_WEIGHTS.source_org;
  if (timeBucket(a.min_minutes) === timeBucket(b.min_minutes))
    sim += SIM_WEIGHTS.time_bucket;
  if (a.location === b.location) sim += SIM_WEIGHTS.location;
  return sim;
}

const MIN_SCORE_THRESHOLD = 0.15;
const SIMILARITY_PENALTY = 0.6;

// ─── Helpers ────────────────────────────────────────────────

/** True if the resource is a community or event */
function isLocalCategory(r: Resource): boolean {
  return r.category === "communities" || r.category === "events";
}

// ─── Main Export ─────────────────────────────────────────────

export function rankResources(
  resources: Resource[],
  answers: UserAnswers,
  geo: GeoData,
  variant: Variant,
  maxResults: number = 6,
  minResults: number = 3
): ScoredResource[] {
  const scored = resources.map((r) => scoreResource(r, answers, geo, variant));

  const regularPool = scored.filter(
    (s) => s.score > MIN_SCORE_THRESHOLD
  );

  const selected: ScoredResource[] = [];
  const remaining = [...regularPool].sort((a, b) => b.score - a.score);

  let hasStackable = false;

  while (selected.length < maxResults && remaining.length > 0) {
    const best = remaining.shift()!;
    if (selected.length >= minResults && best.score < MIN_SCORE_THRESHOLD) break;

    // Only allow one event/community card — extras go in the stacked dropdown
    if (isLocalCategory(best.resource)) {
      if (hasStackable) continue;
      hasStackable = true;
    }

    selected.push(best);

    for (const item of remaining) {
      const sim = similarity(best.resource, item.resource);
      if (sim > 0) item.score *= 1 - sim * SIMILARITY_PENALTY;
    }
    remaining.sort((a, b) => b.score - a.score);
  }

  return selected;
}

/**
 * Find additional local communities/events that are good enough to show
 * as "stacked" extras behind a result that's already in the main list.
 * These are resources that scored well but were pushed out by the
 * similarity penalty (since we already picked one community/event).
 */
export function getLocalExtras(
  resources: Resource[],
  answers: UserAnswers,
  geo: GeoData,
  variant: Variant,
  selectedIds: Set<string>,
  maxExtras: number = 4,
): ScoredResource[] {
  // Only look for local communities/events that aren't already shown
  return resources
    .filter((r) =>
      r.enabled &&
      !selectedIds.has(r.id) &&
      isLocalCategory(r) &&
      locationFit(r, geo) > 1.0  // must actually be near the user
    )
    .map((r) => scoreResource(r, answers, geo, variant))
    .filter((s) => s.score > MIN_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxExtras);
}
