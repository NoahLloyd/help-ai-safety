"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getQuestionsForVariant, questionPositioned } from "@/data/questions";
import { getVariant } from "@/lib/variants";
import {
  trackQuestionAnswered,
  trackQuestionSkipped,
} from "@/lib/tracking";
import { QuestionCard } from "@/components/questions/question-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { Question, Variant, UserAnswers, IntentTag, PositionTag } from "@/types";

function QuestionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPositioned = searchParams.get("positioned") === "1";

  const [variant, setVariant] = useState<Variant>("A");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<UserAnswers>({ time: "minutes" });
  const [hasAnsweredCurrent, setHasAnsweredCurrent] = useState(false);
  const answeredRef = useRef(false);

  useEffect(() => {
    const v = getVariant();
    setVariant(v);

    // Load answers from sessionStorage (set on home page)
    const stored = sessionStorage.getItem("hdih_answers");
    if (stored) {
      try {
        setAnswers(JSON.parse(stored));
      } catch {
        // ignore
      }
    }

    // If positioned, we show the positioned follow-up question — don't redirect
    if (isPositioned) return;

    // Variant A has no Q2 — redirect to results
    if (v === "A") {
      router.replace("/results");
    }
  }, [router, isPositioned]);

  // Track skipped question on unmount if user didn't answer
  useEffect(() => {
    answeredRef.current = false;
    return () => {
      if (!answeredRef.current && questions[currentIndex]) {
        trackQuestionSkipped(questions[currentIndex].id, variant);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // Build question sequence
  let questions: Question[];
  if (isPositioned) {
    // Positioned flow: show position type question, then optionally variant Q2
    const variantQuestions = getQuestionsForVariant(variant);
    const variantQ2 = variantQuestions.filter((q) => q.id !== "readiness" && q.id !== "time");
    questions = [questionPositioned, ...variantQ2];
  } else {
    const allQuestions = getQuestionsForVariant(variant);
    // Skip Q1 (readiness) — it was answered on the home page
    questions = allQuestions.filter((q) => q.id !== "readiness" && q.id !== "time");
  }

  const currentQuestion = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 100;

  function finish(updatedAnswers: UserAnswers) {
    sessionStorage.setItem("hdih_answers", JSON.stringify(updatedAnswers));
    sessionStorage.setItem("hdih_variant", variant);
    router.push("/results");
  }

  function handleSelect(questionId: string, optionId: string) {
    answeredRef.current = true;

    if (questionId === "position_type") {
      trackQuestionAnswered(questionId, optionId, variant);
      // Position type selection — auto-continue
      const updatedAnswers = {
        ...answers,
        positioned: true,
        positionType: optionId as PositionTag,
      };
      setAnswers(updatedAnswers);

      if (isLast) {
        finish(updatedAnswers);
      } else {
        sessionStorage.setItem("hdih_answers", JSON.stringify(updatedAnswers));
        setCurrentIndex((prev) => prev + 1);
        setHasAnsweredCurrent(false);
      }
    } else if (questionId === "intents") {
      // Multi-select for variant B
      const existing = answers.intents || [];
      const updated = existing.includes(optionId as IntentTag)
        ? existing.filter((id) => id !== optionId)
        : [...existing, optionId as IntentTag];
      const updatedAnswers = { ...answers, intents: updated };
      setAnswers(updatedAnswers);
      setHasAnsweredCurrent(updated.length > 0);
    } else if (questionId === "intent") {
      trackQuestionAnswered(questionId, optionId, variant);
      // Single-select for variant D — auto-continue
      const updatedAnswers = { ...answers, intent: optionId as IntentTag };
      setAnswers(updatedAnswers);

      if (isLast) {
        finish(updatedAnswers);
      } else {
        setCurrentIndex((prev) => prev + 1);
        setHasAnsweredCurrent(false);
      }
    }
  }

  function handleNext() {
    // Track multi-select answer on "Next" click
    if (currentQuestion?.id === "intents" && answers.intents) {
      trackQuestionAnswered("intents", answers.intents, variant);
    }

    if (isLast) {
      finish(answers);
      return;
    }
    setCurrentIndex((prev) => prev + 1);
    setHasAnsweredCurrent(false);
  }

  // Determine current answer for highlighting
  function getSelectedAnswer(): string | string[] | undefined {
    if (!currentQuestion) return undefined;
    if (currentQuestion.id === "position_type") return answers.positionType;
    if (currentQuestion.id === "intents") return answers.intents;
    if (currentQuestion.id === "intent") return answers.intent;
    return undefined;
  }

  if (!currentQuestion) return null;

  const isMultiSelect = !!currentQuestion.multiSelect;

  return (
    <main className="flex min-h-dvh flex-col px-6 py-12">
      <div className="mx-auto w-full max-w-lg">
        <ProgressBar progress={progress} />

        <div className="relative mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <QuestionCard
                question={currentQuestion}
                selectedAnswer={getSelectedAnswer()}
                onSelect={handleSelect}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Only show continue button for multi-select questions */}
        {isMultiSelect && (
          <motion.div
            className="mt-8 flex items-center justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <button
              onClick={handleNext}
              disabled={!hasAnsweredCurrent}
              className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-6 text-sm font-medium text-white transition-all hover:bg-accent-hover disabled:opacity-30 disabled:hover:bg-accent"
            >
              {isLast ? "Show me how to help" : "Next"}
            </button>
          </motion.div>
        )}
      </div>
    </main>
  );
}

export default function QuestionsPage() {
  return (
    <Suspense>
      <QuestionsContent />
    </Suspense>
  );
}
