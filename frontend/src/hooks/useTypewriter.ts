"use client";

import { useState, useEffect, useRef } from "react";

/**
 * useTypewriter — Character-by-character text reveal hook.
 *
 * Drives the "AI is thinking" terminal effect in the dashboard.
 * Uses requestAnimationFrame-gated setTimeout for buttery 60fps
 * rendering even on long JSON strings (~2KB+).
 *
 * @param text   The full string to type out
 * @param speed  Milliseconds between each character (default 20ms)
 * @param delay  Initial delay before typing starts (default 0ms)
 * @returns      { displayText, isTyping, reset }
 */
export function useTypewriter(
  text: string,
  speed: number = 20,
  delay: number = 0
) {
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    // Reset state when text changes without triggering synchronous cascade
    setTimeout(() => {
      indexRef.current = 0;
      setDisplayText("");
      setIsTyping(true);
      startedRef.current = false;
    }, 0);

    const startTyping = () => {
      startedRef.current = true;

      const tick = () => {
        if (indexRef.current < text.length) {
          // Batch 1-3 chars per tick for speed variation on whitespace
          let charsToAdd = 1;
          const nextChar = text[indexRef.current];
          if (nextChar === " " || nextChar === "\n") {
            charsToAdd = Math.min(3, text.length - indexRef.current);
          }

          const end = Math.min(indexRef.current + charsToAdd, text.length);
          const chunk = text.slice(0, end);
          indexRef.current = end;

          setDisplayText(chunk);
          timerRef.current = setTimeout(tick, speed);
        } else {
          setIsTyping(false);
        }
      };

      tick();
    };

    // Optional initial delay (e.g., to stagger multiple blocks)
    const delayTimer = setTimeout(startTyping, delay);

    return () => {
      clearTimeout(delayTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, speed, delay]);

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    indexRef.current = 0;
    setDisplayText("");
    setIsTyping(true);

    const tick = () => {
      if (indexRef.current < text.length) {
        let charsToAdd = 1;
        const nextChar = text[indexRef.current];
        if (nextChar === " " || nextChar === "\n") {
          charsToAdd = Math.min(3, text.length - indexRef.current);
        }
        const end = Math.min(indexRef.current + charsToAdd, text.length);
        indexRef.current = end;
        setDisplayText(text.slice(0, end));
        timerRef.current = setTimeout(tick, speed);
      } else {
        setIsTyping(false);
      }
    };

    timerRef.current = setTimeout(tick, delay);
  };

  return { displayText, isTyping, reset };
}
