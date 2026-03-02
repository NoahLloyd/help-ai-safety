// ─── Variants ───────────────────────────────────────────────

export type Variant = "A" | "B" | "D";

// ─── Questions ──────────────────────────────────────────────

export type TimeCommitment = "minutes" | "hours" | "significant";

export type IntentTag =
  | "understand"
  | "connect"
  | "impact"
  | "do_part";

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
}

export interface Question {
  id: string;
  question: string;
  subtitle?: string;
  options: QuestionOption[];
  multiSelect?: boolean;
}

// ─── User State ─────────────────────────────────────────────

export interface UserAnswers {
  time: TimeCommitment;
  intents?: IntentTag[];    // Variant B (multi-select)
  intent?: IntentTag;       // Variant D (single-select)
  positioned?: boolean;     // True if user chose "uniquely positioned"
  positionType?: PositionTag; // What kind of position they have
}

export interface GeoData {
  country: string;
  countryCode: string;
  city?: string;
  region?: string;
  timezone?: string;
  isAuthoritarian?: boolean;
}

// ─── Resources ──────────────────────────────────────────────

export type ResourceCategory =
  | "events"
  | "programs"
  | "letters"
  | "communities"
  | "other";

export type ResourceStatus = "approved" | "pending" | "rejected";

export interface Resource {
  id: string;                // auto-generated, hidden from UI
  title: string;
  description: string;
  url: string;
  source_org: string;

  // Categorization
  category: ResourceCategory;
  location: string;          // "Global", "New York, USA", "Online", "US"

  // Time
  min_minutes: number;

  // Scoring — admin-only, never shown publicly
  ev_general: number;        // 0–1  expected impact for a random person
  ev_positioned?: number;    // 0–1  expected impact if particularly suited
  friction: number;          // 0 = one click, 1 = life change

  // Status
  enabled: boolean;          // single on/off toggle
  status: ResourceStatus;    // approved / pending / rejected

  // Category-specific (optional)
  event_date?: string;       // ISO date — events only
  event_type?: string;       // "Talk" | "Meetup" | "Course" etc.
  deadline_date?: string;    // ISO date — programs with deadlines

  // Submission
  created_at: string;        // ISO timestamp
  submitted_by?: string;     // name/email from public submissions

  // Tags — for positioned-person ranking funnel
  background_tags?: string[];
  position_tags?: string[];

  // Sync — tracks where imported resources came from
  source?: string;       // "ea-forum" | "aisafety" | "pauseai" | "lesswrong" | "manual"
  source_id?: string;    // external ID from upstream, for re-matching on sync

  // Verification — automated checks + admin overrides
  verified_at?: string;        // ISO timestamp of last verification run
  url_status?: string;         // "reachable" | "dead" | "redirect" | "unknown"
  activity_score?: number;     // 0–1, higher = more active/real community
  verification_notes?: string; // human-readable notes from last verification
}

// ─── Ranking ────────────────────────────────────────────────

export interface ScoredResource {
  resource: Resource;
  score: number;
  matchReasons: string[];
}

/** Collapsed local card — one anchor + expandable extras for nearby events/communities */
export interface LocalCard {
  anchor: ScoredResource;
  extras: ScoredResource[];
  score: number;               // card's ranking score (anchor score * remoteness bonus)
}

// ─── Positioned Person ──────────────────────────────────────

export type PositionTag =
  | "ai_tech"
  | "policy_gov"
  | "audience_platform"
  | "donor"
  | "student"
  | "other";
