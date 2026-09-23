"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

interface TooltipProps {
  children: React.ReactElement;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export function Tooltip({ children, content, position = "top", delay = 200 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [positionState, setPositionState] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const show = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPositionState({
          top: position === "bottom" ? rect.bottom + 8 : rect.top - 8,
          left: rect.left + rect.width / 2,
        });
        setVisible(true);
      }
    }, delay);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  const triggerProps = {
    ref: triggerRef,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  };

  const tooltip = (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: position === "top" ? 8 : -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: position === "top" ? -8 : 8 }}
          className="fixed z-50 pointer-events-none"
          style={{
            top: positionState.top,
            left: positionState.left,
            transform: "translateX(-50%)" + (position === "top" ? " translateY(-100%)" : ""),
          }}
        >
          <div className="bg-muted px-3 py-1.5 rounded text-xs text-muted-foreground whitespace-nowrap shadow-lg border border-border">
            {content}
          </div>
          <div
            className="absolute w-0 h-0 border-4 border-transparent"
            style={{
              bottom: position === "top" ? -8 : undefined,
              top: position === "bottom" ? -8 : undefined,
              left: "50%",
              transform: "translateX(-50%)",
              borderTopColor: position === "bottom" ? "hsl(var(--muted))" : undefined,
              borderBottomColor: position === "top" ? "hsl(var(--muted))" : undefined,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <span {...triggerProps}>{children}</span>
      {typeof window !== "undefined" && createPortal(tooltip, document.body)}
    </>
  );
}

export function InfoIcon({ text }: { text: string }) {
  return (
    <Tooltip content={text} position="top">
      <span className="inline-flex items-center justify-center w-4 h-4 text-xs text-muted-foreground bg-secondary rounded-full cursor-help select-none">
        ?
      </span>
    </Tooltip>
  );
}