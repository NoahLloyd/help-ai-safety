import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Free plan: keep sample rate low to stay within 5K errors/month
  tracesSampleRate: 0,

  // Only send errors, not performance data (saves quota)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Don't send in development
  enabled: process.env.NODE_ENV === "production",
});
