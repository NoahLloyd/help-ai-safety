"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initPostHog, posthog } from "@/lib/posthog";
import { trackReferralLanded } from "@/lib/tracking";

const REF_KEY = "hdih_ref";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initPostHog();

    // Pick up affiliate referral stored by the [slug] catch-all route
    const ref = sessionStorage.getItem(REF_KEY);
    if (ref) {
      trackReferralLanded(ref);
      sessionStorage.removeItem(REF_KEY);
    }
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (!pathname) return;
    const url = window.origin + pathname + (searchParams?.toString() ? `?${searchParams}` : "");
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return <>{children}</>;
}
