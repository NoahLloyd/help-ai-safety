"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScoredResource, Variant } from "@/types";
import { ResourceCard } from "./resource-card";

interface EscalationSectionProps {
  resources: ScoredResource[];
  variant: Variant;
  onClickTrack?: (resourceId: string) => void;
}

export function EscalationSection({
  resources,
  variant,
  onClickTrack,
}: EscalationSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-xl p-4 text-left transition-colors hover:bg-card-hover"
      >
        <span className="text-sm font-medium text-foreground">
          Ready to go deeper?
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-muted-foreground"
        >
          ↓
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-4 pb-4">
              <p className="text-xs text-muted">
                These require more time but have higher impact.
              </p>
              {resources.map((scored) => (
                <ResourceCard
                  key={scored.resource.id}
                  scored={scored}
                  variant={variant}
                  onClickTrack={onClickTrack}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
