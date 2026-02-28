import type { Resource, ResourceCategory } from "@/types";

/** Category metadata used by both admin and public pages. */
export interface CategoryMeta {
  id: ResourceCategory;
  label: string;
  singular: string;
  description: string;
  icon: string;
  color: string;
  adminHref: string;
  publicHref: string;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: "letters",
    label: "Letters & Petitions",
    singular: "letter or petition",
    description: "Open letters, pledges, and statements to sign",
    icon: "✍",
    color: "#ef4444",
    adminHref: "/admin/letters",
    publicHref: "/letters",
  },
  {
    id: "communities",
    label: "Communities",
    singular: "community",
    description: "Groups, forums, and movements to join",
    icon: "◎",
    color: "#10b981",
    adminHref: "/admin/communities",
    publicHref: "/communities",
  },
  {
    id: "events",
    label: "Events",
    singular: "event",
    description: "Workshops, meetups, and things to attend or host",
    icon: "◈",
    color: "#f59e0b",
    adminHref: "/admin/events",
    publicHref: "/events",
  },
  {
    id: "programs",
    label: "Programs",
    singular: "program",
    description: "Courses, fellowships, grants, and training",
    icon: "▦",
    color: "#3b82f6",
    adminHref: "/admin/programs",
    publicHref: "/programs",
  },
];

/** Human-readable labels for all categories. */
export const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  events: "Events",
  programs: "Programs",
  letters: "Letters & Petitions",
  communities: "Communities",
  other: "Other",
};

/** Group resources by category. */
export function groupByCategory(
  resources: Resource[]
): Record<ResourceCategory, Resource[]> {
  const groups: Record<ResourceCategory, Resource[]> = {
    events: [],
    programs: [],
    letters: [],
    communities: [],
    other: [],
  };

  for (const r of resources) {
    groups[r.category || "other"].push(r);
  }

  return groups;
}
