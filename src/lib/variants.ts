import { Variant } from "@/types";

const VARIANT_COOKIE = "hdih_variant";
const VARIANTS: Variant[] = ["A", "B", "D"];

/**
 * Get or assign a variant for this visitor.
 * Uses a cookie so they stay in the same variant across sessions.
 */
export function getVariant(): Variant {
  if (typeof document === "undefined") return "A";

  const cookies = document.cookie.split("; ");
  const existing = cookies
    .find((c) => c.startsWith(`${VARIANT_COOKIE}=`))
    ?.split("=")[1] as Variant | undefined;

  if (existing && VARIANTS.includes(existing)) {
    return existing;
  }

  // Assign randomly
  const variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];

  // Set cookie for 90 days
  const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${VARIANT_COOKIE}=${variant}; expires=${expires}; path=/; SameSite=Lax`;

  return variant;
}

/**
 * Explicitly set a variant (for the variant selector UI).
 */
export function setVariant(variant: Variant): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${VARIANT_COOKIE}=${variant}; expires=${expires}; path=/; SameSite=Lax`;
}

/**
 * Get the current variant (read-only, for server components or non-cookie contexts).
 * Falls back to "A" if no cookie found.
 */
export function getVariantFromCookieString(cookieString: string): Variant {
  const match = cookieString.match(new RegExp(`${VARIANT_COOKIE}=(\\w+)`));
  if (match && VARIANTS.includes(match[1] as Variant)) {
    return match[1] as Variant;
  }
  return "A";
}
