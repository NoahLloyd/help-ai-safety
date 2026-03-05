"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/components/providers/auth-provider";
import { useEffect, useState } from "react";
import { getGuideSettings, saveGuideSettings } from "./actions";
import type { GuideData } from "./actions";
import { ExternalLink, Pencil, Eye, EyeOff } from "lucide-react";

export default function DashboardPage() {
  const { profile, signOut } = useAuth();
  const [guide, setGuide] = useState<GuideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);

  useEffect(() => {
    getGuideSettings()
      .then(setGuide)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const firstName =
    (profile?.display_name || profile?.email?.split("@")[0] || "")
      .split(" ")[0] || "there";

  async function toggleStatus() {
    if (!guide) return;
    setTogglingStatus(true);
    const newStatus = guide.status === "active" ? "paused" : "active";
    try {
      await saveGuideSettings({ ...guide, status: newStatus });
      setGuide({ ...guide, status: newStatus });
    } catch {
      // silent
    }
    setTogglingStatus(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  // ─── No guide profile yet ────────────────────────────────
  if (!guide) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Hey {firstName}.
        </h1>

        <p className="mt-4 text-base leading-relaxed text-muted-foreground max-w-lg">
          Ready to set up your guide profile? It takes about two minutes.
          Once you&apos;re live, we&apos;ll start matching you with people
          who&apos;d benefit from your experience.
        </p>

        <div className="mt-8">
          <Link
            href="/dashboard/guide"
            className="inline-flex items-center rounded-xl bg-accent px-6 py-3.5 text-base font-medium text-white hover:bg-accent-hover transition-colors"
          >
            Set up your profile
          </Link>
        </div>
      </motion.div>
    );
  }

  // ─── Guide profile exists ────────────────────────────────

  const isActive = guide.status === "active";
  const isPaused = guide.status === "paused";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {isActive
              ? `You're live, ${firstName}.`
              : isPaused
                ? `You're paused, ${firstName}.`
                : `Almost there, ${firstName}.`}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-lg">
            {isActive
              ? "People exploring AI safety can now find and book time with you."
              : isPaused
                ? "Your profile is hidden. Toggle back to live when you're ready."
                : "Your profile is saved as a draft. Go live when you're ready."}
          </p>
        </div>

        {/* Status badge */}
        <div
          className={`shrink-0 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
            isActive
              ? "bg-emerald-500/10 text-emerald-600"
              : isPaused
                ? "bg-amber-500/10 text-amber-600"
                : "bg-gray-200 text-gray-500"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isActive
                ? "bg-emerald-500"
                : isPaused
                  ? "bg-amber-400"
                  : "bg-gray-400"
            }`}
          />
          {isActive ? "Live" : isPaused ? "Paused" : "Draft"}
        </div>
      </div>

      {/* Guide preview card */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-14 w-14 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card-hover text-base font-medium text-muted-foreground">
              {firstName[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold text-foreground">
              {profile?.display_name || "Your name"}
            </p>
            {guide.headline && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {guide.headline}
              </p>
            )}
          </div>
        </div>

        {guide.topics.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {guide.topics.map((t) => (
              <span
                key={t}
                className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 text-xs text-muted">
          30 min video call
          {guide.location ? ` · ${guide.location}` : ""}
          {guide.is_available_in_person ? " · In-person available" : ""}
        </div>

        {guide.calendar_link && (
          <div className="mt-4 pt-4 border-t border-border">
            <a
              href={guide.calendar_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                />
              </svg>
              Book a call
            </a>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/dashboard/guide"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:border-accent/50 hover:bg-card-hover transition-all"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit profile
        </Link>

        <Link
          href="/guides"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:border-accent/50 hover:bg-card-hover transition-all"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View public listing
        </Link>

        {(isActive || isPaused) && (
          <button
            onClick={toggleStatus}
            disabled={togglingStatus}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:border-accent/50 hover:bg-card-hover transition-all disabled:opacity-50 cursor-pointer"
          >
            {isActive ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                {togglingStatus ? "Pausing..." : "Pause"}
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" />
                {togglingStatus ? "Going live..." : "Go live"}
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}
