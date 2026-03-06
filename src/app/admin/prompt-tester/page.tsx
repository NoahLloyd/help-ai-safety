"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { DEFAULT_PROMPTS, type PromptKey, type PromptVersion } from "@/lib/prompts";
import { AVAILABLE_MODELS } from "@/lib/llm";
import {
  fetchPromptVersions,
  savePromptVersion,
  activatePromptVersion,
  deactivatePromptVersion,
} from "../actions";

// ─── Types ──────────────────────────────────────────────────

type SearchProvider = "perplexity" | "exa" | "tavily";

interface RunResult {
  text: string;
  parsedJson?: unknown;
  citations?: string[];
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  latencyMs: number;
  model: string;
}

const TABS: { key: PromptKey; label: string }[] = [
  { key: "recommend", label: "Recommend" },
  { key: "extract", label: "Extract" },
  { key: "search", label: "Search" },
];

const DRAFT_KEY = (key: PromptKey) => `prompt-workbench-draft-${key}`;
const INPUT_KEY = (key: PromptKey) => `prompt-workbench-input-${key}`;

// ─── Component ──────────────────────────────────────────────

export default function PromptWorkbenchPage() {
  const [activeTab, setActiveTab] = useState<PromptKey>("recommend");
  const [showHistory, setShowHistory] = useState(false);

  // Per-tab state
  const [prompts, setPrompts] = useState<Record<PromptKey, string>>({
    recommend: DEFAULT_PROMPTS.recommend,
    extract: DEFAULT_PROMPTS.extract,
    search: DEFAULT_PROMPTS.search,
  });
  const [models, setModels] = useState<Record<PromptKey, string>>({
    recommend: "",
    extract: "",
    search: "",
  });
  const [inputs, setInputs] = useState<Record<PromptKey, string>>({
    recommend: "",
    extract: "",
    search: "",
  });
  const [maxTokens, setMaxTokens] = useState<Record<PromptKey, number>>({
    recommend: 8192,
    extract: 1500,
    search: 4096,
  });

  // Search provider (only for search tab)
  const [searchProvider, setSearchProvider] = useState<SearchProvider>("perplexity");

  // Results & state
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState("");

  // Version history
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Diff view
  const [diffVersions, setDiffVersions] = useState<[number | null, number | null]>([null, null]);

  const promptRef = useRef<HTMLTextAreaElement>(null);

  // ─── Load drafts from localStorage ────────────────────────

  useEffect(() => {
    const newPrompts = { ...prompts };
    const newInputs = { ...inputs };
    let changed = false;

    for (const key of ["recommend", "extract", "search"] as PromptKey[]) {
      const draft = localStorage.getItem(DRAFT_KEY(key));
      if (draft) {
        newPrompts[key] = draft;
        changed = true;
      }
      const savedInput = localStorage.getItem(INPUT_KEY(key));
      if (savedInput) {
        newInputs[key] = savedInput;
        changed = true;
      }
    }

    if (changed) {
      setPrompts(newPrompts);
      setInputs(newInputs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Auto-save drafts ────────────────────────────────────

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY(activeTab), prompts[activeTab]);
  }, [prompts, activeTab]);

  useEffect(() => {
    localStorage.setItem(INPUT_KEY(activeTab), inputs[activeTab]);
  }, [inputs, activeTab]);

  // ─── Load versions when tab changes or history opens ──────

  const loadVersions = useCallback(async () => {
    setLoadingVersions(true);
    try {
      const v = await fetchPromptVersions(activeTab);
      setVersions(v);
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (showHistory) loadVersions();
  }, [showHistory, loadVersions]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  // ─── Run prompt ──────────────────────────────────────────

  const runPrompt = useCallback(async () => {
    const prompt = prompts[activeTab];
    const input = inputs[activeTab];

    if (activeTab !== "search" || searchProvider === "perplexity") {
      if (!prompt.trim()) {
        setError("Prompt is empty");
        return;
      }
    }
    if (!input.trim()) {
      setError("Test input is empty");
      return;
    }

    setError(null);
    setRunning(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/run-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptKey: activeTab,
          systemPrompt: prompt,
          userContent: input,
          model: models[activeTab] || undefined,
          maxTokens: maxTokens[activeTab],
          searchProvider: activeTab === "search" ? searchProvider : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  }, [activeTab, prompts, inputs, models, maxTokens, searchProvider]);

  // ─── Cmd+Enter shortcut ──────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        runPrompt();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runPrompt]);

  // ─── Save version ───────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    try {
      await savePromptVersion(
        activeTab,
        prompts[activeTab],
        models[activeTab] || null,
        saveNote || null,
      );
      setSaveNote("");
      await loadVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ─── Activate/deactivate ─────────────────────────────────

  async function handleActivate(id: number) {
    try {
      await activatePromptVersion(id);
      await loadVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    }
  }

  async function handleDeactivate(id: number) {
    try {
      await deactivatePromptVersion(id);
      await loadVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deactivation failed");
    }
  }

  // ─── Load version into editor ────────────────────────────

  function loadVersion(v: PromptVersion) {
    setPrompts((p) => ({ ...p, [activeTab]: v.content }));
    if (v.model) setModels((m) => ({ ...m, [activeTab]: v.model! }));
  }

  // ─── Sample data ─────────────────────────────────────────

  function loadSample() {
    if (activeTab === "recommend") {
      setInputs((i) => ({
        ...i,
        recommend: `<user_profile>
Data source: bright_data (high confidence)
Name: Jane Smith
Headline: Software Engineer at Google
Current role: Software Engineer at Google
Location: San Francisco, CA
Summary: ML engineer focused on large language models. Previously worked on NLP at Meta.
Background & credentials:
  - Python, PyTorch, TensorFlow
  - Machine Learning, NLP
  - Stanford CS PhD
Experience:
  - Software Engineer at Google
  - Research Engineer at Meta
Education:
  - PhD Computer Science at Stanford University
</user_profile>

<user_answers>
Time commitment: significant
Intent: I want to understand AI risks and contribute technically
</user_answers>

<user_location>
City: San Francisco
Region: California
Country: United States (US)
</user_location>

<available_resources>
[alignment-research-center] "ARC Fellowship" - Research fellowship for AI alignment (programs, San Francisco, 2400min, ev=0.9, friction=0.7)

[aisafety-camp] "AI Safety Camp" - Intensive research program (programs, Online, 4800min, ev=0.85, friction=0.6)

[80k-hours-career] "80,000 Hours Career Guide" - Career advice for high-impact careers (careers, Online, 60min, ev=0.7, friction=0.1)

[lesswrong-community] "LessWrong" - Online community for rationality and AI safety (communities, Online, 30min, ev=0.5, friction=0.1)

[aisf-petition] "AI Safety Petition" - Sign the open letter (letters, Online, 5min, ev=0.3, friction=0.05)
</available_resources>

Pick the 4-6 BEST resources for this specific person. Include at most 1 event or community. Return a JSON array ordered by rank (1 = best match).`,
      }));
    } else if (activeTab === "extract") {
      setInputs((i) => ({
        ...i,
        extract: `LinkedIn - John Doe

John Doe
AI Safety Researcher at Anthropic

San Francisco Bay Area

About
I work on making AI systems safer and more reliable. Previously I was a research scientist at DeepMind working on reinforcement learning. I'm passionate about ensuring AI development goes well for humanity.

Experience
AI Safety Researcher
Anthropic
Jan 2023 - Present

Research Scientist
DeepMind
2019 - 2022

Software Engineer
Google Brain
2017 - 2019

Education
Massachusetts Institute of Technology
PhD, Computer Science
2013 - 2017

University of Cambridge
BA, Mathematics
2009 - 2013

Skills
Machine Learning, Python, PyTorch, TensorFlow, Reinforcement Learning, AI Safety, Research`,
      }));
    } else {
      setInputs((i) => ({
        ...i,
        search: "Geoffrey Hinton AI researcher",
      }));
    }
  }

  // ─── Diff view ───────────────────────────────────────────

  const diffA = diffVersions[0] != null ? versions.find((v) => v.id === diffVersions[0]) : null;
  const diffB = diffVersions[1] != null ? versions.find((v) => v.id === diffVersions[1]) : null;

  function renderDiff(a: string, b: string) {
    const aLines = a.split("\n");
    const bLines = b.split("\n");
    const maxLen = Math.max(aLines.length, bLines.length);
    const lines: { type: "same" | "removed" | "added" | "changed"; a?: string; b?: string }[] = [];

    for (let i = 0; i < maxLen; i++) {
      const la = aLines[i];
      const lb = bLines[i];
      if (la === lb) {
        lines.push({ type: "same", a: la });
      } else if (la != null && lb != null) {
        lines.push({ type: "changed", a: la, b: lb });
      } else if (la != null) {
        lines.push({ type: "removed", a: la });
      } else {
        lines.push({ type: "added", b: lb });
      }
    }

    return (
      <div className="text-[11px] font-mono leading-relaxed max-h-[500px] overflow-auto">
        {lines.map((l, i) => (
          <div key={i}>
            {l.type === "same" && (
              <div className="text-muted px-2 py-0.5">{l.a}</div>
            )}
            {l.type === "removed" && (
              <div className="text-rose-400 bg-rose-500/10 px-2 py-0.5">- {l.a}</div>
            )}
            {l.type === "added" && (
              <div className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5">+ {l.b}</div>
            )}
            {l.type === "changed" && (
              <>
                <div className="text-rose-400 bg-rose-500/10 px-2 py-0.5">- {l.a}</div>
                <div className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5">+ {l.b}</div>
              </>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────

  const activeVersion = versions.find((v) => v.is_active);

  return (
    <div className="min-h-dvh bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-6 py-3">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-muted hover:text-foreground text-sm">
              Dashboard
            </Link>
            <span className="text-muted">/</span>
            <h1 className="text-base font-semibold text-foreground">Prompt Workbench</h1>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setResult(null);
                  setError(null);
                }}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeTab === tab.key
                    ? "bg-foreground text-background"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {activeVersion && (
              <span className="text-[11px] font-mono text-accent bg-accent/10 px-2 py-1 rounded">
                v{activeVersion.version} active
              </span>
            )}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors cursor-pointer ${
                showHistory
                  ? "bg-foreground/10 border-foreground/20 text-foreground"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              History
            </button>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-500 max-w-[1800px] lg:mx-auto">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline cursor-pointer">dismiss</button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex max-w-[1800px] mx-auto">
        {/* Left Panel: Editor */}
        <div className={`flex-1 min-w-0 p-6 ${showHistory ? "lg:pr-3" : ""}`}>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Prompt Editor */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-medium text-foreground">System Prompt</h2>
                <button
                  onClick={() => {
                    setPrompts((p) => ({ ...p, [activeTab]: DEFAULT_PROMPTS[activeTab] }));
                  }}
                  className="text-[11px] text-muted hover:text-foreground cursor-pointer"
                >
                  reset to default
                </button>
              </div>

              <textarea
                ref={promptRef}
                value={prompts[activeTab]}
                onChange={(e) => setPrompts((p) => ({ ...p, [activeTab]: e.target.value }))}
                className="flex-1 min-h-[400px] px-3 py-2.5 bg-card border border-border rounded-lg text-xs
                  text-foreground font-mono leading-relaxed resize-y outline-none focus:border-accent"
                spellCheck={false}
              />

              {/* Controls row */}
              <div className="flex items-center gap-3 mt-3">
                {/* Model selector */}
                {(activeTab !== "search" || searchProvider === "perplexity") && (
                  <select
                    value={models[activeTab]}
                    onChange={(e) => setModels((m) => ({ ...m, [activeTab]: e.target.value }))}
                    className="px-2 py-1.5 text-[11px] bg-card border border-border rounded-md
                      text-foreground outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="">Default model</option>
                    {AVAILABLE_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} (${m.inputCostPerM}/{m.outputCostPerM} per M)
                      </option>
                    ))}
                  </select>
                )}

                {/* Search provider selector */}
                {activeTab === "search" && (
                  <select
                    value={searchProvider}
                    onChange={(e) => setSearchProvider(e.target.value as SearchProvider)}
                    className="px-2 py-1.5 text-[11px] bg-card border border-border rounded-md
                      text-foreground outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="perplexity">Perplexity</option>
                    <option value="exa">Exa</option>
                    <option value="tavily">Tavily</option>
                  </select>
                )}

                {/* Max tokens */}
                {activeTab !== "search" && (
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] text-muted">Max tokens:</label>
                    <input
                      type="number"
                      value={maxTokens[activeTab]}
                      onChange={(e) =>
                        setMaxTokens((t) => ({ ...t, [activeTab]: parseInt(e.target.value) || 1000 }))
                      }
                      className="w-20 px-2 py-1.5 text-[11px] bg-card border border-border rounded-md
                        text-foreground outline-none focus:border-accent"
                    />
                  </div>
                )}
              </div>

              {/* Save row */}
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="text"
                  value={saveNote}
                  onChange={(e) => setSaveNote(e.target.value)}
                  placeholder="Version note (optional)"
                  className="flex-1 px-2.5 py-1.5 text-xs bg-card border border-border rounded-md
                    text-foreground placeholder:text-muted outline-none focus:border-accent"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                  }}
                />
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 text-xs font-medium bg-foreground/10 text-foreground
                    border border-border rounded-lg hover:bg-foreground/20 transition-colors
                    disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  {saving ? "Saving..." : "Save Version"}
                </button>
              </div>
            </div>

            {/* Right Panel: Test Runner */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-medium text-foreground">
                  {activeTab === "recommend" ? "Test Profile & Resources" :
                   activeTab === "extract" ? "Raw Profile Text" :
                   "Search Query"}
                </h2>
                <button
                  onClick={loadSample}
                  className="text-[11px] text-accent hover:text-accent/80 cursor-pointer"
                >
                  load sample
                </button>
              </div>

              <textarea
                value={inputs[activeTab]}
                onChange={(e) => setInputs((i) => ({ ...i, [activeTab]: e.target.value }))}
                rows={activeTab === "search" ? 3 : 8}
                placeholder={
                  activeTab === "recommend" ? "Paste profile, answers, and resources..." :
                  activeTab === "extract" ? "Paste raw LinkedIn HTML/text..." :
                  "Enter a person's name or query..."
                }
                className="px-3 py-2.5 bg-card border border-border rounded-lg text-xs
                  text-foreground font-mono leading-relaxed resize-y outline-none focus:border-accent
                  placeholder:text-muted"
                spellCheck={false}
              />

              {/* Run button */}
              <button
                onClick={runPrompt}
                disabled={running}
                className="mt-3 px-6 py-3 text-sm font-medium bg-accent text-white
                  rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
              >
                {running ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Running...
                  </span>
                ) : (
                  <>Run <span className="text-white/60 ml-1 text-xs font-normal">(Cmd+Enter)</span></>
                )}
              </button>

              {/* Results */}
              {result && (
                <div className="mt-4 flex flex-col gap-3">
                  {/* Metadata bar */}
                  <div className="flex items-center gap-4 text-[11px] font-mono text-muted">
                    <span>{result.latencyMs}ms</span>
                    {result.inputTokens > 0 && (
                      <span>{result.inputTokens}in / {result.outputTokens}out</span>
                    )}
                    <span>${result.estimatedCost.toFixed(4)}</span>
                    <span className="text-accent/70 bg-accent/10 px-1.5 py-0.5 rounded">
                      {result.model}
                    </span>
                  </div>

                  {/* Text output */}
                  <div className="bg-card border border-border rounded-lg p-4 max-h-[600px] overflow-auto">
                    <pre className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed font-mono">
                      {result.parsedJson
                        ? JSON.stringify(result.parsedJson, null, 2)
                        : result.text}
                    </pre>
                  </div>

                  {/* Citations */}
                  {result.citations && result.citations.length > 0 && (
                    <div>
                      <h3 className="text-[11px] font-medium text-muted mb-1.5">
                        Citations ({result.citations.length})
                      </h3>
                      <div className="flex flex-col gap-0.5">
                        {result.citations.map((c, i) => (
                          <a
                            key={i}
                            href={c}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-accent hover:underline truncate"
                          >
                            {c}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Drawer: Version History */}
        {showHistory && (
          <div className="w-[380px] border-l border-border bg-card p-5 overflow-y-auto max-h-[calc(100dvh-57px)] sticky top-[57px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-foreground">
                Version History
              </h2>
              {loadingVersions && (
                <span className="w-3 h-3 border-2 border-muted/30 border-t-muted rounded-full animate-spin" />
              )}
            </div>

            {versions.length === 0 && !loadingVersions && (
              <p className="text-xs text-muted italic">
                No saved versions yet. Edit the prompt and click &ldquo;Save Version&rdquo;.
              </p>
            )}

            {/* Diff controls */}
            {versions.length >= 2 && (
              <div className="mb-4 p-3 bg-background rounded-lg border border-border">
                <h3 className="text-[11px] font-medium text-muted mb-2">Compare versions</h3>
                <div className="flex items-center gap-2">
                  <select
                    value={diffVersions[0] ?? ""}
                    onChange={(e) => setDiffVersions([e.target.value ? Number(e.target.value) : null, diffVersions[1]])}
                    className="flex-1 px-2 py-1 text-[11px] bg-card border border-border rounded-md text-foreground cursor-pointer"
                  >
                    <option value="">Select A</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>v{v.version}</option>
                    ))}
                  </select>
                  <span className="text-muted text-[11px]">vs</span>
                  <select
                    value={diffVersions[1] ?? ""}
                    onChange={(e) => setDiffVersions([diffVersions[0], e.target.value ? Number(e.target.value) : null])}
                    className="flex-1 px-2 py-1 text-[11px] bg-card border border-border rounded-md text-foreground cursor-pointer"
                  >
                    <option value="">Select B</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>v{v.version}</option>
                    ))}
                  </select>
                </div>
                {diffA && diffB && (
                  <div className="mt-3 rounded-lg bg-background border border-border overflow-hidden">
                    {renderDiff(diffA.content, diffB.content)}
                  </div>
                )}
              </div>
            )}

            {/* Version list */}
            <div className="flex flex-col gap-2">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    v.is_active
                      ? "border-accent/40 bg-accent/5"
                      : "border-border bg-background hover:border-foreground/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">v{v.version}</span>
                      {v.is_active && (
                        <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                          active
                        </span>
                      )}
                      {v.model && (
                        <span className="text-[10px] font-mono text-muted">{v.model}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {v.note && (
                    <p className="text-[11px] text-muted mb-2">{v.note}</p>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => loadVersion(v)}
                      className="text-[11px] text-accent hover:underline cursor-pointer"
                    >
                      Load
                    </button>
                    <span className="text-muted text-[10px]">|</span>
                    {v.is_active ? (
                      <button
                        onClick={() => handleDeactivate(v.id)}
                        className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivate(v.id)}
                        className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                      >
                        Activate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
