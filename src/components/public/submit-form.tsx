"use client";

import { useState } from "react";
import type { CategoryMeta } from "@/lib/categories";
import { submitResource, type SubmitResourceInput } from "@/app/submit/actions";

interface SubmitFormProps {
  category: CategoryMeta;
  onClose: () => void;
}

export function SubmitForm({ category, onClose }: SubmitFormProps) {
  const [form, setForm] = useState<SubmitResourceInput>({
    title: "",
    description: "",
    url: "",
    source_org: "",
    category: category.id,
    location: "",
    event_date: undefined,
    submitted_by: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitResource(form);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    }
    setSubmitting(false);
  }

  const inputCls = "w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none transition-colors";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-16 px-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl mb-12"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          /* Success state */
          <div className="px-6 py-10 text-center">
            <div className="text-4xl mb-3">✓</div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Submitted!</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Thanks for your submission. It will appear publicly once an admin reviews and approves it.
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">
                Submit a {category.singular}
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Your submission will be reviewed before appearing publicly.
              </p>
            </div>

            <div className="px-6 py-5 space-y-4">
              <label className="block">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Title <span className="text-rose-400">*</span>
                </span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputCls}
                  placeholder={
                    category.id === "communities" ? "PauseAI NYC" :
                    category.id === "events" ? "AI Safety Reading Group" :
                    category.id === "programs" ? "AI Safety Fellowship" :
                    "Sign the petition"
                  }
                  required
                  maxLength={200}
                />
              </label>

              <label className="block">
                <span className="text-xs text-muted-foreground mb-1 block">Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={`${inputCls} resize-y min-h-[60px]`}
                  rows={2}
                  placeholder="Brief description of what this is about"
                  maxLength={1000}
                />
              </label>

              <label className="block">
                <span className="text-xs text-muted-foreground mb-1 block">
                  URL <span className="text-rose-400">*</span>
                </span>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className={`${inputCls} font-mono text-xs`}
                  placeholder="https://..."
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="text-xs text-muted-foreground mb-1 block">Organization</span>
                  <input
                    type="text"
                    value={form.source_org}
                    onChange={(e) => setForm({ ...form, source_org: e.target.value })}
                    className={inputCls}
                    placeholder="PauseAI, EA, etc."
                  />
                </label>
                <label>
                  <span className="text-xs text-muted-foreground mb-1 block">Location</span>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className={inputCls}
                    placeholder="New York, USA"
                  />
                </label>
              </div>

              {category.id === "events" && (
                <label className="block">
                  <span className="text-xs text-muted-foreground mb-1 block">Event Date</span>
                  <input
                    type="date"
                    value={form.event_date || ""}
                    onChange={(e) => setForm({ ...form, event_date: e.target.value || undefined })}
                    className={`${inputCls} font-mono text-xs`}
                  />
                </label>
              )}

              <label className="block">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Your name or email <span className="text-rose-400">*</span>
                </span>
                <input
                  type="text"
                  value={form.submitted_by}
                  onChange={(e) => setForm({ ...form, submitted_by: e.target.value })}
                  className={inputCls}
                  placeholder="jane@example.com"
                  required
                />
              </label>

              {error && (
                <p className="text-xs text-rose-500 bg-rose-500/10 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-muted-foreground border border-border rounded-md hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-medium bg-accent text-white rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "Submitting..." : "Submit for review"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
