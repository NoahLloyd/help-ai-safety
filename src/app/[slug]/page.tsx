"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

const REF_KEY = "hdih_ref";

/**
 * Catch-all for affiliate/creator referral links.
 * Static routes (e.g. /events, /communities, /admin) take priority
 * in Next.js, so this only fires for unknown slugs.
 *
 * Stores the referral slug and redirects to the homepage.
 */
export default function ReferralPage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    if (slug) {
      sessionStorage.setItem(REF_KEY, slug);
    }
    router.replace("/");
  }, [slug, router]);

  return null;
}
