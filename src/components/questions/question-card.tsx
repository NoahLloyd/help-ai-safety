"use client";

import { Question } from "@/types";

interface QuestionCardProps {
  question: Question;
  selectedAnswer: string | string[] | undefined;
  onSelect: (questionId: string, optionId: string) => void;
}

export function QuestionCard({
  question,
  selectedAnswer,
  onSelect,
}: QuestionCardProps) {
  function isSelected(optionId: string): boolean {
    if (!selectedAnswer) return false;
    if (Array.isArray(selectedAnswer)) {
      return selectedAnswer.includes(optionId);
    }
    return selectedAnswer === optionId;
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {question.question}
      </h2>

      {question.subtitle && (
        <p className="mt-2 text-sm text-muted-foreground">
          {question.subtitle}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {question.options.map((option) => {
          const selected = isSelected(option.id);

          return (
            <button
              key={option.id}
              onClick={() => onSelect(question.id, option.id)}
              className={`w-full rounded-xl border px-4 py-4 text-left transition-all hover:border-accent/50 hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                selected
                  ? "border-accent bg-accent/10"
                  : "border-border bg-card"
              }`}
            >
              <span className="block text-base font-medium">
                {option.label}
              </span>
              {option.description && (
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {option.description}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
