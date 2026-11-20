"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * lg+ sticky sidebar. When the rail is taller than the viewport, its sticky `top`
 * goes negative so it scrolls until its bottom is in view and then sticks there —
 * nothing is ever unreachable and there's no inner scrollbar.
 */
export function StickyAside({ children, className, label, offset = 96 }: { children: React.ReactNode; className?: string; label?: string; offset?: number }) {
  const ref = useRef<HTMLElement>(null);
  const [top, setTop] = useState(offset);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setTop(Math.min(offset, window.innerHeight - el.offsetHeight - 24));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [offset]);

  return (
    <aside ref={ref} aria-label={label} style={{ "--sticky-top": `${top}px` } as React.CSSProperties} className={cn("lg:sticky lg:top-[var(--sticky-top)] lg:self-start", className)}>
      {children}
    </aside>
  );
}
