"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { questionOne } from "@/data/questions";
import { getVariant, setVariant as persistVariant } from "@/lib/variants";
import {
  trackFunnelStarted,
  trackQuestionAnswered,
  identifyVariant,
} from "@/lib/tracking";
import { Questions } from "@/components/funnel/questions";
import { Results } from "@/components/funnel/results";
import type { Variant, TimeCommitment, UserAnswers } from "@/types";

type Step = "home" | "questions" | "results";

const VARIANTS: Variant[] = ["A", "B", "D"];

export default function Home() {
  const [variant, setVariantState] = useState<Variant>("A");
  const [step, setStep] = useState<Step>("home");
  const [answers, setAnswers] = useState<UserAnswers>({ time: "minutes" });
  const [isPositioned, setIsPositioned] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Push a virtual history entry when advancing steps
  function goTo(nextStep: Step) {
    history.pushState({ step: nextStep }, "");
    setStep(nextStep);
  }

  // Listen for browser back button / swipe back
  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      const prevStep = (e.state?.step as Step) || "home";
      setStep(prevStep);
    }
    window.addEventListener("popstate", onPopState);

    // Seed the initial history entry so we have something to pop back to
    history.replaceState({ step: "home" }, "");

    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
      const newAnswers = { time: "significant" as TimeCommitment, positioned: true };
      setAnswers(newAnswers);
      setIsPositioned(true);
      sessionStorage.setItem("hdih_answers", JSON.stringify(newAnswers));
      sessionStorage.setItem("hdih_variant", variant);
      goTo("questions");
    } else {
      const time = optionId as TimeCommitment;
      const newAnswers = { time };
      setAnswers(newAnswers);
      setIsPositioned(false);
      sessionStorage.setItem("hdih_answers", JSON.stringify(newAnswers));
      sessionStorage.setItem("hdih_variant", variant);

      if (variant === "A") {
        goTo("results");
      } else {
        goTo("questions");
      }
    }
  }

  const handleQuestionsComplete = useCallback((finalAnswers: UserAnswers) => {
    setAnswers(finalAnswers);
    goTo("results");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (step === "questions") {
    return (
      <Questions
        variant={variant}
        answers={answers}
        isPositioned={isPositioned}
        onComplete={handleQuestionsComplete}
      />
    );
  }

  if (step === "results") {
    return (
      <Results
        variant={variant}
        answers={answers}
      />
    );
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
          A few quick questions, then we&apos;ll point you in the right direction.
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
