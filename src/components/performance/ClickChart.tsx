"use client";

import { useEffect, useRef, useState } from "react";

const HEIGHT = 200;
const PAD = { top: 12, right: 32, bottom: 28, left: 4 };

function niceScale(max: number) {
  if (max <= 0) return { top: 4, step: 1 };
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  const step = steps.find((s) => Math.floor(max / s) + 1 <= 5) ?? 10_000;
  return { top: (Math.floor(max / step) + 1) * step, step };
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Clicks per day as square-cornered columns on a zero baseline. Empty days draw no bar. */
export function ClickChart({ daily, endDate }: { daily: number[]; endDate: Date }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const max = Math.max(0, ...daily);
  const { top, step } = niceScale(max);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = daily.length ? plotW / daily.length : 0;
  const bar = Math.max(2, slot * 0.62);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  const dates = daily.map((_, i) => {
    const d = new Date(endDate);
    d.setDate(d.getDate() - (daily.length - 1 - i));
    return d;
  });
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const peak = daily.indexOf(max);
  const total = daily.reduce((a, b) => a + b, 0);
  const label =
    total === 0
      ? `No clicks in the last ${daily.length} days.`
      : `${total} clicks in the last ${daily.length} days, most on ${fmt(dates[peak])} with ${max}.`;

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={label} className="block">
          {ticks.map((t) => (
            <g key={t}>
              {t > 0 && <line x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />}
              <text x={width - 4} y={y(t)} dy="0.32em" textAnchor="end" className="num fill-ink-faint text-[12px]">
                {t}
              </text>
            </g>
          ))}
          {daily.map((v, i) =>
            v > 0 ? (
              <rect
                key={i}
                x={PAD.left + i * slot + (slot - bar) / 2}
                y={y(v)}
                width={bar}
                height={y(0) - y(v)}
                fill="var(--color-forest)"
              >
                <title>{`${fmt(dates[i])}: ${v} ${v === 1 ? "click" : "clicks"}`}</title>
              </rect>
            ) : null,
          )}
          <line x1={PAD.left} x2={PAD.left + plotW} y1={y(0)} y2={y(0)} stroke="var(--color-ink-faint)" strokeWidth={1.5} />
          {dates.map((d, i) => {
            const last = i === dates.length - 1;
            return (dates.length - 1 - i) % 4 === 0 ? (
              <text
                key={i}
                x={last ? PAD.left + plotW : PAD.left + i * slot + slot / 2}
                y={HEIGHT - 8}
                textAnchor={last ? "end" : "middle"}
                className="fill-ink-faint text-[12px]"
              >
                {last ? "Today" : fmt(d)}
              </text>
            ) : null;
          })}
        </svg>
      )}
      {width === 0 && <div style={{ height: HEIGHT }} aria-hidden />}
    </div>
  );
}
