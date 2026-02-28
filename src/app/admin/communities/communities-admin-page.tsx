"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import type { Resource } from "@/types";
import { fetchResourcesByCategory, toggleResourceEnabled, saveResource, deleteResource } from "@/app/admin/actions";
import { ResourceEditor } from "@/components/admin/resource-editor";

const PAGE_SIZE = 50;

export function CommunitiesAdminPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter state
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");    // url_status: reachable, dead, redirect, unknown, all
  const [healthFilter, setHealthFilter] = useState("all");    // all, active (>=0.2), dead (<0.2)
  const [sortField, setSortField] = useState<"title" | "activity" | "created">("title");
  
  // Pagination
  const [page, setPage] = useState(1);
  
  // Modals
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadResources = useCallback(async () => {
    try {
      const data = await fetchResourcesByCategory("communities");
      setResources(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadResources(); }, [loadResources]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ─── Actions ───
  
  async function handleToggle(id: string, enabled: boolean) {
    try {
      await toggleResourceEnabled(id, enabled);
      setResources((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function handleSave(updated: Resource) {
    try {
      await saveResource(updated);
      setResources((prev) => {
        const exists = prev.find(r => r.id === updated.id);
        if (exists) return prev.map(r => r.id === updated.id ? updated : r);
        return [updated, ...prev];
      });
      setEditingResource(null);
      showToast("Saved successfully");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  // ─── Derived State ───
  
  const sources = useMemo(() => Array.from(new Set(resources.map(r => r.source_org || "Unknown"))).sort(), [resources]);

  const filtered = useMemo(() => {
    let res = resources;
    
    // Search
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(r => 
        r.title.toLowerCase().includes(q) || 
        r.location.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        (r.url || "").toLowerCase().includes(q)
      );
    }
    
    // Filters
    if (sourceFilter !== "all") {
      res = res.filter(r => (r.source_org || "Unknown") === sourceFilter);
    }
    
    if (statusFilter !== "all") {
      res = res.filter(r => r.url_status === statusFilter);
    }
    
    if (healthFilter === "active") {
      res = res.filter(r => (r.activity_score ?? 0.5) >= 0.2);
    } else if (healthFilter === "dead") {
      res = res.filter(r => (r.activity_score ?? 0.5) < 0.2);
    }
    
    // Sorting
    res.sort((a, b) => {
      if (sortField === "title") return a.title.localeCompare(b.title);
      if (sortField === "activity") return (b.activity_score ?? 0.5) - (a.activity_score ?? 0.5);
      if (sortField === "created") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return 0;
    });
    
    return res;
  }, [resources, search, sourceFilter, statusFilter, healthFilter, sortField]);

  // Pagination
  useEffect(() => { setPage(1); }, [search, sourceFilter, statusFilter, healthFilter, sortField]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted font-mono text-sm">Loading communities vault...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background p-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded shadow-lg text-sm font-medium ${
          toast.type === "success" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin" className="text-xs font-mono text-muted hover:text-foreground mb-4 inline-block">← Dashboard</Link>
          <div className="flex items-end gap-3">
             <h1 className="text-2xl font-semibold tracking-tight">Communities Directory</h1>
             <span className="text-sm font-mono text-muted tabular-nums mb-1">{filtered.length} total</span>
          </div>
        </div>
        <button 
          onClick={() => setEditingResource({
            id: `new-${Date.now()}`, title: "", description: "", url: "", source_org: "Other",
            category: "communities", location: "Global", min_minutes: 5, ev_general: 0.5, friction: 0.2,
            enabled: true, status: "approved", created_at: new Date().toISOString()
          })}
          className="px-4 py-2 bg-foreground text-background text-sm font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer"
        >
          + Add Community
        </button>
      </div>

      {/* Controls Bar */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-4">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
             <input
               type="text"
               placeholder="Search title, description, URL, location..."
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="w-full pl-3 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:border-accent outline-none"
             />
          </div>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="py-2 px-3 bg-background border border-border rounded-lg text-sm">
            <option value="all">All Sources</option>
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value)} className="py-2 px-3 bg-background border border-border rounded-lg text-sm">
            <option value="all">All Health</option>
            <option value="active">Active (Score ≥0.2)</option>
            <option value="dead">Dead / Inactive (Score &lt;0.2)</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="py-2 px-3 bg-background border border-border rounded-lg text-sm">
            <option value="all">Any HTTP Status</option>
            <option value="reachable">Reachable (200)</option>
            <option value="redirect">Redirects</option>
            <option value="dead">Dead / Blocked</option>
            <option value="unknown">Unknown</option>
          </select>
          <select value={sortField} onChange={(e) => setSortField(e.target.value as any)} className="py-2 px-3 bg-background border border-border rounded-lg text-sm">
            <option value="title">Sort: Title A-Z</option>
            <option value="activity">Sort: Highest Activity</option>
            <option value="created">Sort: Newest Added</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/30 text-xs font-mono text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium">On</th>
                <th className="px-4 py-3 font-medium">Community</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.map(r => {
                const isDeadUrl = r.url_status === "dead";
                const isLowScore = (r.activity_score ?? 0.5) < 0.2;
                
                return (
                  <tr key={r.id} onClick={() => setEditingResource(r)} className="hover:bg-muted/10 transition-colors cursor-pointer">
                    <td className="px-4 py-3 w-10">
                      <input 
                        type="checkbox" 
                        checked={r.enabled}
                        onChange={(e) => {
                          handleToggle(r.id, e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-accent w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 min-w-[300px] max-w-[400px]">
                      <div className="truncate font-medium text-foreground">{r.title}</div>
                      <a href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-muted font-mono hover:text-accent truncate block mt-0.5">
                        {r.url?.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    </td>
                    <td className="px-4 py-3 w-40">
                      <span className="text-xs bg-muted/30 px-2 py-1 rounded text-foreground">{r.location || "Global"}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted w-32">
                      {r.source_org}
                    </td>
                    <td className="px-4 py-3 w-32">
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center gap-1.5 focus:outline-none">
                           <span className={`w-1.5 h-1.5 rounded-full ${isDeadUrl ? 'bg-red-500' : r.url_status === 'reachable' ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
                           <span className="capitalize">{r.url_status}</span>
                        </div>
                        <div className={`font-mono text-[10px] ${isLowScore ? 'text-red-500' : 'text-emerald-500'}`}>
                          Score: {(r.activity_score || 0).toFixed(2)}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted font-mono text-sm">
                    No communities found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between text-[11px] font-mono">
            <div className="text-muted">
              Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-border bg-card rounded disabled:opacity-50 hover:bg-muted/40 cursor-pointer"
              >
                PREV
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-border bg-card rounded disabled:opacity-50 hover:bg-muted/40 cursor-pointer"
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>

      {editingResource && (
        <ResourceEditor 
          resource={editingResource}
          isNew={editingResource.id.startsWith("new-")}
          onSave={handleSave}
          onArchive={async (id) => {
              try {
                if (editingResource) {
                   const updated = { ...editingResource, enabled: false, status: "rejected" as const };
                   await saveResource(updated);
                   setResources(prev => prev.map(r => r.id === id ? updated : r));
                   setEditingResource(null);
                   showToast("Archived successfully");
                }
              } catch(err) {
                showToast(err instanceof Error ? err.message : "Failed to archive", "error");
              }
          }}
          onCancel={() => setEditingResource(null)}
        />
      )}
    </div>
  );
}
