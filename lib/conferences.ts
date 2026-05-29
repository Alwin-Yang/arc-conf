import rawData from "@/data/conferences.json";
import { ConferencesSchema, type Conference } from "@/types/conference";
import { nextDeadline, type Deadline } from "@/lib/conference-utils";

/**
 * The whole dataset, validated once at build time. If `data/conferences.json`
 * ever drifts from the schema (e.g. a bad manual edit), the build fails here
 * rather than rendering broken cards.
 *
 * This module imports the JSON, so it is **server-only** — keep it out of
 * client components (use `@/lib/conference-utils` for the pure helpers).
 */
export const conferences: Conference[] = ConferencesSchema.parse(rawData);

/**
 * A conference paired with its next open deadline. `next` is null when no
 * future deadline is known for that venue (the UI shows it as "TBA").
 */
export type ListItem = { conference: Conference; next: Deadline | null };

/** A conference paired with its next open deadline. */
export type UpcomingItem = { conference: Conference; next: Deadline };

/** Conferences with at least one upcoming deadline, sorted by how soon. */
export function upcomingConferences(now: Date = new Date()): UpcomingItem[] {
  return conferences
    .map((conference) => ({ conference, next: nextDeadline(conference, now) }))
    .filter((x): x is UpcomingItem => x.next !== null)
    .sort((a, b) => (a.next.date < b.next.date ? -1 : 1));
}

/**
 * One entry per venue (deduped by title). For each venue we pick the single
 * most relevant edition:
 *
 *   - if any edition still has a future deadline, that edition + its soonest
 *     deadline (so ICRA shows the open 2026 round, not the closed 2024 one);
 *   - otherwise the latest-year edition with `next: null` (rendered as "TBA").
 *
 * Sorted with countdown-bearing venues first (soonest deadline first), then the
 * TBA venues alphabetically — so the homepage lists *every* venue both feeds
 * know about, never hiding one just because its deadline hasn't been announced.
 */
export function allVenues(now: Date = new Date()): ListItem[] {
  const byVenue = new Map<string, Conference[]>();
  for (const c of conferences) {
    const key = c.title.toUpperCase();
    const group = byVenue.get(key) ?? [];
    group.push(c);
    byVenue.set(key, group);
  }

  const items: ListItem[] = [];
  for (const editions of byVenue.values()) {
    let best: UpcomingItem | null = null;
    for (const conference of editions) {
      const next = nextDeadline(conference, now);
      if (next && (!best || next.date < best.next.date)) best = { conference, next };
    }
    if (best) {
      items.push(best);
    } else {
      const latest = editions.reduce((a, b) => (b.year > a.year ? b : a));
      items.push({ conference: latest, next: null });
    }
  }

  return items.sort((a, b) => {
    if (a.next && b.next) return a.next.date < b.next.date ? -1 : 1;
    if (a.next) return -1;
    if (b.next) return 1;
    return a.conference.title.localeCompare(b.conference.title);
  });
}
