"use client";

import { useEffect, useRef } from "react";

// On a narrow screen the year grid scrolls sideways inside its own box. This starts it at the
// right-hand end, where today is.
export function HeatScroll({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) box.current.scrollLeft = box.current.scrollWidth;
  }, []);
  return (
    <div ref={box} className="heat-wrap">
      {children}
    </div>
  );
}
