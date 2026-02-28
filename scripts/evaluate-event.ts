/**
 * evaluate-event.ts — The central AI event evaluator.
 *
 * This is the single gatekeeper for the entire event pipeline. Nothing enters
 * the public `resources` table without passing through this script.
 *
 * Usage:
 *   # Evaluate a single URL (creates candidate + evaluates + optionally promotes)
 *   npx tsx scripts/evaluate-event.ts --url "https://lu.ma/ai-safety-hackathon"
 *
 *   # Evaluate from title/description (no URL scraping)
 *   npx tsx scripts/evaluate-event.ts --title "AI Safety Unconference" --description "..." --date "2026-03-15"
 *
 *   # Process all pending candidates in the queue
 *   npx tsx scripts/evaluate-event.ts --process-queue
 *
 *   # Re-evaluate already-processed candidates
 *   npx tsx scripts/evaluate-event.ts --process-queue --force
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';
import { scrapeUrl } from './lib/scrape-url';
import { getSupabase, insertCandidates } from './lib/insert-candidates';

// ─── Config ────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('❌ Missing ANTHROPIC_API_KEY in .env.local');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const supabase = getSupabase();

// Thresholds for auto-promote / auto-reject
const AUTO_PROMOTE_THRESHOLD = 0.6;
const AUTO_REJECT_THRESHOLD = 0.3;

// ─── AI Evaluation ─────────────────────────────────────────

interface AIEvaluation {
  is_real_event: boolean;
  is_relevant: boolean;
  relevance_score: number;
  impact_score: number;
  suggested_ev: number;
  suggested_friction: number;
  event_type: string;
  clean_title: string;
  clean_description: string;
  event_date: string | null;
  location: string;
  reasoning: string;
}

const SYSTEM_PROMPT = `You are an event evaluator for howdoihelp.ai, a directory that helps people get involved in AI safety. Your job is to determine whether a candidate event is real, relevant, and worth listing.

The site focuses on: AI safety, AI alignment, existential risk from AI, AI governance/policy, effective altruism (when AI-related), and responsible AI development.

You must return ONLY a valid JSON object with these exact fields:
{
  "is_real_event": boolean,       // Is this actually an event (not a blog post, product page, org homepage, etc.)?
  "is_relevant": boolean,         // Is this related to AI safety, alignment, EA, existential risk, AI governance?
  "relevance_score": number,      // 0.0-1.0: How relevant to AI safety specifically
  "impact_score": number,         // 0.0-1.0: Expected impact/importance
  "suggested_ev": number,         // 0.0-1.0: Suggested expected-value ranking score
  "suggested_friction": number,   // 0.0-1.0: How hard is it to attend (0=one click, 1=major commitment)
  "event_type": string,           // "conference" | "meetup" | "hackathon" | "workshop" | "talk" | "social" | "course" | "reading_group" | "other"
  "clean_title": string,          // Cleaned up, human-readable event title
  "clean_description": string,    // 1-2 sentence description suitable for a directory listing
  "event_date": string | null,    // ISO date (YYYY-MM-DD) or null if unknown
  "location": string,             // "City, Country" or "Online" or "Global"
  "reasoning": string             // 2-3 sentence explanation of your evaluation
}

Scoring guidelines:
- relevance_score 0.9-1.0: Core AI safety (EAG, MATS, alignment workshops, AI safety camps)
- relevance_score 0.7-0.9: Strongly adjacent (EA events with AI tracks, AI governance conferences, rationalist meetups)
- relevance_score 0.5-0.7: Related (AI ethics events, tech policy, biosecurity with AI component)
- relevance_score 0.3-0.5: Tangential (general tech events that mention AI safety, career fairs with AI roles)
- relevance_score 0.0-0.3: Not relevant (pure ML/product events, crypto, unrelated conferences)

impact_score guidelines:
- 0.8-1.0: Major conferences (EAG, major alignment workshops, MATS cohort)
- 0.6-0.8: Significant events (regional conferences, hackathons, intensive workshops)
- 0.4-0.6: Solid community events (reading groups, talks by notable researchers, local meetups in large cities)
- 0.2-0.4: Small or routine events (regular coffee chats, casual socials)
- 0.0-0.2: Minimal impact

suggested_ev = roughly relevance_score * impact_score, adjusted for your best judgment.

friction guidelines:
- 0.0-0.1: Click a link, show up to a casual event
- 0.1-0.3: RSVP required, small time commitment
- 0.3-0.5: Application required, multi-day, or travel needed
- 0.5-0.8: Selective application, significant travel, multi-week commitment
- 0.8-1.0: Highly selective, life-changing commitment (fellowships, relocations)`;

async function evaluateWithAI(
  title: string,
  url: string,
  scrapedText: string,
  metadata: {
    description?: string;
    date?: string;
    location?: string;
    source?: string;
  }
): Promise<AIEvaluation> {
  const userPrompt = `Evaluate this event candidate:

<event>
Title: ${title}
URL: ${url}
Claimed date: ${metadata.date || 'Unknown'}
Claimed location: ${metadata.location || 'Unknown'}
Source platform: ${metadata.source || 'Unknown'}
Provided description: ${metadata.description || 'None'}
</event>

<scraped_page_content>
${scrapedText || '[Page could not be scraped]'}
</scraped_page_content>

Return ONLY a JSON object, no markdown fences, no explanation outside the JSON.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250217',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: userPrompt },
    ],
    system: SYSTEM_PROMPT,
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Parse JSON from response, handling possible markdown fences
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      is_real_event: Boolean(parsed.is_real_event),
      is_relevant: Boolean(parsed.is_relevant),
      relevance_score: clamp(Number(parsed.relevance_score) || 0),
      impact_score: clamp(Number(parsed.impact_score) || 0),
      suggested_ev: clamp(Number(parsed.suggested_ev) || 0),
      suggested_friction: clamp(Number(parsed.suggested_friction) || 0),
      event_type: parsed.event_type || 'other',
      clean_title: parsed.clean_title || title,
      clean_description: parsed.clean_description || '',
      event_date: parsed.event_date || null,
      location: parsed.location || 'Unknown',
      reasoning: parsed.reasoning || '',
    };
  } catch (err) {
    console.error('Failed to parse AI response:', text.slice(0, 200));
    throw new Error('AI returned invalid JSON');
  }
}

function clamp(n: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, n));
}

// ─── Candidate Processing ──────────────────────────────────

async function evaluateCandidate(candidateId: string, force = false): Promise<'promoted' | 'rejected' | 'evaluated' | 'skipped' | 'error'> {
  // Fetch the candidate
  const { data: candidate, error } = await supabase
    .from('event_candidates')
    .select('*')
    .eq('id', candidateId)
    .single();

  if (error || !candidate) {
    console.error(`  Could not fetch candidate ${candidateId}`);
    return 'error';
  }

  // Skip if already processed (unless forced)
  if (!force && candidate.status !== 'pending') {
    return 'skipped';
  }

  console.log(`  Evaluating: "${candidate.title}"`);

  // Step 1: Scrape the URL for context
  let scrapedText = candidate.scraped_text || '';
  let scrapedMeta: { date?: string; location?: string; description?: string } = {};

  if (!scrapedText && candidate.url) {
    const scraped = await scrapeUrl(candidate.url);
    scrapedText = scraped.text;
    scrapedMeta = {
      date: scraped.date || candidate.event_date,
      location: scraped.location || candidate.location,
      description: scraped.description || candidate.description,
    };

    // Save scraped text so we don't re-scrape
    await supabase
      .from('event_candidates')
      .update({ scraped_text: scrapedText })
      .eq('id', candidateId);
  } else {
    scrapedMeta = {
      date: candidate.event_date,
      location: candidate.location,
      description: candidate.description,
    };
  }

  // Step 2: Call Claude for evaluation
  let evaluation: AIEvaluation;
  try {
    evaluation = await evaluateWithAI(
      candidate.title,
      candidate.url,
      scrapedText,
      { ...scrapedMeta, source: candidate.source }
    );
  } catch (err: any) {
    console.error(`  AI evaluation failed for "${candidate.title}":`, err.message);
    return 'error';
  }

  // Step 3: Store AI results
  await supabase
    .from('event_candidates')
    .update({
      ai_is_real_event: evaluation.is_real_event,
      ai_is_relevant: evaluation.is_relevant,
      ai_relevance_score: evaluation.relevance_score,
      ai_impact_score: evaluation.impact_score,
      ai_suggested_ev: evaluation.suggested_ev,
      ai_suggested_friction: evaluation.suggested_friction,
      ai_event_type: evaluation.event_type,
      ai_summary: evaluation.clean_description,
      ai_reasoning: evaluation.reasoning,
      processed_at: new Date().toISOString(),
      // Also update location/date if AI extracted better data
      event_date: evaluation.event_date || candidate.event_date,
      location: evaluation.location || candidate.location,
    })
    .eq('id', candidateId);

  // Step 4: Decide fate
  if (!evaluation.is_real_event || !evaluation.is_relevant || evaluation.relevance_score < AUTO_REJECT_THRESHOLD) {
    await supabase
      .from('event_candidates')
      .update({ status: 'rejected' })
      .eq('id', candidateId);
    console.log(`  ❌ Rejected: "${candidate.title}" (real=${evaluation.is_real_event}, relevant=${evaluation.is_relevant}, score=${evaluation.relevance_score.toFixed(2)})`);
    return 'rejected';
  }

  if (evaluation.is_real_event && evaluation.is_relevant && evaluation.relevance_score >= AUTO_PROMOTE_THRESHOLD) {
    // Auto-promote
    const resourceId = await promoteToResources(candidateId, candidate, evaluation);
    if (resourceId) {
      console.log(`  ✅ Promoted: "${evaluation.clean_title}" (ev=${evaluation.suggested_ev.toFixed(2)}, relevance=${evaluation.relevance_score.toFixed(2)})`);
      return 'promoted';
    }
    return 'error';
  }

  // Borderline — needs admin review
  await supabase
    .from('event_candidates')
    .update({ status: 'evaluated' })
    .eq('id', candidateId);
  console.log(`  🟡 Needs review: "${candidate.title}" (relevance=${evaluation.relevance_score.toFixed(2)})`);
  return 'evaluated';
}

async function promoteToResources(
  candidateId: string,
  candidate: any,
  evaluation: AIEvaluation
): Promise<string | null> {
  const resourceId = `eval-${candidate.source}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const { error } = await supabase.from('resources').insert({
    id: resourceId,
    title: evaluation.clean_title,
    description: evaluation.clean_description,
    url: candidate.url,
    source_org: candidate.source_org || candidate.source,
    category: 'events',
    location: evaluation.location || candidate.location || 'Global',
    min_minutes: 60,
    ev_general: evaluation.suggested_ev,
    friction: evaluation.suggested_friction,
    enabled: true,
    status: 'approved',
    event_date: evaluation.event_date || candidate.event_date || null,
    event_type: evaluation.event_type,
    activity_score: 0.9,
    url_status: 'reachable',
    source: candidate.source,
    source_id: candidate.source_id,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error(`  Failed to promote "${evaluation.clean_title}":`, error.message);
    return null;
  }

  // Mark candidate as promoted
  await supabase
    .from('event_candidates')
    .update({
      status: 'promoted',
      promoted_at: new Date().toISOString(),
      promoted_resource_id: resourceId,
    })
    .eq('id', candidateId);

  return resourceId;
}

// ─── CLI Modes ─────────────────────────────────────────────

async function processQueue(force = false) {
  const statusFilter = force ? ['pending', 'evaluated', 'rejected'] : ['pending'];

  const { data: candidates, error } = await supabase
    .from('event_candidates')
    .select('id')
    .in('status', statusFilter)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch queue:', error.message);
    return;
  }

  if (!candidates || candidates.length === 0) {
    console.log('📭 No pending candidates to evaluate.');
    return;
  }

  console.log(`📋 Processing ${candidates.length} candidates...\n`);

  const counts = { promoted: 0, rejected: 0, evaluated: 0, skipped: 0, error: 0 };

  for (const c of candidates) {
    const result = await evaluateCandidate(c.id, force);
    counts[result]++;

    // Rate limit: ~0.5s between API calls to be respectful
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n📊 Queue processing complete:`);
  console.log(`   ✅ Promoted:     ${counts.promoted}`);
  console.log(`   ❌ Rejected:     ${counts.rejected}`);
  console.log(`   🟡 Needs review: ${counts.evaluated}`);
  console.log(`   ⏭️  Skipped:      ${counts.skipped}`);
  console.log(`   💥 Errors:       ${counts.error}`);
}

async function evaluateSingleUrl(url: string) {
  console.log(`🔍 Evaluating URL: ${url}\n`);

  // Insert as candidate first
  const result = await insertCandidates([{
    title: 'Unknown (pending scrape)',
    url,
    source: 'manual',
    source_id: `manual-${Date.now()}`,
  }]);

  if (result.inserted === 0 && result.skipped > 0) {
    console.log('⏭️  This URL already exists in the pipeline. Looking it up...');

    // Find existing candidate
    const { data } = await supabase
      .from('event_candidates')
      .select('id, status')
      .ilike('url', `%${new URL(url).hostname}%${new URL(url).pathname.replace(/\/+$/, '')}%`)
      .limit(1);

    if (data?.[0]) {
      const outcome = await evaluateCandidate(data[0].id, true);
      console.log(`\nResult: ${outcome}`);
      return;
    }
    console.log('Could not find existing candidate. Try --force or check the URL.');
    return;
  }

  // Find the just-inserted candidate
  const { data: recent } = await supabase
    .from('event_candidates')
    .select('id')
    .eq('source', 'manual')
    .order('created_at', { ascending: false })
    .limit(1);

  if (recent?.[0]) {
    const outcome = await evaluateCandidate(recent[0].id, true);
    console.log(`\nResult: ${outcome}`);
  }
}

async function evaluateSingleDescription(title: string, description?: string, date?: string) {
  console.log(`🔍 Evaluating: "${title}"\n`);

  const result = await insertCandidates([{
    title,
    description,
    url: `manual://${Date.now()}`,
    source: 'manual',
    source_id: `manual-${Date.now()}`,
    event_date: date,
  }]);

  if (result.inserted === 0) {
    console.log('Failed to insert candidate.');
    return;
  }

  const { data: recent } = await supabase
    .from('event_candidates')
    .select('id')
    .eq('source', 'manual')
    .order('created_at', { ascending: false })
    .limit(1);

  if (recent?.[0]) {
    const outcome = await evaluateCandidate(recent[0].id, true);
    console.log(`\nResult: ${outcome}`);
  }
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--process-queue')) {
    const force = args.includes('--force');
    await processQueue(force);
  } else if (args.includes('--url')) {
    const urlIdx = args.indexOf('--url');
    const url = args[urlIdx + 1];
    if (!url) {
      console.error('Usage: --url <URL>');
      process.exit(1);
    }
    await evaluateSingleUrl(url);
  } else if (args.includes('--title')) {
    const titleIdx = args.indexOf('--title');
    const title = args[titleIdx + 1];
    const descIdx = args.indexOf('--description');
    const description = descIdx >= 0 ? args[descIdx + 1] : undefined;
    const dateIdx = args.indexOf('--date');
    const date = dateIdx >= 0 ? args[dateIdx + 1] : undefined;
    if (!title) {
      console.error('Usage: --title <title> [--description <desc>] [--date <YYYY-MM-DD>]');
      process.exit(1);
    }
    await evaluateSingleDescription(title, description, date);
  } else {
    console.log(`Event Evaluator — The AI gatekeeper for howdoihelp.ai

Usage:
  npx tsx scripts/evaluate-event.ts --url <URL>
  npx tsx scripts/evaluate-event.ts --title <title> [--description <desc>] [--date <YYYY-MM-DD>]
  npx tsx scripts/evaluate-event.ts --process-queue [--force]
    `);
  }
}

main().catch(err => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});
