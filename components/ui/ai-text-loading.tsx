"use client";

/**
 * @author: @kokonutui
 * @description: AI Text Loading
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "cn";

interface AITextLoadingProps {
  texts?: string[];
  className?: string;
  interval?: number;
}

export function AITextLoading({
  texts = ["Thinking...", "Processing...", "Analyzing...", "Computing...", "Almost..."],
  className,
  interval = 1500,
}: AITextLoadingProps) {
  const reduceMotion = useReducedMotion();
  const [currentTextIndex, setCurrentTextIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion || texts.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setCurrentTextIndex((prevIndex) => (prevIndex + 1) % texts.length);
    }, interval);

    return () => clearInterval(timer);
  }, [interval, reduceMotion, texts.length]);

  const label = texts[currentTextIndex] ?? texts[0] ?? "";

  if (reduceMotion) {
    return (
      <div className="flex items-center justify-center">
        <p
          className={cn(
            "whitespace-nowrap font-medium text-sm text-muted-foreground",
            className
          )}
        >
          {texts[0]}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <motion.div
        animate={{ opacity: 1 }}
        className="relative px-2 py-0.5"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            animate={{
              opacity: 1,
              y: 0,
              backgroundPosition: ["200% center", "-200% center"],
            }}
            className={cn(
              "flex min-w-max justify-center whitespace-nowrap bg-[length:200%_100%] bg-gradient-to-r from-foreground via-muted-foreground to-foreground bg-clip-text font-medium text-sm text-transparent",
              className
            )}
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: 8 }}
            key={currentTextIndex}
            transition={{
              opacity: { duration: 0.25 },
              y: { duration: 0.25 },
              backgroundPosition: {
                duration: 2.5,
                ease: "linear",
                repeat: Number.POSITIVE_INFINITY,
              },
            }}
          >
            {label}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
