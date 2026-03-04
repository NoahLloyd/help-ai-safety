"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const fade = (delay: number = 0) => ({
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.45, delay, ease: "easeOut" as const },
});

const LINKS = [
  {
    href: "/communities",
    label: "Communities",
    detail: "Groups, chapters, and meetups by location and topic",
  },
  {
    href: "/events",
    label: "Events",
    detail: "Conferences, workshops, and gatherings",
  },
  {
    href: "/developers",
    label: "API",
    detail: "Open data, no auth required, JSON and CSV",
  },
];

export function AboutContent() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-xl px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
        {/* Back */}
        <motion.div {...fade()}>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Back
          </Link>
        </motion.div>

        {/* Title */}
        <motion.h1
          {...fade(0.08)}
          className="mt-10 text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          howdoihelp.ai
        </motion.h1>

        {/* One-liner */}
        <motion.p
          {...fade(0.14)}
          className="mt-4 text-base leading-relaxed text-muted-foreground"
        >
          We collect AI safety communities, events, and programs from across
          the ecosystem and rank them for you based on your background,
          location, and availability.
        </motion.p>

        {/* Links */}
        <motion.div {...fade(0.2)} className="mt-10 flex flex-col gap-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-accent/30"
            >
              <div>
                <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                  {link.label}
                </span>
                <span className="ml-3 text-xs text-muted-foreground">
                  {link.detail}
                </span>
              </div>
              <span className="text-muted-foreground/30 group-hover:text-accent transition-colors">
                &rarr;
              </span>
            </Link>
          ))}
        </motion.div>

        {/* Contact */}
        <motion.p
          {...fade(0.26)}
          className="mt-12 text-sm text-muted-foreground"
        >
          Built by Noah.{" "}
          <a
            href="mailto:n@noahlr.com"
            className="text-accent hover:underline"
          >
            n@noahlr.com
          </a>
        </motion.p>
      </div>
    </div>
  );
}
