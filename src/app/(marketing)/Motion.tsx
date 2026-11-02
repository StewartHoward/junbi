"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/*
 * Small, quiet animations for the marketing pages. The server renders the finished state, so pages read
 * correctly with no JavaScript and for search engines. People who ask for reduced motion see it finished.
 */

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function onSeen(el: Element, run: () => void) {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        run();
      }
    },
    { threshold: 0.35 },
  );
  io.observe(el);
  return () => io.disconnect();
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** A number that counts from `from` to `to` the first time it's seen. */
export function CountUp({ to, from = 0, prefix = "", suffix = "", duration = 1400, delay = 0 }: { to: number; from?: number; prefix?: string; suffix?: string; duration?: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = (n: number) => `${prefix}${Math.round(n).toLocaleString("en-GB")}${suffix}`;
  const [text, setText] = useState(fmt(to));

  useLayoutEffect(() => {
    if (!reduced()) setText(fmt(from));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reduced() || !ref.current) return;
    let raf = 0;
    let timer = 0;
    const stop = onSeen(ref.current, () => {
      timer = window.setTimeout(() => {
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          setText(fmt(from + (to - from) * easeOut(t)));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }, delay);
    });
    return () => {
      stop();
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span ref={ref} style={{ fontVariantNumeric: "tabular-nums" }}>
      {text}
    </span>
  );
}

/**
 * Plays the animations of everything inside marked with data-anim ("up", "belt", "pop", "fill") the first time
 * the block is seen. Set --i on each child to stagger them.
 */
export function Reveal({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!reduced()) ref.current?.classList.add("pending");
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    return onSeen(el, () => {
      el.classList.remove("pending");
      el.classList.add("in");
    });
  }, []);
  return (
    <div ref={ref} className={`m-reveal${className ? ` ${className}` : ""}`} style={style}>
      {children}
    </div>
  );
}
