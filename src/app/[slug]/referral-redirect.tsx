"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setVariant } from "@/lib/variants";
import type { Variant } from "@/types";

const REF_KEY = "hdih_ref";

/** Slugs that map to a specific variant/flow */
const FLOW_SLUGS: Record<string, Variant> = {
  profile: "A",
  browse: "B",
  questions: "C",
};

/**
 * Handles referral links and flow shortcuts.
 * - /profile, /browse, /questions → set variant and redirect to /
 * - Any other slug → store as referral and redirect to /
 */
export function ReferralRedirect({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    if (slug) {
      const variant = FLOW_SLUGS[slug];
      if (variant) {
        setVariant(variant);
      }
      sessionStorage.setItem(REF_KEY, slug);
    }
    router.replace("/");
  }, [slug, router]);

  return null;
}
