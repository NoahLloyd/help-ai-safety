"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirect to the main flow with the positioned flag.
 * This page exists for backwards compatibility with old links.
 */
export default function PositionedPage() {
  const router = useRouter();

  useEffect(() => {
    // Set up answers as if user selected "positioned" on the home page
    const answers = { time: "significant" as const, positioned: true };
    sessionStorage.setItem("hdih_answers", JSON.stringify(answers));
    router.replace("/questions?positioned=1");
  }, [router]);

  return null;
}
