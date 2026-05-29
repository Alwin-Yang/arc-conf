import type { Area, Conference, Deadline } from "@/types/conference";

export type { Area, Conference, Deadline };

export const AREA_LABELS: Record<Area, string> = {
  ai: "AI",
  robotics: "Robotics",
  control: "Control",
};

export const DEADLINE_LABELS: Record<Deadline["type"], string> = {
  abstract: "Abstract",
  paper: "Paper",
  supplementary: "Supplementary",
  rebuttal: "Rebuttal",
  "camera-ready": "Camera-ready",
  other: "Deadline",
};

/** CORE tiers we expose as a coarse rank filter, best → worst. */
export const RANK_TIERS = ["A*", "A", "B", "C"] as const;
export type RankTier = (typeof RANK_TIERS)[number];

/**
 * Distill the free-form `rank` string ("CORE A* · CCF B", "Q1", …) into a
 * single coarse CORE tier for filtering. Returns null when no CORE tier is
 * present (journal ranks like "Q1" don't map onto the conference tiers).
 */
export function coreTier(c: Conference): RankTier | null {
  if (!c.rank) return null;
  const m = c.rank.match(/CORE\s+(A\*|A|B|C)\b/i);
  return m ? (m[1].toUpperCase() as RankTier) : null;
}

/**
 * The next still-open deadline for a conference, or null if every deadline has
 * passed. "Next" = earliest deadline whose instant is at/after `now`.
 */
export function nextDeadline(c: Conference, now: Date = new Date()): Deadline | null {
  const future = c.deadlines
    .filter((d) => new Date(d.date).getTime() >= now.getTime())
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return future[0] ?? null;
}
