"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { questionOne } from "@/data/questions";
import { getVariant, setVariant as persistVariant } from "@/lib/variants";
import {
  trackFunnelStarted,
  trackQuestionAnswered,
  identifyVariant,
} from "@/lib/tracking";
import type { Variant, TimeCommitment } from "@/types";

const VARIANTS: Variant[] = ["A", "B", "D"];

export default function Home() {
  const router = useRouter();
  const [variant, setVariantState] = useState<Variant>("A");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useEffect(() => {
    const v = getVariant();
    setVariantState(v);
    identifyVariant(v);
    trackFunnelStarted(v);
  }, []);

  function handleVariantChange(v: Variant) {
    setVariantState(v);
    persistVariant(v);
    identifyVariant(v);
  }

  function handleSelect(optionId: string) {
    setSelectedOption(optionId);
    trackQuestionAnswered("readiness", optionId, variant);

    if (optionId === "positioned") {
      // Store that user is positioned and go to positioned follow-up
      const answers = { time: "significant" as TimeCommitment, positioned: true };
      sessionStorage.setItem("hdih_answers", JSON.stringify(answers));
      sessionStorage.setItem("hdih_variant", variant);
      router.push("/questions?positioned=1");
    } else {
      // Store time answer and navigate to questions (or results for variant A)
      const time = optionId as TimeCommitment;
      const answers = { time };
      sessionStorage.setItem("hdih_answers", JSON.stringify(answers));
      sessionStorage.setItem("hdih_variant", variant);

      // Variant A has no further questions — go straight to results
      if (variant === "A") {
        router.push("/results");
      } else {
        router.push("/questions");
      }
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <motion.div
        className="flex max-w-lg flex-col items-center text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          You want to help.
        </h1>

        <motion.p
          className="mt-4 text-lg leading-relaxed text-muted-foreground sm:text-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          AI is moving fast, and the stakes are enormous. A few quick questions
          will help us point you in the right direction.
        </motion.p>

        <motion.div
          className="mt-10 w-full"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {questionOne.question}
          </h2>

          <div className="mt-6 flex flex-col gap-3">
            {questionOne.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`w-full rounded-xl border px-4 py-4 text-left transition-all hover:border-accent/50 hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  selectedOption === option.id
                    ? "border-accent bg-accent/10"
                    : "border-border bg-card"
                }`}
              >
                <span className="block text-base font-medium">
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* Variant selector */}
      <motion.div
        className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <span>Variant:</span>
        {VARIANTS.map((v) => (
          <button
            key={v}
            onClick={() => handleVariantChange(v)}
            className={`rounded px-2 py-1 font-medium transition-colors ${
              variant === v
                ? "bg-accent text-white"
                : "hover:bg-card-hover"
            }`}
          >
            {v}
          </button>
        ))}
      </motion.div>
    </main>
  );
}
