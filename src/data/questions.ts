import { Question, Variant } from "@/types";

/**
 * Q1 is shared across all variants.
 * Reframed to focus on readiness level rather than time.
 * The "positioned" option triggers a follow-up question.
 */
export const questionOne: Question = {
  id: "readiness",
  question: "How much can you give to this?",
  options: [
    {
      id: "minutes",
      label: "A few minutes",
    },
    {
      id: "hours",
      label: "A few hours this month",
    },
    {
      id: "significant",
      label: "A significant part of my life",
    },
    {
      id: "positioned",
      label: "I'm in a unique position to help",
    },
  ],
};

/**
 * Follow-up for people who chose "positioned" — what kind of position?
 */
export const questionPositioned: Question = {
  id: "position_type",
  question: "What kind of position are you in?",
  options: [
    {
      id: "ai_tech",
      label: "I work in AI or tech",
    },
    {
      id: "policy_gov",
      label: "I work in policy or government",
    },
    {
      id: "audience_platform",
      label: "I have an audience or platform",
    },
    {
      id: "donor",
      label: "I can fund this work",
    },
    {
      id: "other",
      label: "Something else",
    },
  ],
};

/**
 * Variant B: multi-select Q2
 */
export const questionTwoB: Question = {
  id: "intents",
  question: "What feels most true for you right now?",
  subtitle: "Select all that apply.",
  multiSelect: true,
  options: [
    {
      id: "understand",
      label: "I want to understand this better before I act",
    },
    {
      id: "connect",
      label: "I want to find others who care about this",
    },
    {
      id: "impact",
      label: "I want to do something that actually moves the needle",
    },
    {
      id: "do_part",
      label: "I want to do my part, even if it's small",
    },
  ],
};

/**
 * Variant D: single-select Q2
 */
export const questionTwoD: Question = {
  id: "intent",
  question: "What would help you most right now?",
  options: [
    {
      id: "understand",
      label: "Understand the problem",
    },
    {
      id: "connect",
      label: "Find others who care about this",
    },
    {
      id: "impact",
      label: "Take action on something concrete",
    },
    {
      id: "do_part",
      label: "Do my part, even if it's small",
    },
  ],
};

/**
 * Get the question sequence for a given variant.
 */
export function getQuestionsForVariant(variant: Variant): Question[] {
  switch (variant) {
    case "A":
      return [questionOne];
    case "B":
      return [questionOne, questionTwoB];
    case "D":
      return [questionOne, questionTwoD];
  }
}
