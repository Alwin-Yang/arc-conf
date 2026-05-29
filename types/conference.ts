import { z } from "zod";

/**
 * The single source of truth for the shape of a conference.
 *
 * Step 6's sync script normalizes the upstream `paperswithcode/ai-deadlines`
 * YAML (plus our hand-curated overrides) into this shape and validates the
 * result against `ConferencesSchema` before writing `data/conferences.json`.
 * Every later step (list page, detail page, .ics export) reads that JSON and
 * trusts it conforms to `Conference`.
 */

/** Top-level area buckets arc-conf cares about. */
export const AREAS = ["ai", "robotics", "control"] as const;
export type Area = (typeof AREAS)[number];

/**
 * Upstream `sub` codes (`_data/types.yml`) collapsed into our coarse areas.
 * A venue can carry several subs (e.g. ICLR is `['ML','CV','NLP',...]`), so a
 * conference can map to more than one area. Subs not listed here (e.g. `HCI`)
 * are out of scope and cause the venue to be filtered out.
 */
export const SUB_TO_AREA: Record<string, Area> = {
  ML: "ai",
  CV: "ai",
  CG: "ai",
  NLP: "ai",
  SP: "ai",
  DM: "ai",
  AP: "ai",
  KR: "ai",
  RO: "robotics",
  // `control` has no upstream sub — it only arrives via data/conferences.yml.
};

/** The kinds of deadline a venue can publish, ordered chronologically. */
export const DEADLINE_TYPES = [
  "abstract",
  "paper",
  "supplementary",
  "rebuttal",
  "camera-ready",
  "other",
] as const;
export type DeadlineType = (typeof DEADLINE_TYPES)[number];

/**
 * A single deadline, stored as an absolute instant (`date`) plus the original
 * wall-clock string and zone it was published in. Keeping both means the UI can
 * show "23:59 AoE" verbatim while still doing correct countdown math off `date`.
 */
export const DeadlineSchema = z.object({
  type: z.enum(DEADLINE_TYPES),
  /** Absolute instant in UTC, ISO-8601 (e.g. "2024-09-15T11:59:59.000Z"). */
  date: z.iso.datetime(),
  /** As-published local time, e.g. "2024-09-15 23:59:59". */
  localTime: z.string(),
  /** IANA zone or offset label used to derive `date`, e.g. "UTC-12", "America/Los_Angeles". */
  timezone: z.string(),
  /** Optional human note for this specific deadline. */
  label: z.string().optional(),
});
export type Deadline = z.infer<typeof DeadlineSchema>;

export const ConferenceSchema = z.object({
  /** Stable unique slug, e.g. "icra-2025". Used in URLs (Step 8). */
  id: z.string().min(1),
  /** Short display name, e.g. "ICRA". */
  title: z.string().min(1),
  year: z.number().int(),
  fullName: z.string().optional(),
  link: z.url(),
  /** At least one area; sorted, de-duplicated. */
  areas: z.array(z.enum(AREAS)).nonempty(),
  /** Raw upstream sub codes kept for fine-grained filtering later. */
  tags: z.array(z.string()),
  /** Optional ranking label (e.g. "A*", "Q1"); only ever set via overrides. */
  rank: z.string().optional(),
  hindex: z.number().optional(),
  place: z.string().optional(),
  /** Human-readable date range as published, e.g. "May 19 - May 23, 2025". */
  dateText: z.string().optional(),
  /** Event start/end as plain ISO dates (yyyy-mm-dd). */
  start: z.string().optional(),
  end: z.string().optional(),
  deadlines: z.array(DeadlineSchema),
  note: z.string().optional(),
  /** Provenance — which feed supplied this record (highest-priority wins on merge). */
  source: z.enum(["ai-deadlines", "ccf-deadlines", "override"]),
});
export type Conference = z.infer<typeof ConferenceSchema>;

export const ConferencesSchema = z.array(ConferenceSchema);
