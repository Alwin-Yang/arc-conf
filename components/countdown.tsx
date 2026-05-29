"use client";

import { useEffect, useState } from "react";

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function diffParts(target: number, now: number): Parts {
  const ms = Math.max(0, target - now);
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/**
 * Live countdown to an ISO instant. Renders a stable placeholder until mounted
 * so SSR/static markup matches the first client render (no hydration mismatch).
 */
export function Countdown({ iso, className }: { iso: string; className?: string }) {
  const target = new Date(iso).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) {
    return <span className={className}>—</span>;
  }

  if (target <= now) {
    return <span className={className}>closed</span>;
  }

  const { days, hours, minutes, seconds } = diffParts(target, now);
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <span className={className} suppressHydrationWarning>
      {days > 0 && <span>{days}d </span>}
      <span className="tabular-nums">
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    </span>
  );
}
