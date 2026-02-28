import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Suppresses source map upload logs during build
  silent: true,

  // Don't upload source maps (requires paid plan)
  sourcemaps: {
    disable: true,
  },
});
