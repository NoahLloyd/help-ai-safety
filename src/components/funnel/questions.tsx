"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getQuestionsForVariant, questionPositioned } from "@/data/questions";
import {
  trackQuestionAnswered,
  trackQuestionSkipped,
} from "@/lib/tracking";
import { QuestionCard } from "@/components/questions/question-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { Question, Variant, UserAnswers, IntentTag, PositionTag } from "@/types";

interface QuestionsProps {
  variant: Variant;
  answers: UserAnswers;
  isPositioned: boolean;
  onComplete: (answers: UserAnswers) => void;
}

export function Questions({ variant, answers: initialAnswers, isPositioned, onComplete }: QuestionsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<UserAnswers>(initialAnswers);
  const answeredRef = useRef(false);

  // Variant A has no Q2 — go straight to results
  useEffect(() => {
    if (!isPositioned && variant === "A") {
      onComplete(initialAnswers);
    }
  }, [variant, isPositioned, initialAnswers, onComplete]);

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
    const variantQuestions = getQuestionsForVariant(variant);
    const variantQ2 = variantQuestions.filter((q) => q.id !== "readiness" && q.id !== "time");
    questions = [questionPositioned, ...variantQ2];
  } else {
    const allQuestions = getQuestionsForVariant(variant);
    questions = allQuestions.filter((q) => q.id !== "readiness" && q.id !== "time");
  }

  const currentQuestion = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 100;

  function finish(updatedAnswers: UserAnswers) {
    sessionStorage.setItem("hdih_answers", JSON.stringify(updatedAnswers));
    onComplete(updatedAnswers);
  }

  function handleSelect(questionId: string, optionId: string) {
    answeredRef.current = true;

    if (questionId === "position_type") {
      trackQuestionAnswered(questionId, optionId, variant);
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

      }
    } else if (questionId === "intent") {
      trackQuestionAnswered(questionId, optionId, variant);
      const updatedAnswers = { ...answers, intent: optionId as IntentTag };
      setAnswers(updatedAnswers);

      if (isLast) {
        finish(updatedAnswers);
      } else {
        setCurrentIndex((prev) => prev + 1);

      }
    }
  }

  function getSelectedAnswer(): string | string[] | undefined {
    if (!currentQuestion) return undefined;
    if (currentQuestion.id === "position_type") return answers.positionType;
    if (currentQuestion.id === "intent") return answers.intent;
    return undefined;
  }

  if (!currentQuestion) return null;

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
      </div>
    </main>
  );
}
